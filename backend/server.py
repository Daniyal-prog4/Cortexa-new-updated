"""
Cortexa Backend - FastAPI cloud service.

Provides:
- Custom JWT email+password auth with device activation
- Chat endpoint bridged to Claude Sonnet 4.6 via Emergent Universal Key
- Basic CRUD for agents, memory items, tasks, history
- Simulated system telemetry
"""
from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Request
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from pathlib import Path
import os
import re
import json
import time
import uuid
from collections import defaultdict, deque
import logging
import random
import bcrypt
import jwt

from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta

# ---------- Setup ----------
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')
JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALG = "HS256"
JWT_EXP_HOURS = 24 * 7  # 7 days

app = FastAPI(title="Cortexa API", version="0.1.0")
api = APIRouter(prefix="/api")
bearer = HTTPBearer(auto_error=False)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("cortexa")


# ---------- Models ----------
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: EmailStr
    name: str
    plan: str = "Pro"


class AuthResponse(BaseModel):
    token: str
    user: UserOut


class DeviceActivate(BaseModel):
    device_name: str
    platform: str = "Windows"


class Device(BaseModel):
    id: str
    user_id: str
    device_name: str
    platform: str
    activated_at: str


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    session_id: Optional[str] = None


class ChatResponse(BaseModel):
    reply: str
    session_id: str


