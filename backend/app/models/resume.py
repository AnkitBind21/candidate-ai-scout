import enum
import uuid
from datetime import datetime

from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class ResumeFileType(str, enum.Enum):
    pdf = "pdf"
    docx = "docx"


class Resume(Base):
    __tablename__ = "resumes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)

    candidate_id = Column(
        UUID(as_uuid=True), ForeignKey("candidates.id"), nullable=False
    )

    original_filename = Column(String(255), nullable=False)
    stored_filename = Column(String(255), nullable=False, unique=True)
    file_path = Column(String(500), nullable=False)  # relative path under UPLOAD_DIR
    file_type = Column(Enum(ResumeFileType), nullable=False)
    file_size = Column(Integer, nullable=False)  # bytes

    uploaded_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    candidate = relationship("Candidate", back_populates="resumes")
    analyses = relationship(
        "Analysis", back_populates="resume", cascade="all, delete-orphan"
    )
