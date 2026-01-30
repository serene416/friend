import asyncio
import os
from fastapi import FastAPI
from contextlib import asynccontextmanager
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, update
from models import AITask, AITaskStatus
from dotenv import load_dotenv

load_dotenv()

# Database Setup (Mirroring backend for now)
POSTGRES_USER = os.getenv("POSTGRES_USER", "user")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "password")
POSTGRES_DB = os.getenv("POSTGRES_DB", "main_db")
POSTGRES_HOST = os.getenv("POSTGRES_HOST", "db") # Default to 'db' service name in docker

DATABASE_URL = f"postgresql+asyncpg://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:5432/{POSTGRES_DB}"

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

# Polling Worker
async def process_task(task: AITask):
    """
    Simulate GPU processing.
    """
    print(f"Processing task {task.id} - Type: {task.task_type}")
    
    # Simulate processing time
    await asyncio.sleep(2)
    
    # Mock Result
    result_data = {
        "score": 0.95,
        "processed_by": "gpu_worker_1",
        "result_vector": [0.1, 0.2, 0.3]
    }
    
    return result_data

async def worker_loop():
    print("Starting GPU Worker Polling Loop...")
    while True:
        try:
            async with AsyncSessionLocal() as session:
                async with session.begin():
                    # SELECT ... FOR UPDATE SKIP LOCKED
                    stmt = (
                        select(AITask)
                        .where(AITask.status == AITaskStatus.PENDING)
                        .limit(1)
                        .with_for_update(skip_locked=True)
                    )
                    result = await session.execute(stmt)
                    task = result.scalar_one_or_none()
                    
                    if task:
                        # Update status to PROCESSING
                        task.status = AITaskStatus.PROCESSING
                        await session.commit()
                        
                        # Process (Outside of DB transaction to keep it short? No, we need to update it again)
                        # Re-open session or keep it? For simplicity, we process then update.
                        # But 'task' object is detached after commit if expire_on_commit=True (which is default but we set False)
                        
                        try:
                            output = await process_task(task)
                            task.result = output
                            task.status = AITaskStatus.COMPLETED
                        except Exception as e:
                            print(f"Task Failed: {e}")
                            task.status = AITaskStatus.FAILED
                            task.result = {"error": str(e)}
                        
                        # We need a new transaction to save the final state because the previous one was committed
                        # Actually, 'task' is still attached if expire_on_commit=False.
                        # But wait, 'session.begin()' context manager commits on exit.
                        pass # The first transaction ended.
                
                # Update the task with result (New Transaction)
                if task:
                     async with session.begin():
                        # Re-fetch or merge? simplest is to update by ID
                        stmt = (
                            update(AITask)
                            .where(AITask.id == task.id)
                            .values(
                                status=task.status,
                                result=task.result,
                                updated_at=task.updated_at
                            )
                        )
                        await session.execute(stmt)
                        print(f"Task {task.id} Completed.")

                    # Don't sleep if we found work? Or sleep a little?
                    # If we have a lot of work, we might want to continue immediately.
                    # But for now, let's just loop.
                    continue

        except Exception as e:
            print(f"Worker Loop Error: {e}")
        
        # Wait before next poll
        await asyncio.sleep(5)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    asyncio.create_task(worker_loop())
    yield
    # Shutdown

app = FastAPI(title="AI Model Service", lifespan=lifespan)

@app.get("/")
async def root():
    return {"message": "AI Service Running & Polling"}
