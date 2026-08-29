"""Iteration-3 security hardening tests: JWT rotation, brute-force lockout,
LLM rate limiter, chat message length cap, error redaction, CORS, regression."""
import os
import re
import sys
import time
import uuid
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import jwt
import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")
API = f"{BASE_URL}/api"

BACKEND_ENV = dotenv_values("/app/backend/.env")

OLD_SECRETS = ["cortexa-super-secret-jwt-key-change-in-prod", "dev-secret"]


def _creds():
    content = Path("/app/memory/test_credentials.md").read_text(encoding="utf-8")
    email = re.search(r'(?im)^\s*(?:[-*]\s*)?(?:\*\*)?Email(?:\*\*)?\s*:\s*`?([^`\s]+)', content)
    pw = re.search(r'(?im)^\s*(?:[-*]\s*)?(?:\*\*)?Password(?:\*\*)?\s*:\s*`?([^`\s]+)', content)
    if not email or not pw:
        pytest.skip("credentials not parseable")
    return email.group(1), pw.group(1)


@pytest.fixture(scope="module")
def creds():
    return _creds()


@pytest.fixture(scope="module")
def token(creds):
    email, pw = creds
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"login failed {r.status_code}: {r.text[:300]}")
    tok = r.json().get("token")
    assert isinstance(tok, str) and len(tok) > 20
    return tok


@pytest.fixture(scope="module")
def auth(token):
    return {"Authorization": f"Bearer {token}"}


# ---------- JWT secret rotation ----------
class TestJwtRotation:
    def test_env_secret_is_strong_and_no_code_fallback(self):
        secret = BACKEND_ENV.get("JWT_SECRET")
        assert secret and len(secret) >= 32, "JWT_SECRET missing/weak in backend/.env"
        assert secret not in OLD_SECRETS
        src = Path("/app/backend/server.py").read_text()
        assert "os.environ['JWT_SECRET']" in src or 'os.environ["JWT_SECRET"]' in src, \
            "server must read JWT_SECRET without a default fallback"
        for old in OLD_SECRETS:
            assert old not in src, f"old secret literal {old} still in code"

    def test_fresh_token_me_returns_user(self, auth, creds):
        r = requests.get(f"{API}/auth/me", headers=auth, timeout=30)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert data["email"] == creds[0]
        assert isinstance(data["id"], str) and data["id"]
        assert "password" not in data and "_id" not in data

    @pytest.mark.parametrize("old_secret", OLD_SECRETS)
    def test_token_signed_with_old_secret_rejected(self, old_secret):
        forged = jwt.encode(
            {"sub": str(uuid.uuid4()),
             "iat": datetime.now(timezone.utc),
             "exp": datetime.now(timezone.utc) + timedelta(hours=12)},
            old_secret, algorithm="HS256")
        r = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {forged}"}, timeout=30)
        assert r.status_code == 401, f"forged token accepted: {r.status_code} {r.text[:200]}"

    def test_bcrypt_hash_format(self):
        # verify stored password hashes use bcrypt $2b$
        import subprocess
        out = subprocess.run(
            ["mongosh", "--quiet", BACKEND_ENV.get("DB_NAME", "test_database"), "--eval",
             "JSON.stringify(db.users.findOne({}, {password:1, _id:0}))"],
            capture_output=True, text=True, timeout=60)
        assert out.returncode == 0, out.stderr[:300]
        pw = json.loads(out.stdout.strip()).get("password", "")
        assert pw.startswith("$2b$"), f"unexpected hash prefix: {pw[:7]}"

    def test_unauthenticated_me_401(self):
        assert requests.get(f"{API}/auth/me", timeout=30).status_code in (401, 403)


# ---------- Brute-force lockout (throwaway account only) ----------
class TestBruteForceLockout:
    def test_lockout_after_five_failures(self):
        import subprocess
        db_name = BACKEND_ENV.get("DB_NAME", "test_database")
        email = f"sectest_{uuid.uuid4().hex[:8]}@cortexa.ai"
        pw = "ThrowAway!23"
        reg = requests.post(f"{API}/auth/register",
                            json={"name": "Sec Test", "email": email, "password": pw}, timeout=60)
        assert reg.status_code == 200, reg.text[:300]
        try:
            # sanity: correct password works before lockout
            ok = requests.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=30)
            assert ok.status_code == 200, ok.text[:200]

            codes = []
            for _ in range(5):
                r = requests.post(f"{API}/auth/login", json={"email": email, "password": "wrong-pw"}, timeout=30)
                codes.append(r.status_code)
            assert codes[0] == 401, f"expected 401s, got {codes}"

            final = requests.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=30)
            assert final.status_code == 429, f"6th attempt (correct pw) should be 429, got {final.status_code} {final.text[:200]}"
            assert "too many failed attempts" in final.json().get("detail", "").lower()
        finally:
            subprocess.run(["mongosh", "--quiet", db_name, "--eval",
                            "db.login_attempts.deleteMany({})"], capture_output=True, text=True, timeout=60)
            subprocess.run(["mongosh", "--quiet", db_name, "--eval",
                            f'db.users.deleteMany({{email:"{email}"}}); db.agents.deleteMany({{}})' if False else
                            f'db.users.deleteMany({{email:"{email}"}})'],
                           capture_output=True, text=True, timeout=60)

    def test_main_account_not_locked_after_cleanup(self, creds):
        email, pw = creds
        r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=30)
        assert r.status_code == 200, f"main account login broken: {r.status_code} {r.text[:200]}"


