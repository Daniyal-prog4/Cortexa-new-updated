# Cortexa Auth — Testing Notes (Bearer JWT, not cookies)

Cortexa uses **Authorization: Bearer <token>** headers (token stored in localStorage as `cortexa_token`).
It does NOT use httpOnly cookies or refresh tokens.

## Security hardening in place (post security-audit)
- `JWT_SECRET` is a strong random value in `backend/.env`; server **fails fast** if unset (no code fallback).
- Login brute-force lockout: 5 failed attempts per `{ip}:{email}` → HTTP 429 for 15 minutes (Mongo `login_attempts` collection, cleared on successful login).
- LLM rate limit: 20 chat calls per user per 5 minutes on `/api/chat` and `/api/chat/stream` → HTTP 429.
- Chat message capped at 4000 chars (422 on violation).
- LLM errors return generic messages (no stack/exception leakage) in both JSON and SSE error events.
- CORS: `allow_credentials` is disabled when `CORS_ORIGINS=*` (auth is header-based, cookies unused).

## Test commands
```
API_URL=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d '=' -f2)
# login (see /app/memory/test_credentials.md)
curl -s -X POST "$API_URL/api/auth/login" -H "Content-Type: application/json" -d '{"email":"daniyal@cortexa.ai","password":"CortexaPass!23"}'
# 5 bad passwords from same IP → 6th returns 429 even with correct password
# /api/auth/me with Bearer token returns user
```

NOTE: rotating JWT_SECRET invalidated all previously issued tokens — users must log in again.
