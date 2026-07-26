import uuid
from datetime import datetime

from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class Candidate(Base):
    __tablename__ = "candidates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)

    full_name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False, index=True)
    phone = Column(String(30), nullable=True)

    # A candidate record is created in the context of a specific job application.
    job_id = Column(UUID(as_uuid=True), ForeignKey("jobs.id"), nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationships
    job = relationship("Job", back_populates="candidates")
    resumes = relationship(
        "Resume", back_populates="candidate", cascade="all, delete-orphan"
    )
    analyses = relationship(
        "Analysis", back_populates="candidate", cascade="all, delete-orphan"
    )
