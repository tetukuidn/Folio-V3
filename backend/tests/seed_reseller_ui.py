# Seeds reseller data on top of seed_dashboard.py data for UI retest (token test_dash_ui_token)
import os, subprocess, sys, requests
from datetime import datetime, timezone, timedelta

def env_url():
    for line in open("/app/frontend/.env"):
        if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
            return line.split("=", 1)[1].strip().strip('"').rstrip("/")

BASE = env_url()
H = {"Authorization": "Bearer test_dash_ui_token"}
subprocess.run([sys.executable, "/app/backend/tests/seed_dashboard.py"], check=True)
d = requests.get(f"{BASE}/api/data", headers=H).json()["data"]
jenis = sorted({b["jenis"] for b in d["belanja"]})
print("jenis:", jenis)
j0 = jenis[0]
iso = lambda days: (datetime.now(timezone.utc) - timedelta(days=days)).isoformat().replace("+00:00", "Z")
d["resellers"] = [{"id": "TEST_r1", "nama": "TEST_Reseller Satu", "hp": "6281200000001", "cat": "", "aktif": True}]
base = {"wa": "", "alamat": "", "kota": "", "kec": "", "kodepos": "", "paket": False, "ongkir": 0, "karantina": 0,
        "ops": 0, "codOngkir": False, "tipe": "PICKUP", "kurir": "", "layanan": "", "berat": 1, "status": "Dikirim",
        "resellerId": "TEST_r1", "resellerNama": "TEST_Reseller Satu"}
# two sales of 2 pohon each of j0 (total sold 4); retur 3 -> deleting either sale must be blocked (3 > 4-2)
d["pesananReseller"] = [
    {**base, "id": "TEST_pr1", "tgl": iso(1), "nama": "TEST_Reseller Satu", "items": [{"jenis": j0, "jml": 2, "hpp": 10000, "harga": 20000}], "transfer": 40000},
    {**base, "id": "TEST_pr2", "tgl": iso(2), "nama": "TEST_Reseller Satu", "items": [{"jenis": j0, "jml": 2, "hpp": 10000, "harga": 20000}], "transfer": 40000},
]
d["returReseller"] = [{"id": "TEST_rt1", "tgl": iso(0), "resellerId": "TEST_r1", "jenis": j0, "jml": 4, "hpp": 10000, "ket": "TEST"}]
d.setdefault("rusak", [])
payload = {k: d[k] for k in ("belanja", "suppliers", "pesanan", "sender", "rusak", "resellers", "pesananReseller", "returReseller") if k in d}
r = requests.put(f"{BASE}/api/data", headers=H, json=payload)
print("PUT", r.status_code, r.text, "j0=", j0)
