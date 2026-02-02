from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
from sqlmodel import SQLModel
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

# PostgreSQL Connection
POSTGRES_USER = os.getenv("POSTGRES_USER", "user")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "password")
POSTGRES_DB = os.getenv("POSTGRES_DB", "main_db")
POSTGRES_HOST = os.getenv("POSTGRES_HOST", "localhost")

# Note: Using asyncpg driver
DATABASE_URL = f"postgresql+asyncpg://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:5432/{POSTGRES_DB}"

# For Docker networking, if running inside container, host might be 'db'
if os.getenv("DATABASE_URL"):
    DATABASE_URL = os.getenv("DATABASE_URL").replace("postgresql://", "postgresql+asyncpg://")

engine = create_async_engine(DATABASE_URL, echo=True)
AsyncSessionLocal = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

async def get_db_session():
    async with AsyncSessionLocal() as session:
        yield session

async def init_db():
    async with engine.begin() as conn:
        # await conn.run_sync(SQLModel.metadata.drop_all) # WARNING: Dev only
        await conn.run_sync(SQLModel.metadata.create_all)
        # Minimal migration for new user status fields (avoid manual reset in dev DB)
        await conn.execute(text('ALTER TABLE "user" ADD COLUMN IF NOT EXISTS status_message text'))
        await conn.execute(text('ALTER TABLE "user" ADD COLUMN IF NOT EXISTS status_message_expires_at timestamp'))

# MongoDB Connection
MONGO_USER = os.getenv("MONGO_USER", "admin")
MONGO_PASSWORD = os.getenv("MONGO_PASSWORD", "password")
MONGO_HOST = os.getenv("MONGO_HOST", "localhost")
MONGO_URL = f"mongodb://{MONGO_USER}:{MONGO_PASSWORD}@{MONGO_HOST}:27017"

if os.getenv("MONGODB_URL"):
    MONGO_URL = os.getenv("MONGODB_URL")

mongo_client = AsyncIOMotorClient(MONGO_URL)
mongo_db = mongo_client["our_today"]

def get_mongo_db():
    return mongo_db
