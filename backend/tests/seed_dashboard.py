# Seeds test users + dashboard math data (users test-dash-ui / test-dash-reset)
import asyncio, os, sys
from datetime import datetime, timedelta, timezone
import requests
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
BASE = [l.split("=", 1)[1].strip().strip('"') for l in open("/app/frontend/.env") if l.startswith("EXPO_PUBLIC_BACKEND_URL=")][0].rstrip("/")
USERS = [("test-dash-ui", "test_dash_ui_token", "TEST Dash Google"), ("test-dash-reset", "test_dash_reset_token", "TEST Reset Google")]


async def mk():
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    now = datetime.now(timezone.utc)
    for uid, tok, name in USERS:
        await db.users.update_one({"user_id": uid}, {"$set": {"user_id": uid, "email": f"{uid}@example.com", "name": name, "picture": ""}}, upsert=True)
        await db.user_sessions.delete_many({"user_id": uid})
        await db.user_sessions.insert_one({"session_token": tok, "user_id": uid, "expires_at": now + timedelta(days=7), "created_at": now})


def iso(days):
    return (datetime.now(timezone.utc) - timedelta(days=days, minutes=1)).isoformat().replace("+00:00", "Z")


def order(i, days, items, transfer, ongkir, kar, ops, cod, kurir, berat):
    return {"id": f"p{i}", "tgl": iso(days), "nama": f"TEST_Buyer{i}", "wa": "", "alamat": "", "kota": "", "kec": "", "kodepos": "",
            "items": items, "paket": False, "transfer": transfer, "ongkir": ongkir, "karantina": kar, "ops": ops, "codOngkir": cod,
            "tipe": "PICKUP", "kurir": kurir, "layanan": "REG", "berat": berat, "status": "Dikirim"}


A = lambda n: {"jenis": "TEST_A", "jml": n, "hpp": 10000, "harga": 25000}
B = lambda n: {"jenis": "TEST_B", "jml": n, "hpp": 20000, "harga": 40000}
BODY = {
    "belanja": [
        {"id": "ba", "tgl": "2025-01-01", "jenis": "TEST_A", "sup": "", "jml": 6, "awal": 6, "harga": 10000, "jual": 25000},
        {"id": "bb", "tgl": "2025-01-01", "jenis": "TEST_B", "sup": "", "jml": 5, "awal": 5, "harga": 20000, "jual": 40000},
        {"id": "bc", "tgl": "2025-01-01", "jenis": "TEST_C", "sup": "", "jml": 10, "awal": 10, "harga": 5000, "jual": 9000},
    ],
    "rusak": [{"id": "r1", "tgl": "2025-02-01", "jenis": "TEST_A", "jml": 1, "harga": 10000, "ket": "x"},
              {"id": "r2", "tgl": "2025-02-01", "jenis": "TEST_C", "jml": 2, "harga": 5000, "ket": "x"}],
    "suppliers": [{"id": "s1", "nama": "TEST_Sup", "hp": "", "cat": ""}],
    "pesanan": [
        order(1, 0, [A(2)], 70000, 10000, 5000, 2000, False, "JNE", 1.5),
        order(2, 0, [B(1)], 50000, 15000, 0, 1000, True, "JNT", 2),
        order(3, 10, [A(1)], 30000, 8000, 2000, 0, False, "JNE", 0.5),
        order(4, 60, [B(3)], 100000, 0, 0, 5000, False, "SiCepat", 3),
        order(5, 200, [A(1)], 20000, 0, 0, 0, False, "JNE", 1),
    ],
    "sender": {"nama": "", "alamat": "", "telp": "", "kec": "", "kota": ""},
}

if __name__ == "__main__":
    asyncio.run(mk())
    for uid, tok, _ in USERS:
        h = {"Authorization": f"Bearer {tok}"}
        r = requests.put(f"{BASE}/api/data", json=BODY, headers=h); print(uid, "data", r.status_code, r.text[:120])
        r = requests.put(f"{BASE}/api/profile", json={"namaPemilik": "TEST Pemilik", "namaToko": "", "waToko": ""}, headers=h); print(uid, "profile", r.status_code)
