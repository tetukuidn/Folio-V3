from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from auth import get_current_user
from db import db

router = APIRouter(prefix="/api", tags=["data"])

EMPTY_SENDER = {"nama": "", "alamat": "", "telp": "", "kec": "", "kota": ""}


async def current_user(authorization: Optional[str] = Header(default=None)) -> dict:
    return await get_current_user(authorization)


class DataPayload(BaseModel):
    # Reject unknown keys: a misshaped body (e.g. {"data": {...}}) used to be
    # parsed as "all empty" and silently wipe the user's bookkeeping.
    model_config = {"extra": "forbid"}

    belanja: List[Dict[str, Any]] = Field(default_factory=list)
    suppliers: List[Dict[str, Any]] = Field(default_factory=list)
    pesanan: List[Dict[str, Any]] = Field(default_factory=list)
    sender: Dict[str, Any] = Field(default_factory=lambda: dict(EMPTY_SENDER))


class ProfilPayload(BaseModel):
    namaPemilik: str = ""
    namaToko: str = ""
    waToko: str = ""


def _default_profil(user: dict) -> dict:
    return {"namaPemilik": user.get("name") or "", "namaToko": "", "waToko": ""}


def _shape(doc: dict, user: dict) -> dict:
    return {
        "belanja": doc.get("belanja") or [],
        "suppliers": doc.get("suppliers") or [],
        "pesanan": doc.get("pesanan") or [],
        "sender": doc.get("sender") or dict(EMPTY_SENDER),
        "profil": doc.get("profil") or _default_profil(user),
    }


@router.get("/data")
async def get_data(user: dict = Depends(current_user)):
    doc = await db.app_data.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not doc:
        doc = {
            "user_id": user["user_id"],
            "belanja": [],
            "suppliers": [],
            "pesanan": [],
            "sender": dict(EMPTY_SENDER),
            "profil": _default_profil(user),
            "updated_at": datetime.now(timezone.utc),
        }
        await db.app_data.insert_one(dict(doc))
    return {"data": _shape(doc, user), "user": {
        "user_id": user["user_id"],
        "email": user["email"],
        "name": user.get("name") or "",
        "picture": user.get("picture") or "",
    }}


@router.put("/data")
async def put_data(payload: DataPayload, user: dict = Depends(current_user)):
    if len(payload.pesanan) > 5000 or len(payload.belanja) > 5000:
        raise HTTPException(status_code=413, detail="data_too_large")
    await db.app_data.update_one(
        {"user_id": user["user_id"]},
        {"$set": {
            "belanja": payload.belanja,
            "suppliers": payload.suppliers,
            "pesanan": payload.pesanan,
            "sender": payload.sender,
            "updated_at": datetime.now(timezone.utc),
        },
         "$setOnInsert": {"user_id": user["user_id"], "profil": _default_profil(user)}},
        upsert=True,
    )
    return {"ok": True}


@router.put("/profile")
async def put_profile(payload: ProfilPayload, user: dict = Depends(current_user)):
    profil = {
        "namaPemilik": payload.namaPemilik.strip(),
        "namaToko": payload.namaToko.strip(),
        "waToko": payload.waToko.strip(),
    }
    await db.app_data.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"profil": profil, "updated_at": datetime.now(timezone.utc)}},
        upsert=True,
    )
    return {"profil": profil}
