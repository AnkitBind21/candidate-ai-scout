import enum
import uuid
from datetime import datetime

from sqlalchemy import Column, String, DateTime, ForeignKey, Float, Enum, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class AnalysisStatus(str, enum.Enum):
    pending = "pending"
    completed = "completed"
    failed = "failed"


class Analysis(Base):
    """
    Data model reserved for resume-vs-job screening results.

    NOTE: No scoring/AI logic is implemented here per current scope.
    This table simply exists so the relationships (Job / Candidate / Resume)
    are in place for whatever screening engine gets wired in later.
    """

    __tablename__ = "analyses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)

    resume_id = Column(UUID(as_uuid=True), ForeignKey("resumes.id"), nullable=False)
    job_id = Column(UUID(as_uuid=True), ForeignKey("jobs.id"), nullable=False)
    candidate_id = Column(
        UUID(as_uuid=True), ForeignKey("candidates.id"), nullable=False
    )

    match_score = Column(Float, nullable=True)  # populated by future screening logic
    status = Column(Enum(AnalysisStatus), nullable=False, default=AnalysisStatus.pending)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationships
    resume = relationship("Resume", back_populates="analyses")
    job = relationship("Job", back_populates="analyses")
    candidate = relationship("Candidate", back_populates="analyses")
