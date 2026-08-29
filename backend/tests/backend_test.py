"""Cortexa backend API regression tests."""
import os
import uuid

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")
API = f"{BASE_URL}/api"

SEEDED = {"email": "daniyal@cortexa.ai", "password": "CortexaPass!23"}


@pytest.fixture(scope="session")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def new_user(client):
    """Register a fresh user; returns dict with token/email/id."""
    email = f"TEST_{uuid.uuid4().hex[:10]}@cortexaqa.com"
    r = client.post(f"{API}/auth/register", json={"email": email, "password": "TestPass!23", "name": "TEST User"}, timeout=30)
    assert r.status_code == 200, f"register failed {r.status_code} {r.text[:300]}"
    data = r.json()
    assert data["token"]
    assert data["user"]["email"] == email
    return {"email": email, "password": "TestPass!23", "token": data["token"], "id": data["user"]["id"]}


@pytest.fixture(scope="session")
def auth(new_user):
    return {"Authorization": f"Bearer {new_user['token']}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def second_user(client):
    email = f"TEST_{uuid.uuid4().hex[:10]}@cortexaqa.com"
    r = client.post(f"{API}/auth/register", json={"email": email, "password": "TestPass!23", "name": "TEST Two"}, timeout=30)
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['token']}", "Content-Type": "application/json"}


# ---------- Health ----------
def test_root(client):
    r = client.get(f"{API}/", timeout=20)
    assert r.status_code == 200
    assert r.json()["status"] == "online"


# ---------- Auth ----------
def test_register_seeds_agents(client, auth):
    r = client.get(f"{API}/agents", headers=auth, timeout=20)
    assert r.status_code == 200
    agents = r.json()
    names = [a["name"] for a in agents]
    assert len(agents) == 4, names
    for expected in ["Developer Agent", "Researcher Agent", "System Agent", "File Agent"]:
        assert expected in names


def test_register_duplicate_email(client, new_user):
    r = client.post(f"{API}/auth/register", json={"email": new_user["email"], "password": "x1234567", "name": "dup"}, timeout=20)
    assert r.status_code == 400


def test_login_seeded_user(client):
    r = client.post(f"{API}/auth/login", json=SEEDED, timeout=20)
    assert r.status_code == 200, f"seeded credential login failed: {r.status_code} {r.text[:300]}"
    assert r.json()["user"]["email"] == SEEDED["email"]


def test_login_wrong_password(client):
    r = client.post(f"{API}/auth/login", json={"email": SEEDED["email"], "password": "WrongPass!99"}, timeout=20)
    assert r.status_code == 401


def test_me(client, auth, new_user):
    r = client.get(f"{API}/auth/me", headers=auth, timeout=20)
    assert r.status_code == 200
    # NOTE: register response echoes original case; /auth/me returns lowercased email (minor inconsistency)
    assert r.json()["email"].lower() == new_user["email"].lower()


def test_me_no_token(client):
    r = requests.get(f"{API}/auth/me", timeout=20)
    assert r.status_code == 401


def test_me_bad_token(client):
    r = requests.get(f"{API}/auth/me", headers={"Authorization": "Bearer garbage"}, timeout=20)
    assert r.status_code == 401


@pytest.mark.parametrize("method,path", [
    ("get", "/agents"), ("post", "/agents"), ("get", "/memory"), ("post", "/memory"),
    ("get", "/tasks"), ("post", "/tasks"), ("get", "/activity"),
    ("get", "/system/telemetry"), ("post", "/chat"), ("get", "/devices"),
    ("post", "/devices/activate"),
])
def test_protected_endpoints_require_auth(method, path):
    r = getattr(requests, method)(f"{API}{path}", json={}, timeout=20)
    assert r.status_code == 401, f"{method.upper()} {path} -> {r.status_code}"


# ---------- Devices ----------
def test_device_activate_and_list(client, auth):
    r = client.post(f"{API}/devices/activate", headers=auth, json={"device_name": "TEST-PC", "platform": "Windows"}, timeout=20)
    assert r.status_code == 200
    dev = r.json()
    assert dev["device_name"] == "TEST-PC"
    assert dev["platform"] == "Windows"
    r2 = client.get(f"{API}/devices", headers=auth, timeout=20)
    assert r2.status_code == 200
    assert any(d["id"] == dev["id"] for d in r2.json())


# ---------- Agents CRUD ----------
def test_agent_create_get_delete(client, auth):
    payload = {"name": "TEST_Agent", "role": "QA", "description": "test agent", "icon": "cpu", "color": "cyan", "tools": ["web_search"]}
    r = client.post(f"{API}/agents", headers=auth, json=payload, timeout=20)
    assert r.status_code == 200
    a = r.json()
    assert a["name"] == "TEST_Agent"
    assert a["tools"] == ["web_search"]
    assert isinstance(a["id"], str)

    lst = client.get(f"{API}/agents", headers=auth, timeout=20).json()
    assert any(x["id"] == a["id"] for x in lst)

    d = client.delete(f"{API}/agents/{a['id']}", headers=auth, timeout=20)
    assert d.status_code == 200
    lst2 = client.get(f"{API}/agents", headers=auth, timeout=20).json()
    assert not any(x["id"] == a["id"] for x in lst2)


