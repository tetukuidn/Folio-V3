"""Reseller fields round-trip through /api/data (resellers, pesananReseller, returReseller, hargaReseller, rusak.resellerId)."""
import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("BACKEND_TEST_URL", "http://localhost:8001")


@pytest.fixture(scope="module")
def token():
    from dotenv import load_dotenv

    load_dotenv("/app/backend/.env")
    db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    uid = f"test_reseller_{uuid.uuid4().hex[:8]}"
    tok = f"tok_{uid}"
    db.users.insert_one({"user_id": uid, "email": f"{uid}@example.com", "name": "TEST Reseller", "picture": ""})
    db.user_sessions.insert_one(
        {
            "user_id": uid,
            "session_token": tok,
            "expires_at": datetime.now(timezone.utc) + timedelta(days=1),
            "created_at": datetime.now(timezone.utc),
        }
    )
    yield tok
    db.users.delete_one({"user_id": uid})
    db.user_sessions.delete_many({"user_id": uid})
    db.app_data.delete_one({"user_id": uid})


def _h(t):
    return {"Authorization": f"Bearer {t}"}


def test_new_user_has_empty_reseller_lists(token):
    d = requests.get(f"{BASE_URL}/api/data", headers=_h(token)).json()["data"]
    assert d["resellers"] == [] and d["pesananReseller"] == [] and d["returReseller"] == []


def test_reseller_roundtrip(token):
    payload = {
        "belanja": [{"id": "b1", "tgl": "2026-06-01", "jenis": "A", "sup": "", "jml": 10, "awal": 10, "harga": 10000, "jual": 20000, "hargaReseller": 15000}],
        "rusak": [{"id": "r1", "tgl": "2026-06-02", "jenis": "A", "jml": 1, "harga": 10000, "ket": "", "resellerId": "rs1"}],
        "suppliers": [],
        "pesanan": [],
        "sender": {"nama": "", "alamat": "", "telp": "", "kec": "", "kota": ""},
        "resellers": [{"id": "rs1", "nama": "TEST Res", "hp": "", "cat": "", "aktif": True}],
        "pesananReseller": [{"id": "pr1", "tgl": "2026-06-02", "items": [{"jenis": "A", "jml": 2, "hpp": 10000, "harga": 15000, "hargaNormal": 20000}], "resellerId": "rs1", "resellerNama": "TEST Res", "transfer": 30000}],
        "returReseller": [{"id": "rt1", "tgl": "2026-06-03", "resellerId": "rs1", "jenis": "A", "jml": 1, "hpp": 10000, "ket": ""}],
    }
    assert requests.put(f"{BASE_URL}/api/data", headers=_h(token), json=payload).status_code == 200
    d = requests.get(f"{BASE_URL}/api/data", headers=_h(token)).json()["data"]
    assert d["resellers"][0]["nama"] == "TEST Res"
    assert d["pesananReseller"][0]["items"][0]["hargaNormal"] == 20000
    assert d["returReseller"][0]["jml"] == 1
    assert d["belanja"][0]["hargaReseller"] == 15000
    assert d["rusak"][0]["resellerId"] == "rs1"


def test_old_payload_without_reseller_fields_still_ok(token):
    payload = {"belanja": [], "suppliers": [], "pesanan": [], "sender": {"nama": "", "alamat": "", "telp": "", "kec": "", "kota": ""}}
    assert requests.put(f"{BASE_URL}/api/data", headers=_h(token), json=payload).status_code == 200
    # reseller data from the previous test must survive an old-style payload
    d = requests.get(f"{BASE_URL}/api/data", headers=_h(token)).json()["data"]
    assert d["resellers"][0]["nama"] == "TEST Res"
    assert d["returReseller"][0]["jml"] == 1


def test_limit_applies_to_reseller_lists(token):
    big = [{"id": str(i)} for i in range(5001)]
    r = requests.put(f"{BASE_URL}/api/data", headers=_h(token), json={"pesananReseller": big})
    assert r.status_code == 413
