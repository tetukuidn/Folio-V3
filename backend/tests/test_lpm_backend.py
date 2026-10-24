"""Backend tests for LPM (Expo mobile app, FastAPI backend).

Covers auth, data CRUD, profile, and critical cross-account isolation.
"""
import os
from datetime import datetime, timedelta, timezone

import pytest
import requests
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv('/app/backend/.env')
load_dotenv('/app/frontend/.env')

BASE_URL = os.environ['EXPO_PUBLIC_BACKEND_URL'].rstrip('/')
MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']

TOKEN_1 = 'qa-token-123'
USER_1_ID = 'user_qa0000000001'
USER_1_EMAIL = 'qa.lpm@example.com'

TOKEN_2 = 'qa-token-456'
USER_2_ID = 'user_qa0000000002'
USER_2_EMAIL = 'qa2.lpm@example.com'


# ---------- fixtures ----------
@pytest.fixture(scope='session')
def session():
    s = requests.Session()
    s.headers['Content-Type'] = 'application/json'
    return s


def _auth(token):
    return {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}


@pytest.fixture(scope='session', autouse=True)
def seed_qa_users():
    """Seed two QA users directly in Mongo (bypassing Google OAuth) and clean up after."""
    import asyncio

    async def setup():
        db = AsyncIOMotorClient(MONGO_URL)[DB_NAME]
        now = datetime.now(timezone.utc)
        # user 1
        await db.users.update_one(
            {'email': USER_1_EMAIL},
            {'$set': {'user_id': USER_1_ID, 'email': USER_1_EMAIL, 'name': 'QA Tester', 'picture': '', 'last_login': now},
             '$setOnInsert': {'created_at': now}},
            upsert=True,
        )
        await db.user_sessions.update_one(
            {'session_token': TOKEN_1},
            {'$set': {'session_token': TOKEN_1, 'user_id': USER_1_ID, 'expires_at': now + timedelta(days=7), 'created_at': now}},
            upsert=True,
        )
        # user 2
        await db.users.update_one(
            {'email': USER_2_EMAIL},
            {'$set': {'user_id': USER_2_ID, 'email': USER_2_EMAIL, 'name': 'QA Tester 2', 'picture': '', 'last_login': now},
             '$setOnInsert': {'created_at': now}},
            upsert=True,
        )
        await db.user_sessions.update_one(
            {'session_token': TOKEN_2},
            {'$set': {'session_token': TOKEN_2, 'user_id': USER_2_ID, 'expires_at': now + timedelta(days=7), 'created_at': now}},
            upsert=True,
        )
        # start from clean app_data
        await db.app_data.delete_one({'user_id': USER_1_ID})
        await db.app_data.delete_one({'user_id': USER_2_ID})

    asyncio.run(setup())
    yield


@pytest.fixture()
def re_seed_token1():
    """Re-seed token 1 (used after logout tests)."""
    import asyncio

    async def _run():
        db = AsyncIOMotorClient(MONGO_URL)[DB_NAME]
        now = datetime.now(timezone.utc)
        await db.user_sessions.update_one(
            {'session_token': TOKEN_1},
            {'$set': {'session_token': TOKEN_1, 'user_id': USER_1_ID, 'expires_at': now + timedelta(days=7), 'created_at': now}},
            upsert=True,
        )

    asyncio.run(_run())


# ---------- auth ----------
class TestAuth:
    def test_root(self, session):
        r = session.get(f'{BASE_URL}/api/')
        assert r.status_code == 200
        assert r.json().get('message') == 'LPM API'

    def test_me_no_header(self, session):
        r = session.get(f'{BASE_URL}/api/auth/me')
        assert r.status_code == 401

    def test_me_bad_token(self, session):
        r = session.get(f'{BASE_URL}/api/auth/me', headers=_auth('does-not-exist-xyz'))
        assert r.status_code == 401

    def test_me_valid_token(self, session):
        r = session.get(f'{BASE_URL}/api/auth/me', headers=_auth(TOKEN_1))
        assert r.status_code == 200
        body = r.json()
        assert body['user']['email'] == USER_1_EMAIL
        assert body['user']['user_id'] == USER_1_ID

    def test_session_rejects_fake_id(self, session):
        r = session.post(f'{BASE_URL}/api/auth/session', json={'session_id': 'fake-session-id-not-real-xyz'})
        assert r.status_code == 401

    def test_session_rejects_empty_id(self, session):
        r = session.post(f'{BASE_URL}/api/auth/session', json={'session_id': ''})
        assert r.status_code == 401


