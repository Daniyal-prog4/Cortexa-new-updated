"""
Cortexa Backend - FastAPI cloud service.

Provides:
- Custom JWT email+password auth with device activation
- Chat endpoint bridged to Claude Sonnet 4.6 via Emergent Universal Key
- Basic CRUD for agents, memory items, tasks, history
- Simulated system telemetry
"""
from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from pathlib import Path
import os
import uuid
import logging
import random
import bcrypt
import jwt

from emergentintegrations.llm.chat import LlmChat, UserMessage

# ---------- Setup ----------
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')
JWT_SECRET = os.environ.get('JWT_SECRET', 'dev-secret')
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
    message: str
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


async def current_user(creds: HTTPAuthorizationCredentials = Depends(bearer)) -> dict:
    if not creds:
        raise HTTPException(status_code=401, detail="Missing token")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALG])
        user_id = payload["sub"]
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


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
async def login(body: UserLogin):
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not verify_pw(body.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
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
    except Exception as e:
        logger.exception("LLM error")
        raise HTTPException(status_code=502, detail=f"LLM error: {e}")

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


# ---------- Register router ----------
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db():
    client.close()