def test_agent_not_deletable_by_other_user(client, auth, second_user):
    r = client.post(f"{API}/agents", headers=auth, json={"name": "TEST_Priv", "role": "r", "description": "d"}, timeout=20)
    aid = r.json()["id"]
    client.delete(f"{API}/agents/{aid}", headers=second_user, timeout=20)
    lst = client.get(f"{API}/agents", headers=auth, timeout=20).json()
    assert any(x["id"] == aid for x in lst), "agent deleted by another user"
    client.delete(f"{API}/agents/{aid}", headers=auth, timeout=20)


# ---------- Memory ----------
def test_memory_crud_and_scoping(client, auth, second_user):
    r = client.post(f"{API}/memory", headers=auth, json={"key": "TEST_key", "value": "TEST_value", "category": "preference"}, timeout=20)
    assert r.status_code == 200
    item = r.json()
    assert item["key"] == "TEST_key" and item["value"] == "TEST_value"

    mine = client.get(f"{API}/memory", headers=auth, timeout=20).json()
    assert any(m["id"] == item["id"] for m in mine)

    other = client.get(f"{API}/memory", headers=second_user, timeout=20).json()
    assert not any(m["id"] == item["id"] for m in other), "memory leaked across users"

    d = client.delete(f"{API}/memory/{item['id']}", headers=auth, timeout=20)
    assert d.status_code == 200
    mine2 = client.get(f"{API}/memory", headers=auth, timeout=20).json()
    assert not any(m["id"] == item["id"] for m in mine2)


# ---------- Tasks ----------
def test_task_add_list_update(client, auth):
    r = client.post(f"{API}/tasks", headers=auth, json={"title": "TEST_task", "agent": "System Agent"}, timeout=20)
    assert r.status_code == 200
    t = r.json()
    assert t["title"] == "TEST_task"
    assert t["status"] == "pending"

    lst = client.get(f"{API}/tasks", headers=auth, timeout=20).json()
    assert any(x["id"] == t["id"] for x in lst)

    u = client.patch(f"{API}/tasks/{t['id']}?status_value=done", headers=auth, timeout=20)
    assert u.status_code == 200
    assert u.json()["status"] == "done"

    lst2 = client.get(f"{API}/tasks", headers=auth, timeout=20).json()
    assert [x for x in lst2 if x["id"] == t["id"]][0]["status"] == "done"


def test_task_update_missing_id(client, auth):
    r = client.patch(f"{API}/tasks/{uuid.uuid4()}?status_value=done", headers=auth, timeout=20)
    # BUG (reported): backend returns 500 because Task(**None) raises when doc missing
    assert r.status_code == 404, f"expected 404 for unknown task id, got {r.status_code}"


# ---------- Telemetry ----------
def test_telemetry(client, auth):
    r = client.get(f"{API}/system/telemetry", headers=auth, timeout=20)
    assert r.status_code == 200
    d = r.json()
    for k in ["cpu", "ram", "disk", "battery"]:
        assert isinstance(d[k], int), f"{k} not int"
        assert 0 <= d[k] <= 100, f"{k}={d[k]} out of range"
    assert d["online"] is True


# ---------- Chat (LLM) ----------
def test_chat_and_session_reuse(client, auth):
    r = client.post(f"{API}/chat", headers=auth, json={"message": "Say hi in 3 words."}, timeout=120)
    assert r.status_code == 200, f"chat failed {r.status_code} {r.text[:400]}"
    d = r.json()
    assert isinstance(d["reply"], str) and len(d["reply"].strip()) > 0
    sid = d["session_id"]
    assert sid

    r2 = client.post(f"{API}/chat", headers=auth, json={"message": "And now in 2 words.", "session_id": sid}, timeout=120)
    assert r2.status_code == 200, f"chat2 failed {r2.status_code} {r2.text[:400]}"
    assert r2.json()["session_id"] == sid
    assert len(r2.json()["reply"].strip()) > 0

    hist = client.get(f"{API}/chat/sessions/{sid}", headers=auth, timeout=20)
    assert hist.status_code == 200
    msgs = hist.json()
    assert len(msgs) == 4
    assert all("_id" not in m for m in msgs)


def test_activity_after_chat(client, auth):
    r = client.get(f"{API}/activity", headers=auth, timeout=20)
    assert r.status_code == 200
    entries = r.json()
    assert len(entries) > 0, "no activity logged after chat"
    assert any(e["kind"] == "chat" for e in entries)
