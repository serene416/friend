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

class InviteStatus(str, enum.Enum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    EXPIRED = "EXPIRED"

class AITaskStatus(str, enum.Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"

class TaskType(str, enum.Enum):
    TREND_ANALYSIS = "TREND_ANALYSIS"
    RECOMMENDATION = "RECOMMENDATION"

class IngestionJobStatus(str, enum.Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    PARTIAL = "PARTIAL"
    FAILED = "FAILED"

class IngestionItemStatus(str, enum.Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    SKIPPED = "SKIPPED"

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
    status_message: Optional[str] = Field(default=None, sa_column=Column(String))
    status_message_expires_at: Optional[datetime] = Field(default=None)
    current_latitude: Optional[float] = Field(default=None)
    current_longitude: Optional[float] = Field(default=None)
    current_location_name: Optional[str] = Field(default=None, sa_column=Column(String))
    current_location_updated_at: Optional[datetime] = Field(default=None)
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

# Invite Model
class Invite(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    token: str = Field(index=True, sa_column_kwargs={"unique": True})
    inviter_id: UUID = Field(foreign_key="user.id")
    accepted_by_id: Optional[UUID] = Field(default=None, foreign_key="user.id")
    status: InviteStatus = Field(default=InviteStatus.PENDING)
    expires_at: datetime
    created_at: datetime = Field(default_factory=datetime.utcnow)
    accepted_at: Optional[datetime] = Field(default=None)

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


class IngestionJob(SQLModel, table=True):
    __tablename__ = "ingestion_job"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    source: str = Field(default="midpoint")
    status: IngestionJobStatus = Field(
        default=IngestionJobStatus.PENDING,
        sa_column=Column(Enum(IngestionJobStatus, name="ingestion_job_status"), nullable=False),
    )
    total_items: int = Field(default=0, sa_column=Column(Integer, nullable=False, default=0))
    completed_items: int = Field(default=0, sa_column=Column(Integer, nullable=False, default=0))
    failed_items: int = Field(default=0, sa_column=Column(Integer, nullable=False, default=0))
    request_payload: dict = Field(default_factory=dict, sa_column=Column(JSONB, nullable=False))
    meta: dict = Field(default_factory=dict, sa_column=Column(JSONB, nullable=False))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class IngestionJobItem(SQLModel, table=True):
    __tablename__ = "ingestion_job_item"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    job_id: UUID = Field(index=True)
    kakao_place_id: str = Field(index=True)
    place_name: Optional[str] = Field(default=None, sa_column=Column(String))
    x: Optional[float] = None
    y: Optional[float] = None
    source_keyword: Optional[str] = Field(default=None, sa_column=Column(String))
    source_station: Optional[str] = Field(default=None, sa_column=Column(String))
    status: IngestionItemStatus = Field(
        default=IngestionItemStatus.PENDING,
        sa_column=Column(Enum(IngestionItemStatus, name="ingestion_item_status"), nullable=False),
    )
    error_message: Optional[str] = Field(default=None, sa_column=Column(String))
    retry_count: int = Field(default=0, sa_column=Column(Integer, nullable=False, default=0))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class PlaceIngestionFeature(SQLModel, table=True):
    __tablename__ = "place_ingestion_feature"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    place_id: Optional[UUID] = Field(default=None, index=True)
    kakao_place_id: str = Field(index=True, sa_column_kwargs={"unique": True})
    latest_review_count: int = Field(default=0, sa_column=Column(Integer, nullable=False, default=0))
    latest_photo_count: int = Field(default=0, sa_column=Column(Integer, nullable=False, default=0))
    instagram_post_freq_7d: float = Field(default=0.0, sa_column=Column(Float, nullable=False, default=0.0))
    instagram_post_freq_30d: float = Field(default=0.0, sa_column=Column(Float, nullable=False, default=0.0))
    last_ingested_at: Optional[datetime] = Field(default=None)
    feature_payload: dict = Field(default_factory=dict, sa_column=Column(JSONB, nullable=False))
