"""
AURA backend entrypoint.

Run with:  backend/.venv/bin/uvicorn app.main:app --reload --port 8000
Docs at:   http://localhost:8000/docs
"""
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api import auth, dev, educator, parent, sessions, telemetry
from app.config import settings
from app.db import init_db

MEDIA_ROOT = Path(__file__).resolve().parent.parent / "media"
MEDIA_ROOT.mkdir(exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "app": settings.app_name}


app.mount("/media", StaticFiles(directory=MEDIA_ROOT), name="media")

app.include_router(auth.router)
app.include_router(parent.router)
app.include_router(educator.router)
app.include_router(sessions.router)
app.include_router(dev.router)
app.include_router(telemetry.router)
