from typing import Optional, List
from datetime import datetime
from uuid import UUID, uuid4
from sqlmodel import SQLModel, Field, Relationship, Column
from sqlalchemy import String, Integer, Float, Enum, ARRAY
from sqlalchemy.dialects.postgresql import JSONB
from geoalchemy2 import Geometry
import enum

# Enums
class FriendshipStatus(str, enum.Enum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    BLOCKED = "BLOCKED"

class AITaskStatus(str, enum.Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"

class TaskType(str, enum.Enum):
    TREND_ANALYSIS = "TREND_ANALYSIS"
    RECOMMENDATION = "RECOMMENDATION"

# Link Table for Group Members
class UserGroupLink(SQLModel, table=True):
    user_id: UUID = Field(foreign_key="user.id", primary_key=True)
    group_id: UUID = Field(foreign_key="group.id", primary_key=True)

# User Model
class User(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    email: Optional[str] = None
    nickname: str
    profile_image: Optional[str] = None
    preference_vector: List[float] = Field(default=[], sa_column=Column(ARRAY(Float)))
    kakao_id: Optional[str] = Field(default=None, index=True, sa_column_kwargs={"unique": True})
    created_at: datetime = Field(default_factory=datetime.utcnow)

    groups: List["Group"] = Relationship(back_populates="members", link_model=UserGroupLink)

# Friendship Model
class Friendship(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    requester_id: UUID = Field(foreign_key="user.id")
    addressee_id: UUID = Field(foreign_key="user.id")
    status: FriendshipStatus = Field(default=FriendshipStatus.PENDING)
    created_at: datetime = Field(default_factory=datetime.utcnow)

# Place Model
class Place(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    name: str
    
    # Store as GEOGRAPHY(POINT) for accurate distance calculations
    # 'SRID=4326' is standard WGS84 (Lat/Lon)
    location: str = Field(sa_column=Column(Geometry("POINT", srid=4326)))
    
    address: str
    category: str
    kakao_place_id: Optional[str] = Field(default=None, index=True)

    trend_score: float = Field(default=0.0)
    capacity: Optional[int] = None
    place_metadata: dict = Field(default={}, sa_column=Column(JSONB)) # Kept for other metadata

# Group Model
class Group(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    name: str
    invite_code: str = Field(unique=True)
    host_id: UUID = Field(foreign_key="user.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)

    members: List[User] = Relationship(back_populates="groups", link_model=UserGroupLink)

# AI Task Queue Model
class AITask(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    task_type: TaskType
    payload: dict = Field(default={}, sa_column=Column(JSONB))
    status: AITaskStatus = Field(default=AITaskStatus.PENDING)
    result: Optional[dict] = Field(default=None, sa_column=Column(JSONB))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
