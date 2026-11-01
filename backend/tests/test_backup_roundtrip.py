# Backup/restore round-trip at the API level: a Folio backup's data must be accepted by PUT /api/data and come back exactly.
import os, sys, copy
import pytest, requests

sys.path.insert(0, os.path.dirname(__file__))
import asyncio
import seed_backup as sb

BASE = sb.BASE
H = sb.H


@pytest.fixture(scope="module", autouse=True)
def user():
    asyncio.run(sb.mk_user())
    yield
    requests.put(f"{BASE}/api/data", headers=H, json=sb.SEED)
    requests.put(f"{BASE}/api/profile", headers=H, json=sb.PROFIL)


def get():
    r = requests.get(f"{BASE}/api/data", headers=H)
    assert r.status_code == 200
    return r.json()["data"]


# Seed -> GET equals seed exactly (all lists + optional fields)
def test_seed_exact():
    assert requests.put(f"{BASE}/api/data", headers=H, json=sb.SEED).status_code == 200
    assert requests.put(f"{BASE}/api/profile", headers=H, json=sb.PROFIL).status_code == 200
    d = get()
    for k, v in sb.SEED.items():
        assert d[k] == v, k
    assert d["profil"] == sb.PROFIL
    assert d["belanja"][0]["hargaReseller"] == 28000
    assert d["rusak"][0]["resellerId"] == "TEST_r1"


# Simulate backup (snapshot) -> wipe -> restore (PUT snapshot) -> exact equality
def test_roundtrip_after_wipe():
    snap = get()
    backup = {"app": "folio", "version": 1, "data": {k: snap[k] for k in sb.EMPTY}, "profil": snap["profil"]}
    assert requests.put(f"{BASE}/api/data", headers=H, json=sb.EMPTY).status_code == 200
    requests.put(f"{BASE}/api/profile", headers=H, json={"namaPemilik": "", "namaToko": "", "waToko": ""})
    wiped = get()
    assert wiped["belanja"] == [] and wiped["returReseller"] == []
    assert requests.put(f"{BASE}/api/data", headers=H, json=backup["data"]).status_code == 200
    assert requests.put(f"{BASE}/api/profile", headers=H, json=backup["profil"]).status_code == 200
    after = get()
    assert after == snap


# Restore must send only known keys: backup wrapper / extra keys rejected (extra=forbid)
def test_wrapper_rejected():
    before = get()
    r = requests.put(f"{BASE}/api/data", headers=H, json={"app": "folio", "data": sb.SEED})
    assert r.status_code == 422
    assert get() == before


def test_profil_key_rejected_in_data():
    body = copy.deepcopy(sb.SEED)
    body["profil"] = sb.PROFIL
    assert requests.put(f"{BASE}/api/data", headers=H, json=body).status_code == 422


def test_unauth():
    assert requests.put(f"{BASE}/api/data", json=sb.SEED).status_code == 401
