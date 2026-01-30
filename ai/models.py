from sqlalchemy import Column, String, Integer, DateTime, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import declarative_base
from datetime import datetime
import uuid
import enum

Base = declarative_base()

class AITaskStatus(str, enum.Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"

class TaskType(str, enum.Enum):
    TREND_ANALYSIS = "TREND_ANALYSIS"
    RECOMMENDATION = "RECOMMENDATION"

class AITask(Base):
    __tablename__ = "aitask"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_type = Column(String, nullable=False)
    payload = Column(JSONB, default={})
    status = Column(String, default=AITaskStatus.PENDING) # Storing Enum as String for simplicity/compatibility
    result = Column(JSONB, default=None)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
