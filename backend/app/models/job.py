import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Column,
    String,
    Text,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    JSON,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base  # assumes existing declarative Base + engine setup


class JobStatus(str, enum.Enum):
    draft = "draft"
    open = "open"
    closed = "closed"


class Job(Base):
    __tablename__ = "jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)

    title = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=False)
    department = Column(String(150), nullable=True)
    location = Column(String(150), nullable=True)
    employment_type = Column(String(50), nullable=True)  # full_time / part_time / contract
    min_experience = Column(Integer, nullable=True)
    max_experience = Column(Integer, nullable=True)

    # Simple list of required skill strings, e.g. ["Python", "FastAPI", "SQL"]
    required_skills = Column(JSON, nullable=False, default=list)

    status = Column(Enum(JobStatus), nullable=False, default=JobStatus.open)

    # Owner / recruiter who created the job. Assumes an existing `users` table.
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationships
    candidates = relationship(
        "Candidate", back_populates="job", cascade="all, delete-orphan"
    )
    analyses = relationship(
        "Analysis", back_populates="job", cascade="all, delete-orphan"
    )
