# Tests for the "rusak" (Keluar/rusak stok) field on /api/data
# Sessions are created by /tmp/mk_session.py style seeding (users test-rusak-api / test-rusak-legacy)
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("EXPO_PUBLIC_BACKEND_URL=") or line.startswith("EXPO_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().strip('"')
BASE_URL = BASE_URL.rstrip("/")

API_TOKEN = "test_rusak_api_token"
LEGACY_TOKEN = "test_rusak_legacy_token"


def h(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


BELANJA = [
    {"id": "b_old", "tgl": "2025-01-01", "jenis": "TEST_Aglo", "sup": "", "jml": 5, "awal": 5, "harga": 1000, "jual": 2000},
    {"id": "b_new", "tgl": "2025-02-01", "jenis": "TEST_Aglo", "sup": "", "jml": 5, "awal": 5, "harga": 3000, "jual": 4000},
]
RUSAK = [{"id": "r1", "tgl": "2025-03-01", "jenis": "TEST_Aglo", "jml": 2, "harga": 1000, "ket": "busuk akar"}]
SENDER = {"nama": "", "alamat": "", "telp": "", "kec": "", "kota": ""}


# Rusak field persistence
class TestRusakField:
    def test_unauth_get(self):
        r = requests.get(f"{BASE_URL}/api/data")
        assert r.status_code == 401

    def test_new_user_has_empty_rusak(self):
        # fresh doc: delete existing app_data for this test user first
        from pymongo import MongoClient
        from dotenv import dotenv_values
        env = dotenv_values("/app/backend/.env")
        MongoClient(env["MONGO_URL"])[env["DB_NAME"]].app_data.delete_many({"user_id": "test-rusak-api"})
        r = requests.get(f"{BASE_URL}/api/data", headers=h(API_TOKEN))
        assert r.status_code == 200
        assert r.json()["data"]["rusak"] == []

    def test_put_rusak_and_get(self):
        body = {"belanja": BELANJA, "rusak": RUSAK, "suppliers": [], "pesanan": [], "sender": SENDER}
        r = requests.put(f"{BASE_URL}/api/data", json=body, headers=h(API_TOKEN))
        assert r.status_code == 200 and r.json() == {"ok": True}
        g = requests.get(f"{BASE_URL}/api/data", headers=h(API_TOKEN)).json()["data"]
        assert g["rusak"] == RUSAK
        assert len(g["belanja"]) == 2
        assert "_id" not in g

    def test_put_without_rusak_keeps_existing(self):
        # Older clients omit `rusak`; existing rusak data must be preserved, not wiped.
        seed = {"belanja": BELANJA, "rusak": [{"id": "rk1", "tgl": "2026-06-01", "jenis": "x", "jml": 1, "harga": 1, "ket": ""}], "suppliers": [], "pesanan": [], "sender": SENDER}
        assert requests.put(f"{BASE_URL}/api/data", json=seed, headers=h(API_TOKEN)).status_code == 200
        body = {"belanja": BELANJA, "suppliers": [], "pesanan": [], "sender": SENDER}
        r = requests.put(f"{BASE_URL}/api/data", json=body, headers=h(API_TOKEN))
        assert r.status_code == 200
        g = requests.get(f"{BASE_URL}/api/data", headers=h(API_TOKEN)).json()["data"]
        assert [x["id"] for x in g["rusak"]] == ["rk1"]

    def test_rusak_wrong_type_rejected(self):
        body = {"belanja": [], "rusak": "notalist", "suppliers": [], "pesanan": [], "sender": SENDER}
        r = requests.put(f"{BASE_URL}/api/data", json=body, headers=h(API_TOKEN))
        assert r.status_code == 422

    def test_extra_key_rejected(self):
        r = requests.put(f"{BASE_URL}/api/data", json={"data": {"rusak": []}}, headers=h(API_TOKEN))
        assert r.status_code == 422

    def test_too_many_rusak_413(self):
        body = {"rusak": [{"id": str(i)} for i in range(5001)]}
        r = requests.put(f"{BASE_URL}/api/data", json=body, headers=h(API_TOKEN))
        assert r.status_code == 413

    def test_legacy_doc_returns_empty_rusak(self):
        r = requests.get(f"{BASE_URL}/api/data", headers=h(LEGACY_TOKEN))
        assert r.status_code == 200
        d = r.json()["data"]
        assert d["rusak"] == []
        assert d["belanja"][0]["jenis"] == "X"

    def test_profile_put_keeps_rusak(self):
        body = {"belanja": BELANJA, "rusak": RUSAK, "suppliers": [], "pesanan": [], "sender": SENDER}
        requests.put(f"{BASE_URL}/api/data", json=body, headers=h(API_TOKEN))
        p = requests.put(f"{BASE_URL}/api/profile", json={"namaPemilik": "TEST", "namaToko": "T", "waToko": ""}, headers=h(API_TOKEN))
        assert p.status_code == 200
        g = requests.get(f"{BASE_URL}/api/data", headers=h(API_TOKEN)).json()["data"]
        assert g["rusak"] == RUSAK
        assert g["profil"]["namaPemilik"] == "TEST"
