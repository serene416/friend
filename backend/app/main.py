import logging
import os
from fastapi import FastAPI, HTTPException, Request
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.db import init_db
from app.core.logging import configure_logging
# Import models to register them with metadata
from app.models.sql import (
    AITask,
    Friendship,
    Group,
    IngestionJob,
    IngestionJobItem,
    Invite,
    Place,
    PlaceIngestionFeature,
    User,
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize DB
    print("Starting up... Initializing DB")
    await init_db()
    yield
    # Shutdown: Disconnect DBs
    print("Shutting down...")

from app.routers import auth, friends, internal_ingestion, recommendation, users

configure_logging()
logger = logging.getLogger("app")

app = FastAPI(title="Our Today Activity API", lifespan=lifespan)

default_cors_origins = [
    "http://localhost:19000",
    "http://localhost:19006",
    "http://localhost:3000",
    "http://localhost:8081",
    "http://127.0.0.1:19000",
    "http://127.0.0.1:19006",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:8081",
]
extra_cors_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]
allow_origins = list(dict.fromkeys(default_cors_origins + extra_cors_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_origin_regex=r"https://.*\.ngrok(-free)?\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1/auth", tags=["Auth"])
app.include_router(friends.router, prefix="/api/v1/friends", tags=["Friends"])
app.include_router(recommendation.router, prefix="/api/v1/recommend", tags=["Recommendation"])
app.include_router(
    internal_ingestion.router,
    prefix="/api/v1/internal/ingestion",
    tags=["Internal Ingestion"],
)
app.include_router(users.router, prefix="/api/v1/users", tags=["Users"])

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    logger.warning(
        "HTTP %s on %s %s: %s",
        exc.status_code,
        request.method,
        request.url.path,
        exc.detail,
    )
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal Server Error"})

@app.get("/")
async def root():
    return {"message": "Welcome to the Friends' Activity Recommendation App API"}

@app.get("/health")
async def health_check():
    return {"status": "ok"}