# ---------- LLM rate limiter (in-process, no real LLM calls) ----------
class TestLlmRateLimiter:
    def test_check_llm_rate_raises_429_on_21st(self):
        sys.path.insert(0, "/app/backend")
        for k, v in BACKEND_ENV.items():
            os.environ.setdefault(k, v)
        import server
        from fastapi import HTTPException
        uid = f"rate-test-{uuid.uuid4().hex}"
        assert server.LLM_RATE_LIMIT == 20
        assert server.LLM_RATE_WINDOW == 300
        for i in range(20):
            server.check_llm_rate(uid)  # should not raise
        with pytest.raises(HTTPException) as exc:
            server.check_llm_rate(uid)
        assert exc.value.status_code == 429
        assert "rate limit" in str(exc.value.detail).lower()

    def test_rate_window_eviction(self):
        sys.path.insert(0, "/app/backend")
        import server
        uid = f"rate-window-{uuid.uuid4().hex}"
        old = time.time() - (server.LLM_RATE_WINDOW + 10)
        for _ in range(20):
            server._llm_calls[uid].append(old)
        server.check_llm_rate(uid)  # stale entries evicted -> no raise
        assert len(server._llm_calls[uid]) == 1


# ---------- Input validation + error redaction ----------
class TestChatValidation:
    def test_oversize_message_stream_422(self, auth):
        r = requests.post(f"{API}/chat/stream", headers=auth, json={"message": "a" * 4100}, timeout=60)
        assert r.status_code == 422, f"got {r.status_code}: {r.text[:200]}"

    def test_oversize_message_chat_422(self, auth):
        r = requests.post(f"{API}/chat", headers=auth, json={"message": "a" * 4100}, timeout=60)
        assert r.status_code == 422

    def test_empty_message_422(self, auth):
        r = requests.post(f"{API}/chat/stream", headers=auth, json={"message": ""}, timeout=60)
        assert r.status_code == 422

    def test_boundary_4000_accepted_and_streams(self, auth):
        # exactly at the cap must NOT be rejected by validation
        payload = {"message": "Reply with the single word OK. " + ("b" * (4000 - 31))}
        assert len(payload["message"]) == 4000
        with requests.post(f"{API}/chat/stream", headers=auth, json=payload,
                           stream=True, timeout=180) as r:
            assert r.status_code == 200, f"4000-char message rejected: {r.status_code} {r.text[:200]}"
            first = None
            for line in r.iter_lines():
                if line and line.startswith(b"data: "):
                    first = json.loads(line[6:])
                    break
            assert first and first["type"] == "session"

    def test_stream_happy_path_events(self, auth):
        events = []
        with requests.post(f"{API}/chat/stream", headers=auth,
                           json={"message": "Say hello in five words."},
                           stream=True, timeout=180) as r:
            assert r.status_code == 200
            assert "text/event-stream" in r.headers.get("content-type", "")
            for line in r.iter_lines():
                if line and line.startswith(b"data: "):
                    ev = json.loads(line[6:])
                    events.append(ev)
                    if ev["type"] == "done":
                        break
        types = [e["type"] for e in events]
        assert types[0] == "session" and types[-1] == "done", types
        deltas = [e for e in events if e["type"] == "delta"]
        assert len(deltas) >= 1
        text = "".join(d["text"] for d in deltas)
        assert len(text) > 0
        for e in events:
            if e["type"] == "error":
                pytest.fail(f"stream error event: {e}")

    def test_error_messages_are_redacted_in_source(self):
        src = Path("/app/backend/server.py").read_text()
        assert "Assistant temporarily unavailable" in src
        assert "detail=str(e)" not in src and 'detail=f"{e}' not in src
        assert 'str(e)' not in src.split("# ---------- Chat with Cortexa")[1], \
            "exception string still leaked in chat handlers"

    def test_stream_unauthenticated_401(self):
        r = requests.post(f"{API}/chat/stream", json={"message": "hi"}, timeout=30)
        assert r.status_code in (401, 403)


# ---------- CORS ----------
class TestCors:
    def test_credentials_disabled_for_wildcard_origin(self):
        r = requests.get(f"{API}/", headers={"Origin": "https://evil.example.com"}, timeout=30)
        assert r.status_code == 200
        acao = r.headers.get("access-control-allow-origin")
        acac = r.headers.get("access-control-allow-credentials")
        if BACKEND_ENV.get("CORS_ORIGINS", "*").strip() == "*":
            assert acac is None, f"allow_credentials must be off with wildcard CORS (got {acac}, origin={acao})"


# ---------- Regression with fresh token ----------
class TestRegression:
    def test_root(self):
        r = requests.get(f"{API}/", timeout=30)
        assert r.status_code == 200 and r.json()["status"] == "online"

    @pytest.mark.parametrize("path", ["agents", "tasks", "system/telemetry", "activity"])
    def test_authenticated_endpoints(self, auth, path):
        r = requests.get(f"{API}/{path}", headers=auth, timeout=60)
        assert r.status_code == 200, f"/{path} -> {r.status_code} {r.text[:200]}"
        data = r.json()
        if path == "system/telemetry":
            assert isinstance(data, dict) and data
        else:
            assert isinstance(data, list)
            for item in data:
                assert "_id" not in item

    @pytest.mark.parametrize("path", ["agents", "tasks", "system/telemetry", "activity"])
    def test_unauthenticated_endpoints_401(self, path):
        r = requests.get(f"{API}/{path}", timeout=30)
        assert r.status_code in (401, 403), f"/{path} unauth -> {r.status_code}"

    def test_bad_bearer_token_401(self):
        r = requests.get(f"{API}/agents", headers={"Authorization": "Bearer not.a.token"}, timeout=30)
        assert r.status_code == 401
