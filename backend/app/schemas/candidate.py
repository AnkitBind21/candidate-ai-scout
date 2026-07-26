import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field, ConfigDict

from app.schemas.resume import ResumeResponse


class CandidateBase(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    phone: Optional[str] = Field(None, max_length=30)
    job_id: uuid.UUID


class CandidateCreate(CandidateBase):
    pass


class CandidateResponse(CandidateBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class CandidateDetailResponse(CandidateResponse):
    """Used for GET /candidate/{id} - includes uploaded resumes."""

    resumes: List[ResumeResponse] = Field(default_factory=list)


class CandidateListResponse(BaseModel):
    total: int
    items: List[CandidateResponse]
