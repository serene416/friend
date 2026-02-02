import logging
from fastapi import FastAPI, HTTPException, Request
from contextlib import asynccontextmanager
from fastapi.responses import JSONResponse

from app.core.db import init_db
from app.core.logging import configure_logging
# Import models to register them with metadata
from app.models.sql import User, Place, Friendship, Group, AITask, Invite

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize DB
    print("Starting up... Initializing DB")
    await init_db()
    yield
    # Shutdown: Disconnect DBs
    print("Shutting down...")

from app.routers import auth, friends, recommendation, users

configure_logging()
logger = logging.getLogger("app")

app = FastAPI(title="Our Today Activity API", lifespan=lifespan)

app.include_router(auth.router, prefix="/api/v1/auth", tags=["Auth"])
app.include_router(friends.router, prefix="/api/v1/friends", tags=["Friends"])
app.include_router(recommendation.router, prefix="/api/v1/recommend", tags=["Recommendation"])
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
