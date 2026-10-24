"""Extra regression tests: unauthenticated access to profile/data, payload validation, expired sessions."""
import asyncio
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

TOKEN = 'TEST_extra_token_789'
EXPIRED = 'TEST_expired_token_000'
USER_ID = 'user_qaextra00001'
EMAIL = 'TEST_extra.lpm@example.com'.lower()


@pytest.fixture(scope='module', autouse=True)
def seed():
    async def setup():
        db = AsyncIOMotorClient(MONGO_URL)[DB_NAME]
        now = datetime.now(timezone.utc)
        await db.users.update_one({'user_id': USER_ID}, {'$set': {'user_id': USER_ID, 'email': EMAIL, 'name': 'QA Extra', 'picture': ''}}, upsert=True)
        await db.user_sessions.update_one({'session_token': TOKEN}, {'$set': {'session_token': TOKEN, 'user_id': USER_ID, 'expires_at': now + timedelta(days=7), 'created_at': now}}, upsert=True)
        await db.user_sessions.update_one({'session_token': EXPIRED}, {'$set': {'session_token': EXPIRED, 'user_id': USER_ID, 'expires_at': now - timedelta(days=1), 'created_at': now}}, upsert=True)
        await db.app_data.delete_one({'user_id': USER_ID})

    async def teardown():
        db = AsyncIOMotorClient(MONGO_URL)[DB_NAME]
        await db.users.delete_one({'user_id': USER_ID})
        await db.user_sessions.delete_many({'user_id': USER_ID})
        await db.app_data.delete_one({'user_id': USER_ID})

    asyncio.run(setup())
    yield
    asyncio.run(teardown())


def H(t):
    return {'Authorization': f'Bearer {t}'}


# Unauthenticated access to protected routes
def test_get_data_no_token():
    assert requests.get(f'{BASE_URL}/api/data').status_code == 401


def test_put_data_no_token():
    r = requests.put(f'{BASE_URL}/api/data', json={'belanja': [], 'suppliers': [], 'pesanan': [], 'sender': {}})
    assert r.status_code == 401


def test_put_profile_no_token():
    r = requests.put(f'{BASE_URL}/api/profile', json={'namaPemilik': 'x'})
    assert r.status_code == 401


def test_malformed_auth_header():
    assert requests.get(f'{BASE_URL}/api/auth/me', headers={'Authorization': 'Token abc'}).status_code == 401


# Expired session rejected
def test_expired_session_rejected():
    r = requests.get(f'{BASE_URL}/api/auth/me', headers=H(EXPIRED))
    assert r.status_code == 401
    assert r.json()['detail'] == 'session_expired'


# Payload validation: extra keys forbidden (protects against data wipe)
def test_put_data_rejects_wrapped_payload():
    r = requests.put(f'{BASE_URL}/api/data', headers=H(TOKEN), json={'data': {'belanja': []}})
    assert r.status_code == 422


# Profile strips whitespace and persists; data save does not overwrite profile
def test_profile_then_data_roundtrip():
    r = requests.put(f'{BASE_URL}/api/profile', headers=H(TOKEN), json={'namaPemilik': '  TEST Owner ', 'namaToko': 'TEST Shop', 'waToko': '0811'})
    assert r.status_code == 200
    assert r.json()['profil']['namaPemilik'] == 'TEST Owner'
    r = requests.put(f'{BASE_URL}/api/data', headers=H(TOKEN), json={'belanja': [{'id': 'x', 'jenis': 'TEST_Aglo'}], 'suppliers': [], 'pesanan': [], 'sender': {'nama': 'S'}})
    assert r.status_code == 200
    d = requests.get(f'{BASE_URL}/api/data', headers=H(TOKEN)).json()['data']
    assert d['profil']['namaToko'] == 'TEST Shop'
    assert d['belanja'][0]['jenis'] == 'TEST_Aglo'
    assert d['sender']['nama'] == 'S'


def test_session_missing_body():
    assert requests.post(f'{BASE_URL}/api/auth/session', json={}).status_code == 422
