from fastapi import FastAPI
from contextlib import asynccontextmanager

from app.core.db import init_db
# Import models to register them with metadata
from app.models.sql import User, Place, Friendship, Group, AITask

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize DB
    print("Starting up... Initializing DB")
    await init_db()
    yield
    # Shutdown: Disconnect DBs
    print("Shutting down...")

from app.routers import auth, friends, recommendation

app = FastAPI(title="Our Today Activity API", lifespan=lifespan)

app.include_router(auth.router, prefix="/api/v1/auth", tags=["Auth"])
app.include_router(friends.router, prefix="/api/v1/friends", tags=["Friends"])
app.include_router(recommendation.router, prefix="/api/v1/recommend", tags=["Recommendation"])

@app.get("/")
async def root():
    return {"message": "Welcome to the Friends' Activity Recommendation App API"}

@app.get("/health")
async def health_check():
    return {"status": "ok"}
