import logging

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from auth import router as auth_router
from data_routes import router as data_router
from db import client, ensure_indexes

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(data_router)


@app.get("/api/")
async def root():
    return {"message": "LPM API"}


@app.on_event("startup")
async def startup():
    try:
        await ensure_indexes()
    except Exception as exc:  # index creation must not block boot
        logger.warning("index setup failed: %s", exc)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