class Agent(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    role: str
    description: str
    icon: str = "cpu"
    color: str = "cyan"
    active: bool = True
    tools: List[str] = Field(default_factory=list)


class AgentCreate(BaseModel):
    name: str
    role: str
    description: str
    icon: str = "cpu"
    color: str = "cyan"
    tools: List[str] = Field(default_factory=list)


class MemoryItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    key: str
    value: str
    category: str = "preference"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class MemoryCreate(BaseModel):
    key: str
    value: str
    category: str = "preference"


class Task(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    title: str
    status: str = "pending"  # pending | running | done | failed
    agent: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class TaskCreate(BaseModel):
    title: str
    agent: Optional[str] = None


class ActivityEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    kind: str  # e.g. chat, tool, system
    title: str
    icon: str = "activity"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# ---------- Abuse protection ----------
LLM_RATE_LIMIT = 20          # LLM calls per user
LLM_RATE_WINDOW = 300        # seconds
MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_MINUTES = 15

_llm_calls: dict = defaultdict(deque)


def check_llm_rate(user_id: str):
    now = time.time()
    dq = _llm_calls[user_id]
    while dq and now - dq[0] > LLM_RATE_WINDOW:
        dq.popleft()
    if len(dq) >= LLM_RATE_LIMIT:
        raise HTTPException(status_code=429, detail="Rate limit reached — please wait a few minutes before sending more messages.")
    dq.append(now)


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    return fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "unknown")


async def check_login_lockout(identifier: str):
    doc = await db.login_attempts.find_one({"identifier": identifier})
    if doc and doc.get("locked_until"):
        locked_until = datetime.fromisoformat(doc["locked_until"])
        if datetime.now(timezone.utc) < locked_until:
            raise HTTPException(status_code=429, detail="Too many failed attempts. Try again in a few minutes.")


async def record_login_failure(identifier: str):
    now = datetime.now(timezone.utc)
    doc = await db.login_attempts.find_one({"identifier": identifier})
    count = (doc.get("count", 0) + 1) if doc else 1
    update = {"count": count, "last_at": now.isoformat()}
    if count >= MAX_LOGIN_ATTEMPTS:
        update["locked_until"] = (now + timedelta(minutes=LOCKOUT_MINUTES)).isoformat()
        update["count"] = 0
    await db.login_attempts.update_one({"identifier": identifier}, {"$set": update}, upsert=True)


async def clear_login_failures(identifier: str):
    await db.login_attempts.delete_one({"identifier": identifier})


# ---------- Auth helpers ----------
def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_pw(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def make_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXP_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


DEFAULT_USER_ID = "local-user"


async def _ensure_local_user() -> dict:
    """Frontend login/auth UI has been removed (local/desktop single-user mode).
    Every request now resolves to a single fixed local user instead of a JWT
    Bearer token, so existing per-user_id data (agents/memory/tasks/etc.) still
    works with the same query shape as before, but nothing can return 401.
    The user is created on first use and reused after that.
    """
    user = await db.users.find_one({"id": DEFAULT_USER_ID}, {"_id": 0, "password": 0})
    if not user:
        doc = {
            "id": DEFAULT_USER_ID,
            "email": "local@cortexa.app",
            "name": "Local User",
            "plan": "Pro",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(doc)
        await _seed_default_agents(DEFAULT_USER_ID)
        user = {k: v for k, v in doc.items()}
    return user


async def current_user(creds: HTTPAuthorizationCredentials = Depends(bearer)) -> dict:
    # NOTE: auth intentionally disabled — see _ensure_local_user() docstring.
    # `creds` is accepted (auto_error=False) but ignored so old clients that
    # still send a stale/expired Bearer token don't error either.
    return await _ensure_local_user()


# ---------- Health ----------
@api.get("/")
async def root():
    return {"service": "cortexa", "status": "online"}


# ---------- Auth ----------
@api.post("/auth/register", response_model=AuthResponse)
async def register(body: UserCreate):
    existing = await db.users.find_one({"email": body.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = str(uuid.uuid4())
    doc = {
        "id": user_id,
        "email": body.email.lower(),
        "name": body.name,
        "password": hash_pw(body.password),
        "plan": "Pro",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(doc)
    # Seed default agents for a great first-run experience
    await _seed_default_agents(user_id)
    token = make_token(user_id)
    return AuthResponse(
        token=token,
        user=UserOut(id=user_id, email=body.email.lower(), name=body.name, plan="Pro"),
    )


@api.post("/auth/login", response_model=AuthResponse)
async def login(body: UserLogin, request: Request):
    identifier = f"{_client_ip(request)}:{body.email.lower()}"
    await check_login_lockout(identifier)
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not verify_pw(body.password, user["password"]):
        await record_login_failure(identifier)
        raise HTTPException(status_code=401, detail="Invalid credentials")
    await clear_login_failures(identifier)
    token = make_token(user["id"])
    return AuthResponse(
        token=token,
        user=UserOut(id=user["id"], email=user["email"], name=user["name"], plan=user.get("plan", "Pro")),
    )


@api.get("/auth/me", response_model=UserOut)
async def me(user: dict = Depends(current_user)):
    return UserOut(id=user["id"], email=user["email"], name=user["name"], plan=user.get("plan", "Pro"))


# ---------- Device activation ----------
@api.post("/devices/activate", response_model=Device)
async def activate_device(body: DeviceActivate, user: dict = Depends(current_user)):
    device = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "device_name": body.device_name,
        "platform": body.platform,
        "activated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.devices.insert_one(device)
    return Device(**device)


@api.get("/devices", response_model=List[Device])
async def list_devices(user: dict = Depends(current_user)):
    docs = await db.devices.find({"user_id": user["id"]}, {"_id": 0}).to_list(100)
    return [Device(**d) for d in docs]


# ---------- Agents ----------
DEFAULT_AGENTS = [
    {"name": "Developer Agent", "role": "Coding, VS Code, Git", "description": "Writes, reviews and refactors code across your projects.", "icon": "code", "color": "violet", "tools": ["open_app", "read_file", "write_file", "run_command"]},
    {"name": "Researcher Agent", "role": "Web research, Summaries", "description": "Searches the web and summarizes findings with citations.", "icon": "search", "color": "cyan", "tools": ["web_search", "web_fetch"]},
    {"name": "System Agent", "role": "System, Apps, Settings", "description": "Manages apps, system settings and workflow automations.", "icon": "cog", "color": "blue", "tools": ["open_app", "system_info", "toggle_setting"]},
    {"name": "File Agent", "role": "Files, Organize, Search", "description": "Finds, moves and organizes files with your permission.", "icon": "folder", "color": "amber", "tools": ["search_files", "move_file", "read_file"]},
]


async def _seed_default_agents(user_id: str):
    for a in DEFAULT_AGENTS:
        doc = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "active": True,
            **a,
        }
        await db.agents.insert_one(doc)


@api.get("/agents", response_model=List[Agent])
async def list_agents(user: dict = Depends(current_user)):
    docs = await db.agents.find({"user_id": user["id"]}, {"_id": 0}).to_list(200)
    return [Agent(**d) for d in docs]


@api.post("/agents", response_model=Agent)
async def create_agent(body: AgentCreate, user: dict = Depends(current_user)):
    agent = Agent(user_id=user["id"], **body.model_dump())
    await db.agents.insert_one(agent.model_dump())
    return agent


@api.delete("/agents/{agent_id}")
async def delete_agent(agent_id: str, user: dict = Depends(current_user)):
    result = await db.agents.delete_one({"id": agent_id, "user_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Agent not found")
    return {"ok": True}


# ---------- Memory ----------
@api.get("/memory", response_model=List[MemoryItem])
async def list_memory(user: dict = Depends(current_user)):
    docs = await db.memory.find({"user_id": user["id"]}, {"_id": 0}).to_list(500)
    return [MemoryItem(**d) for d in docs]


@api.post("/memory", response_model=MemoryItem)
async def add_memory(body: MemoryCreate, user: dict = Depends(current_user)):
    item = MemoryItem(user_id=user["id"], **body.model_dump())
    await db.memory.insert_one(item.model_dump())
    return item


@api.delete("/memory/{item_id}")
async def delete_memory(item_id: str, user: dict = Depends(current_user)):
    result = await db.memory.delete_one({"id": item_id, "user_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Memory not found")
    return {"ok": True}


# ---------- Tasks ----------
@api.get("/tasks", response_model=List[Task])
async def list_tasks(user: dict = Depends(current_user)):
    docs = await db.tasks.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return [Task(**d) for d in docs]


@api.post("/tasks", response_model=Task)
async def add_task(body: TaskCreate, user: dict = Depends(current_user)):
    task = Task(user_id=user["id"], **body.model_dump())
    await db.tasks.insert_one(task.model_dump())
    return task


ALLOWED_TASK_STATUS = {"pending", "running", "done", "failed"}


@api.patch("/tasks/{task_id}", response_model=Task)
async def update_task(task_id: str, status_value: str, user: dict = Depends(current_user)):
    if status_value not in ALLOWED_TASK_STATUS:
        raise HTTPException(status_code=400, detail=f"Invalid status. Allowed: {sorted(ALLOWED_TASK_STATUS)}")
    result = await db.tasks.update_one(
        {"id": task_id, "user_id": user["id"]}, {"$set": {"status": status_value}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    doc = await db.tasks.find_one({"id": task_id, "user_id": user["id"]}, {"_id": 0})
    return Task(**doc)


# ---------- Activity / History ----------
@api.get("/activity", response_model=List[ActivityEntry])
async def list_activity(user: dict = Depends(current_user)):
    docs = await db.activity.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
    return [ActivityEntry(**d) for d in docs]


async def _log_activity(user_id: str, kind: str, title: str, icon: str = "activity"):
    entry = ActivityEntry(user_id=user_id, kind=kind, title=title, icon=icon)
    await db.activity.insert_one(entry.model_dump())


# ---------- Telemetry (simulated live system metrics) ----------
@api.get("/system/telemetry")
async def telemetry(user: dict = Depends(current_user)):
    # Deterministic-ish wandering values to feel alive but plausible
    now = datetime.now(timezone.utc).timestamp()
    def wobble(base, amp):
        return max(2, min(98, int(base + amp * ((now % 30) / 30 - 0.5) * 2 + random.randint(-3, 3))))
    return {
        "cpu": wobble(28, 12),
        "ram": wobble(61, 8),
        "disk": wobble(48, 3),
        "battery": wobble(84, 4),
        "online": True,
        "ts": datetime.now(timezone.utc).isoformat(),
    }


# ---------- Chat with Cortexa (Claude Sonnet 4.6) ----------
CORTEXA_SYSTEM = (
    "You are Cortexa, a Windows-first AI desktop assistant. "
    "You are concise, helpful, and safety-conscious. "
    "You never execute destructive shell commands directly; "
    "instead you describe what tool you would request and ask for confirmation for anything risky. "
    "Reply in a friendly, professional tone, and keep answers under 6 short sentences unless the user asks for detail."
)


@api.post("/chat", response_model=ChatResponse)
async def chat(body: ChatRequest, user: dict = Depends(current_user)):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="LLM key not configured")
    check_llm_rate(user["id"])

    session_id = body.session_id or str(uuid.uuid4())

    # NOTE: LlmChat holds only an in-memory thread per process, so cross-request
    # continuity isn't possible without replaying every turn against the LLM
    # (expensive) or a proper /messages history API (planned). For MVP we keep
    # a single-turn stateless call with a strong system prompt, and store the
    # full transcript in Mongo so the UI can render conversation history.
    chat_client = (
        LlmChat(api_key=EMERGENT_LLM_KEY, session_id=session_id, system_message=CORTEXA_SYSTEM)
        .with_model("anthropic", "claude-sonnet-4-6")
    )

    try:
        response = await chat_client.send_message(UserMessage(text=body.message))
        reply_text = response if isinstance(response, str) else getattr(response, "content", str(response))
    except Exception:
        logger.exception("LLM error")
        raise HTTPException(status_code=502, detail="Assistant temporarily unavailable. Please try again.")

    now = datetime.now(timezone.utc).isoformat()
    await db.chat_messages.insert_many([
        {"id": str(uuid.uuid4()), "user_id": user["id"], "session_id": session_id, "role": "user", "content": body.message, "created_at": now},
        {"id": str(uuid.uuid4()), "user_id": user["id"], "session_id": session_id, "role": "assistant", "content": reply_text, "created_at": now},
    ])
    await _log_activity(user["id"], "chat", f"Chat: {body.message[:48]}", icon="message")

    return ChatResponse(reply=reply_text, session_id=session_id)


@api.get("/chat/sessions/{session_id}")
async def get_session(session_id: str, user: dict = Depends(current_user)):
    docs = await db.chat_messages.find(
        {"user_id": user["id"], "session_id": session_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(200)
    return docs


# ---------- Streaming chat (SSE) + permission engine ----------
RISKY_PATTERNS = [
    (re.compile(r"\b(write|create|save|edit|modify|update)\b.{0,40}\b(file|document|config|\.txt|\.json|\.md)\b", re.I), "write_file", "Write contents to a file on this machine"),
    (re.compile(r"\b(delete|remove|erase|wipe|trash)\b.{0,60}(\.\w{1,5}\b|\b(file|files|folder|directory|photos|documents|downloads)\b)", re.I), "delete_file", "Delete a file or folder from disk"),
    (re.compile(r"\b(move|rename)\b.{0,60}(\.\w{1,5}\b|\b(file|files|folder|directory)\b)", re.I), "move_file", "Move or rename a file on disk"),
    (re.compile(r"\b(run|execute|launch)\b.{0,60}\b(script|command|terminal|powershell|shell|npm|pip|yarn|cargo|python|node|build|\.bat|\.ps1|\.sh|\.exe)\b", re.I), "run_command", "Run a script or shell command"),
    (re.compile(r"\binstall\b\s+\S+", re.I), "install_app", "Install software on this machine"),
]

BLOCKED_PATTERNS = [
    (re.compile(r"\bformat\b.{0,30}\b(disk|drive|c:|ssd|hard ?drive)\b", re.I), "format_disk", "Format a disk or drive"),
    (re.compile(r"\brm\s+-rf\b|\bdel\s+/[sq]\b|\bmkfs\b", re.I), "raw_shell", "Raw destructive shell command"),
    (re.compile(r"\b(delete|remove|wipe|erase)\b.{0,40}\b(system32|windows folder|registry|boot ?loader|all (my )?(files|photos|data|documents))\b", re.I), "system_wipe", "Destructive system-level deletion"),
    (re.compile(r"\b(disable|turn off)\b.{0,30}\b(antivirus|firewall|defender)\b", re.I), "security_off", "Disable security protections"),
]

SIMULATED_RESULTS = {
    "write_file": "File written successfully · 1 file changed (simulated)",
    "delete_file": "Item moved to Recycle Bin (simulated)",
    "move_file": "File moved to the requested destination (simulated)",
    "run_command": "Command completed · exit code 0 (simulated)",
    "install_app": "Installer completed successfully (simulated)",
}


def detect_tool_request(message: str) -> Optional[dict]:
    for pat, tool, desc in BLOCKED_PATTERNS:
        if pat.search(message):
            return {"tool": tool, "risk": "BLOCKED", "description": desc}
    for pat, tool, desc in RISKY_PATTERNS:
        if pat.search(message):
            return {"tool": tool, "risk": "CONFIRM", "description": desc}
    return None


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"


@api.post("/chat/stream")
async def chat_stream(body: ChatRequest, user: dict = Depends(current_user)):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="LLM key not configured")
    check_llm_rate(user["id"])

    session_id = body.session_id or str(uuid.uuid4())
    tool = detect_tool_request(body.message)
    system = CORTEXA_SYSTEM + " Reply in plain text only — never use markdown formatting such as **bold**, backticks, asterisk bullets or headers."
    if tool and tool["risk"] == "BLOCKED":
        system += (
            f" IMPORTANT: The user's request maps to the local tool '{tool['tool']}' which is BLOCKED by the security policy "
            "and will never be executed under any circumstances. Politely inform the user that this action is blocked and "
            "suggest a safer alternative if one exists."
        )
    elif tool:
        system += (
            f" IMPORTANT: The user's request maps to the local tool '{tool['tool']}' which is CONFIRM-risk. "
            "A permission card has been raised in the UI — briefly acknowledge the request and tell the user to "
            "confirm or cancel the permission card before anything runs. Never pretend the action already happened."
        )

    chat_client = (
        LlmChat(api_key=EMERGENT_LLM_KEY, session_id=session_id, system_message=system)
        .with_model("anthropic", "claude-sonnet-4-6")
    )

    user_id = user["id"]
    message = body.message

    async def gen():
        yield _sse({"type": "session", "session_id": session_id})
        full = ""
        had_error = False
        try:
            async for ev in chat_client.stream_message(UserMessage(text=message)):
                if isinstance(ev, TextDelta) and ev.content:
                    full += ev.content
                    yield _sse({"type": "delta", "text": ev.content})
        except Exception:
            had_error = True
            logger.exception("LLM stream error")
            yield _sse({"type": "error", "detail": "Assistant temporarily unavailable. Please try again."})

        now = datetime.now(timezone.utc).isoformat()
        docs = [{"id": str(uuid.uuid4()), "user_id": user_id, "session_id": session_id, "role": "user", "content": message, "created_at": now}]
        if full:
            docs.append({"id": str(uuid.uuid4()), "user_id": user_id, "session_id": session_id, "role": "assistant", "content": full, "created_at": now})
        await db.chat_messages.insert_many(docs)
        await _log_activity(user_id, "chat", f"Chat: {message[:48]}", icon="message")

        if tool and not had_error:
            blocked = tool["risk"] == "BLOCKED"
            req = {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "session_id": session_id,
                "tool": tool["tool"],
                "risk": tool["risk"],
                "description": tool["description"],
                "command": message[:140],
                "status": "blocked" if blocked else "pending",
                "created_at": now,
            }
            if blocked:
                req["result"] = "Blocked by security policy — this action will never run."
                await _log_activity(user_id, "tool", f"Tool blocked: {tool['tool']}", icon="shield")
            await db.tool_requests.insert_one(dict(req))
            yield _sse({"type": "tool_request", "request": {k: req[k] for k in ("id", "tool", "risk", "description", "command", "status")}})

        yield _sse({"type": "done"})

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )


class ToolResolve(BaseModel):
    approved: bool


@api.post("/tools/{request_id}/resolve")
async def resolve_tool(request_id: str, body: ToolResolve, user: dict = Depends(current_user)):
    doc = await db.tool_requests.find_one({"id": request_id, "user_id": user["id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Tool request not found")
    if doc["status"] != "pending":
        raise HTTPException(status_code=400, detail="Tool request already resolved")

    new_status = "executed" if body.approved else "denied"
    result = SIMULATED_RESULTS.get(doc["tool"], "Action completed (simulated)") if body.approved else "Cancelled by user — nothing was executed."
    await db.tool_requests.update_one(
        {"id": request_id},
        {"$set": {"status": new_status, "result": result, "resolved_at": datetime.now(timezone.utc).isoformat()}},
    )
    await _log_activity(
        user["id"],
        "tool",
        f"Tool {new_status}: {doc['tool']}",
        icon="check" if body.approved else "shield",
    )
    return {"id": request_id, "status": new_status, "result": result}


# ---------- Register router ----------
app.include_router(api)

_cors_origins = [o.strip() for o in os.environ.get('CORS_ORIGINS', '*').split(',')]
app.add_middleware(
    CORSMiddleware,
    allow_credentials='*' not in _cors_origins,
    allow_origins=_cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_indexes():
    await db.login_attempts.create_index("identifier")


@app.on_event("shutdown")
async def shutdown_db():
    try:
        if 'client' in globals() and hasattr(client, "close"):
            client.close()
    except Exception:
        pass