# ---------- data CRUD ----------
class TestData:
    def test_get_creates_empty_for_new_user(self, session):
        r = session.get(f'{BASE_URL}/api/data', headers=_auth(TOKEN_1))
        assert r.status_code == 200
        body = r.json()
        for k in ('belanja', 'suppliers', 'pesanan', 'sender', 'profil'):
            assert k in body['data']
        assert body['data']['belanja'] == []
        assert body['data']['suppliers'] == []
        assert body['data']['pesanan'] == []
        assert isinstance(body['data']['sender'], dict)
        assert body['user']['email'] == USER_1_EMAIL

    def test_put_data_persists(self, session):
        payload = {
            'belanja': [{'id': 'b1', 'jenis': 'Aglonema Red', 'jml': 5, 'awal': 2, 'harga': 10000}],
            'suppliers': [{'id': 's1', 'nama': 'TEST_Supplier A', 'wa': '0812', 'alamat': 'Jakarta'}],
            'pesanan': [{'id': 'p1', 'tgl': '2026-01-01T00:00:00.000Z', 'items': [{'jenis': 'Aglonema Red', 'jml': 1, 'hpp': 10000, 'harga': 20000}], 'kurir': 'JNE', 'berat': 1.0}],
            'sender': {'nama': 'TEST Sender', 'alamat': 'Jl A', 'telp': '08', 'kec': 'K', 'kota': 'J'},
        }
        r = session.put(f'{BASE_URL}/api/data', headers=_auth(TOKEN_1), json=payload)
        assert r.status_code == 200
        assert r.json().get('ok') is True

        r2 = session.get(f'{BASE_URL}/api/data', headers=_auth(TOKEN_1))
        assert r2.status_code == 200
        d = r2.json()['data']
        assert len(d['belanja']) == 1 and d['belanja'][0]['jenis'] == 'Aglonema Red'
        assert len(d['suppliers']) == 1 and d['suppliers'][0]['nama'] == 'TEST_Supplier A'
        assert len(d['pesanan']) == 1 and d['pesanan'][0]['id'] == 'p1'
        assert d['sender']['nama'] == 'TEST Sender'

    def test_put_profile_shows_in_data(self, session):
        r = session.put(
            f'{BASE_URL}/api/profile',
            headers=_auth(TOKEN_1),
            json={'namaPemilik': 'TEST Pemilik', 'namaToko': 'TEST Toko', 'waToko': '08123456789'},
        )
        assert r.status_code == 200
        assert r.json()['profil']['namaPemilik'] == 'TEST Pemilik'

        r2 = session.get(f'{BASE_URL}/api/data', headers=_auth(TOKEN_1))
        prof = r2.json()['data']['profil']
        assert prof['namaPemilik'] == 'TEST Pemilik'
        assert prof['namaToko'] == 'TEST Toko'
        assert prof['waToko'] == '08123456789'


# ---------- data isolation across accounts ----------
class TestIsolation:
    def test_user2_sees_own_empty_data(self, session):
        r = session.get(f'{BASE_URL}/api/data', headers=_auth(TOKEN_2))
        assert r.status_code == 200
        assert r.json()['user']['email'] == USER_2_EMAIL
        assert r.json()['data']['belanja'] == []
        assert r.json()['data']['pesanan'] == []

    def test_user2_write_isolated_from_user1(self, session):
        payload = {
            'belanja': [{'id': 'bU2', 'jenis': 'Aglonema User2', 'jml': 99, 'awal': 0, 'harga': 5000}],
            'suppliers': [{'id': 'sU2', 'nama': 'TEST_U2_Supplier'}],
            'pesanan': [],
            'sender': {'nama': 'TEST U2 Sender', 'alamat': '', 'telp': '', 'kec': '', 'kota': ''},
        }
        r = session.put(f'{BASE_URL}/api/data', headers=_auth(TOKEN_2), json=payload)
        assert r.status_code == 200

        # user2 sees its own data
        r2 = session.get(f'{BASE_URL}/api/data', headers=_auth(TOKEN_2))
        d2 = r2.json()['data']
        assert any(b['jenis'] == 'Aglonema User2' for b in d2['belanja'])

        # user1 does NOT see user2 data
        r1 = session.get(f'{BASE_URL}/api/data', headers=_auth(TOKEN_1))
        d1 = r1.json()['data']
        assert all(b.get('jenis') != 'Aglonema User2' for b in d1['belanja'])
        assert all(s.get('nama') != 'TEST_U2_Supplier' for s in d1['suppliers'])
        # user1 still has its own data from previous test
        assert any(b.get('jenis') == 'Aglonema Red' for b in d1['belanja'])

    def test_random_token_rejected(self, session):
        r = session.get(f'{BASE_URL}/api/data', headers=_auth('completely-random-token-abc'))
        assert r.status_code == 401
        r2 = session.put(f'{BASE_URL}/api/data', headers=_auth('completely-random-token-abc'), json={'belanja': [], 'suppliers': [], 'pesanan': [], 'sender': {}})
        assert r2.status_code == 401


# ---------- logout ----------
class TestLogout:
    def test_logout_invalidates_token_and_reseed(self, session, re_seed_token1):
        # Use user2's token to test logout so we don't lock out other tests ordering
        r = session.post(f'{BASE_URL}/api/auth/logout', headers=_auth(TOKEN_2))
        assert r.status_code == 200
        r2 = session.get(f'{BASE_URL}/api/auth/me', headers=_auth(TOKEN_2))
        assert r2.status_code == 401
        # re_seed_token1 fixture already ensures token1 is valid for frontend tests after.
        r3 = session.get(f'{BASE_URL}/api/auth/me', headers=_auth(TOKEN_1))
        assert r3.status_code == 200
