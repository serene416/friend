import asyncio
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime

from dotenv import load_dotenv
from fastapi import FastAPI
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from models import AITask, AITaskStatus

load_dotenv()

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "WARNING").upper(),
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("ai.worker")

POSTGRES_USER = os.getenv("POSTGRES_USER", "user")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "password")
POSTGRES_DB = os.getenv("POSTGRES_DB", "main_db")
POSTGRES_HOST = os.getenv("POSTGRES_HOST", "db")

DATABASE_URL = f"postgresql+asyncpg://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:5432/{POSTGRES_DB}"

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

POLL_INTERVAL_SECONDS = float(os.getenv("AI_POLL_INTERVAL_SECONDS", "5"))


async def process_task(task: AITask) -> dict:
    """Simulate GPU task processing."""
    await asyncio.sleep(2)
    return {
        "score": 0.95,
        "processed_by": "gpu_worker_1",
        "result_vector": [0.1, 0.2, 0.3],
        "processed_at": datetime.utcnow().isoformat(),
    }


async def _fetch_and_mark_processing(session: AsyncSession) -> AITask | None:
    async with session.begin():
        stmt = (
            select(AITask)
            .where(AITask.status == AITaskStatus.PENDING)
            .limit(1)
            .with_for_update(skip_locked=True)
        )
        result = await session.execute(stmt)
        task = result.scalar_one_or_none()
        if task is None:
            return None

        task.status = AITaskStatus.PROCESSING
    return task


async def _save_task_result(session: AsyncSession, task: AITask) -> None:
    async with session.begin():
        stmt = (
            update(AITask)
            .where(AITask.id == task.id)
            .values(
                status=task.status,
                result=task.result,
                updated_at=datetime.utcnow(),
            )
        )
        await session.execute(stmt)


async def worker_loop() -> None:
    logger.warning("AI polling worker started")
    while True:
        try:
            async with AsyncSessionLocal() as session:
                task = await _fetch_and_mark_processing(session)
                if task is None:
                    await asyncio.sleep(POLL_INTERVAL_SECONDS)
                    continue

                try:
                    output = await process_task(task)
                    task.result = output
                    task.status = AITaskStatus.COMPLETED
                except Exception as exc:
                    logger.exception("AI task failed: task_id=%s", task.id)
                    task.result = {"error": str(exc)}
                    task.status = AITaskStatus.FAILED

                await _save_task_result(session, task)
        except Exception:
            logger.exception("AI worker loop error")
            await asyncio.sleep(POLL_INTERVAL_SECONDS)


@asynccontextmanager
async def lifespan(_: FastAPI):
    worker_task = asyncio.create_task(worker_loop())
    try:
        yield
    finally:
        worker_task.cancel()
        try:
            await worker_task
        except asyncio.CancelledError:
            pass


app = FastAPI(title="AI Model Service", lifespan=lifespan)


@app.get("/")
async def root() -> dict[str, str]:
    return {"message": "AI Service Running & Polling"}
