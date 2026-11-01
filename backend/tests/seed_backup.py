# Seeds user test-backup (token test_backup_token) with rich data covering all 8 lists + profil, for backup round-trip tests.
# Usage: python seed_backup.py [seed|empty|show]
import asyncio, json, os, sys
from datetime import datetime, timedelta, timezone
import requests
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
BASE = [l.split("=", 1)[1].strip().strip('"') for l in open("/app/frontend/.env") if l.startswith("EXPO_PUBLIC_BACKEND_URL=")][0].rstrip("/")
UID, TOK = "test-backup", "test_backup_token"
H = {"Authorization": f"Bearer {TOK}"}

ORDER_BASE = {"wa": "6281234", "alamat": "Jl. TEST 1", "kota": "Bandung", "kec": "Coblong", "kodepos": "40132", "paket": True,
              "ongkir": 15000, "karantina": 5000, "ops": 2000, "codOngkir": True, "tipe": "COD DROPOFF", "kurir": "JNE",
              "layanan": "REG", "berat": 2.5, "status": "Problem"}
SEED = {
    "belanja": [
        {"id": "TEST_b1", "tgl": "2025-12-01", "jenis": "TEST_Monstera", "sup": "TEST_s1", "jml": 7, "awal": 10, "harga": 15000, "jual": 35000, "hargaReseller": 28000},
        {"id": "TEST_b2", "tgl": "2025-12-05", "jenis": "TEST_Aglonema", "sup": "", "jml": 4, "awal": 5, "harga": 20000, "jual": 45000},
    ],
    "rusak": [{"id": "TEST_rk1", "tgl": "2025-12-10", "jenis": "TEST_Aglonema", "jml": 1, "harga": 20000, "ket": "busuk akar", "resellerId": "TEST_r1"}],
    "suppliers": [{"id": "TEST_s1", "nama": "TEST_Supplier Kebun", "hp": "62811111", "cat": "langganan"}],
    "pesanan": [{**ORDER_BASE, "id": "TEST_p1", "tgl": "2025-12-12T03:04:05.000Z", "nama": "TEST_Pembeli Ünïcode 🌿",
                 "items": [{"jenis": "TEST_Monstera", "jml": 2, "hpp": 15000, "harga": 30000, "hargaNormal": 35000}], "transfer": 60000}],
    "sender": {"nama": "TEST_Toko Hijau", "alamat": "Jl. Kirim 2", "telp": "62822222", "kec": "Sukajadi", "kota": "Bandung"},
    "resellers": [{"id": "TEST_r1", "nama": "TEST_Reseller A", "hp": "62833333", "cat": "", "aktif": True},
                  {"id": "TEST_r2", "nama": "TEST_Reseller B", "hp": "62844444", "cat": "nonaktif", "aktif": False}],
    "pesananReseller": [{**ORDER_BASE, "id": "TEST_pr1", "tgl": "2025-12-15T00:00:00.000Z", "nama": "TEST_Reseller A",
                         "items": [{"jenis": "TEST_Monstera", "jml": 1, "hpp": 15000, "harga": 28000}], "transfer": 28000,
                         "resellerId": "TEST_r1", "resellerNama": "TEST_Reseller A"}],
    "returReseller": [{"id": "TEST_rt1", "tgl": "2025-12-20", "resellerId": "TEST_r1", "jenis": "TEST_Monstera", "jml": 1, "hpp": 15000, "ket": "retur"}],
}
PROFIL = {"namaPemilik": "TEST_Pemilik", "namaToko": "TEST_Toko Folio", "waToko": "62855555"}
EMPTY = {"belanja": [], "rusak": [], "suppliers": [], "pesanan": [], "sender": {"nama": "", "alamat": "", "telp": "", "kec": "", "kota": ""},
         "resellers": [], "pesananReseller": [], "returReseller": []}


async def mk_user():
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    now = datetime.now(timezone.utc)
    await db.users.update_one({"user_id": UID}, {"$set": {"user_id": UID, "email": f"{UID}@example.com", "name": "TEST Backup", "picture": ""}}, upsert=True)
    await db.user_sessions.delete_many({"user_id": UID})
    await db.user_sessions.insert_one({"session_token": TOK, "user_id": UID, "expires_at": now + timedelta(days=7), "created_at": now})


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "seed"
    asyncio.run(mk_user())
    if mode == "seed":
        print(requests.put(f"{BASE}/api/data", headers=H, json=SEED).status_code, requests.put(f"{BASE}/api/profile", headers=H, json=PROFIL).status_code)
    elif mode == "empty":
        print(requests.put(f"{BASE}/api/data", headers=H, json=EMPTY).status_code,
              requests.put(f"{BASE}/api/profile", headers=H, json={"namaPemilik": "X", "namaToko": "", "waToko": ""}).status_code)
    else:
        print(json.dumps(requests.get(f"{BASE}/api/data", headers=H).json()["data"], ensure_ascii=False))
