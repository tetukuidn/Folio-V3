import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from db import db

EMERGENT_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"
SESSION_DAYS = 7

router = APIRouter(prefix="/api/auth", tags=["auth"])


class SessionRequest(BaseModel):
    session_id: str


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


async def get_current_user(authorization: Optional[str] = Header(default=None)) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="not_authenticated")
    token = authorization.split(" ", 1)[1].strip()
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="invalid_session")
    if _aware(session["expires_at"]) < datetime.now(timezone.utc):
        await db.user_sessions.delete_one({"session_token": token})
        raise HTTPException(status_code=401, detail="session_expired")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="user_not_found")
    return user


def _public_user(user: dict) -> dict:
    return {
        "user_id": user["user_id"],
        "email": user["email"],
        "name": user.get("name") or "",
        "picture": user.get("picture") or "",
    }


@router.post("/session")
async def create_session(payload: SessionRequest):
    session_id = payload.session_id.strip()
    if not session_id:
        raise HTTPException(status_code=401, detail="missing_session_id")

    async with httpx.AsyncClient(timeout=20) as http:
        try:
            res = await http.get(EMERGENT_SESSION_URL, headers={"X-Session-ID": session_id})
        except httpx.HTTPError:
            raise HTTPException(status_code=401, detail="auth_provider_unreachable")
    if res.status_code != 200:
        raise HTTPException(status_code=401, detail="invalid_session_id")

    data = res.json()
    email = (data.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(status_code=401, detail="email_missing")
    session_token = data.get("session_token")
    if not session_token:
        raise HTTPException(status_code=401, detail="session_token_missing")

    now = datetime.now(timezone.utc)
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": data.get("name") or existing.get("name") or "",
                      "picture": data.get("picture") or existing.get("picture") or "",
                      "last_login": now}},
        )
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user = {
            "user_id": user_id,
            "email": email,
            "name": data.get("name") or "",
            "picture": data.get("picture") or "",
            "created_at": now,
            "last_login": now,
        }
        await db.users.insert_one(dict(user))

    await db.user_sessions.update_one(
        {"session_token": session_token},
        {"$set": {
            "session_token": session_token,
            "user_id": user_id,
            "expires_at": now + timedelta(days=SESSION_DAYS),
            "created_at": now,
        }},
        upsert=True,
    )

    return {"session_token": session_token, "user": _public_user(user)}


@router.get("/me")
async def me(authorization: Optional[str] = Header(default=None)):
    user = await get_current_user(authorization)
    return {"user": _public_user(user)}


@router.post("/logout")
async def logout(authorization: Optional[str] = Header(default=None)):
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}
