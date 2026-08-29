"""Cortexa iteration-2 tests: SSE streaming chat, permission/tool engine, activity log."""
import json
import os
import uuid

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
API = f"{base_url.rstrip('/')}/api"

SEEDED = {"email": "daniyal@cortexa.ai", "password": "CortexaPass!23"}


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def auth(client):
    r = client.post(f"{API}/auth/login", json=SEEDED, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"login failed {r.status_code} {r.text[:300]}")
    token = r.json().get("token")
    assert token, "no token in login response"
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def read_sse(headers, message, session_id=None, timeout=120):
    """POST /api/chat/stream and return the ordered list of parsed SSE payloads."""
    body = {"message": message}
    if session_id:
        body["session_id"] = session_id
    events = []
    with requests.post(f"{API}/chat/stream", json=body, headers=headers, stream=True, timeout=timeout) as r:
        assert r.status_code == 200, f"stream status {r.status_code} {r.text[:300]}"
        assert "text/event-stream" in r.headers.get("content-type", "")
        for line in r.iter_lines(decode_unicode=True):
            if line and line.startswith("data: "):
                events.append(json.loads(line[6:]))
    return events


# ---------- streaming chat (no tool) ----------
class TestChatStream:
    def test_stream_event_order_and_tokens(self, auth):
        events = read_sse(auth, "Say hi in one short sentence.")
        types = [e["type"] for e in events]
        assert types[0] == "session", f"first event not session: {types[:3]}"
        assert types[-1] == "done", f"last event not done: {types[-3:]}"
        assert "error" not in types, [e for e in events if e["type"] == "error"]
        deltas = [e for e in events if e["type"] == "delta"]
        assert len(deltas) > 1, f"expected multiple delta events, got {len(deltas)}"
        assert all(isinstance(d.get("text"), str) for d in deltas)
        full = "".join(d["text"] for d in deltas)
        assert len(full.strip()) > 0
        assert not any(e["type"] == "tool_request" for e in events), "unexpected tool_request"
        sid = events[0]["session_id"]
        assert isinstance(sid, str) and len(sid) > 10

        # persistence: transcript stored under the session
        r = requests.get(f"{API}/chat/sessions/{sid}", headers=auth, timeout=30)
        assert r.status_code == 200
        docs = r.json()
        assert len(docs) >= 2
        assert docs[0]["role"] == "user" and docs[0]["content"] == "Say hi in one short sentence."
        assert docs[1]["role"] == "assistant" and docs[1]["content"] == full
        assert all("_id" not in d for d in docs)

    def test_stream_requires_auth(self):
        r = requests.post(f"{API}/chat/stream", json={"message": "hi"}, timeout=30)
        assert r.status_code in (401, 403), r.status_code


# ---------- tool / permission engine ----------
class TestToolRequests:
    @pytest.fixture(scope="class")
    def risky(self, auth):
        events = read_sse(auth, "Write a file called report.txt with a summary")
        return events

    def test_risky_message_emits_tool_request(self, risky):
        types = [e["type"] for e in risky]
        assert types[0] == "session" and types[-1] == "done"
        assert len([e for e in risky if e["type"] == "delta"]) > 1, "no token stream on risky message"
        tools = [e for e in risky if e["type"] == "tool_request"]
        assert len(tools) == 1, f"expected 1 tool_request, got {len(tools)}"
        req = tools[0]["request"]
        assert req["tool"] == "write_file"
        assert req["risk"] == "CONFIRM"
        assert req["status"] == "pending"
        assert isinstance(req["id"], str) and len(req["id"]) > 10
        assert req["description"]
        assert req["command"]
        # tool_request must come before done
        assert types.index("tool_request") < types.index("done")

    def test_approve_executes_then_double_resolve_400(self, client, auth, risky):
        req_id = [e for e in risky if e["type"] == "tool_request"][0]["request"]["id"]
        r = client.post(f"{API}/tools/{req_id}/resolve", json={"approved": True}, headers=auth, timeout=30)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert data["id"] == req_id
        assert data["status"] == "executed"
        assert "simulated" in data["result"].lower()

        r2 = client.post(f"{API}/tools/{req_id}/resolve", json={"approved": True}, headers=auth, timeout=30)
        assert r2.status_code == 400, f"double resolve should 400, got {r2.status_code}"

    def test_resolve_bogus_id_404(self, client, auth):
        r = client.post(f"{API}/tools/{uuid.uuid4()}/resolve", json={"approved": True}, headers=auth, timeout=30)
        assert r.status_code == 404, r.status_code

    def test_deny_flow(self, client, auth):
        events = read_sse(auth, "Delete the file temp.log from my documents folder")
        tools = [e for e in events if e["type"] == "tool_request"]
        assert len(tools) == 1, f"delete_file not detected: {[e['type'] for e in events]}"
        req = tools[0]["request"]
        assert req["tool"] == "delete_file"
        r = client.post(f"{API}/tools/{req['id']}/resolve", json={"approved": False}, headers=auth, timeout=30)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert data["status"] == "denied"
        assert "cancel" in data["result"].lower()

    def test_resolve_requires_auth(self, client):
        r = client.post(f"{API}/tools/{uuid.uuid4()}/resolve", json={"approved": True}, timeout=30)
        assert r.status_code in (401, 403), r.status_code

    def test_activity_logs_tool_events(self, client, auth):
        r = client.get(f"{API}/activity", headers=auth, timeout=30)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list) and items
        assert all("_id" not in i for i in items)
        titles = [i.get("title", "") for i in items]
        assert any("Tool executed: write_file" in t for t in titles), titles[:10]
        assert any("Tool denied: delete_file" in t for t in titles), titles[:10]


# ---------- regression ----------
class TestRegression:
    def test_login_and_me(self, client, auth):
        r = client.get(f"{API}/auth/me", headers=auth, timeout=30)
        assert r.status_code == 200
        me = r.json()
        assert me["email"] == SEEDED["email"]
        assert "_id" not in me

    def test_agents_list(self, client, auth):
        r = client.get(f"{API}/agents", headers=auth, timeout=30)
        assert r.status_code == 200
        agents = r.json()
        assert isinstance(agents, list)
        assert all("id" in a and "name" in a and "_id" not in a for a in agents)

    def test_tasks_crud(self, client, auth):
        r = client.post(f"{API}/tasks", json={"title": "TEST_task_it2", "agent": "Dev"}, headers=auth, timeout=30)
        assert r.status_code == 200, r.text[:300]
        tid = r.json()["id"]
        assert r.json()["title"] == "TEST_task_it2"

        r = client.get(f"{API}/tasks", headers=auth, timeout=30)
        assert r.status_code == 200
        assert any(t["id"] == tid for t in r.json())

        r = client.patch(f"{API}/tasks/{tid}", params={"status_value": "done"}, headers=auth, timeout=30)
        assert r.status_code == 200, r.text[:300]
        assert r.json()["status"] == "done"

        r = client.get(f"{API}/tasks", headers=auth, timeout=30)
        assert [t for t in r.json() if t["id"] == tid][0]["status"] == "done"

    def test_telemetry(self, client, auth):
        r = client.get(f"{API}/system/telemetry", headers=auth, timeout=30)
        assert r.status_code == 200
        d = r.json()
        for k in ("cpu", "ram", "disk", "battery"):
            assert 0 <= d[k] <= 100, d
        assert d["online"] is True

    def test_non_streaming_chat(self, client, auth):
        r = client.post(f"{API}/chat", json={"message": "Reply with the single word OK."}, headers=auth, timeout=120)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert isinstance(d["reply"], str) and d["reply"].strip()
        assert isinstance(d["session_id"], str)
