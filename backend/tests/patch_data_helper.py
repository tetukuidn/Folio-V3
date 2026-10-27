# Helper for UI tests: GET/patch /api/data for token test_dash_ui_token. Usage: python patch_data_helper.py <action>
import sys, json, requests

BASE = [l.split("=", 1)[1].strip() for l in open("/app/frontend/.env") if l.startswith("EXPO_PUBLIC_BACKEND_URL=")][0].rstrip("/")
H = {"Authorization": "Bearer test_dash_ui_token"}
KEYS = ("belanja", "suppliers", "pesanan", "sender", "rusak", "resellers", "pesananReseller", "returReseller")


def get():
    return requests.get(f"{BASE}/api/data", headers=H).json()["data"]


def put(d):
    r = requests.put(f"{BASE}/api/data", headers=H, json={k: d[k] for k in KEYS if k in d})
    print("PUT", r.status_code)


act = sys.argv[1]
d = get()
if act == "retur2":
    for r in d["returReseller"]:
        r["jml"] = 2
    put(d)
elif act == "show":
    print("pesananReseller", [(p["id"], p["status"]) for p in d.get("pesananReseller", [])])
    print("returReseller", [(r["id"], r["jml"]) for r in d.get("returReseller", [])])
    print("pesanan", len(d["pesanan"]), "belanja", [(b["id"], b["jenis"], b["jual"]) for b in d["belanja"]])
elif act.startswith("jual:"):
    _, bid, val = act.split(":")
    for b in d["belanja"]:
        if b["id"] == bid:
            b["jual"] = int(val)
    put(d)
