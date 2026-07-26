import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.job import JobStatus


class JobBase(BaseModel):
    title: str = Field(..., min_length=2, max_length=255)
    description: str = Field(..., min_length=10)
    department: Optional[str] = Field(None, max_length=150)
    location: Optional[str] = Field(None, max_length=150)
    employment_type: Optional[str] = Field(None, max_length=50)
    min_experience: Optional[int] = Field(None, ge=0)
    max_experience: Optional[int] = Field(None, ge=0)
    required_skills: List[str] = Field(default_factory=list)
    status: JobStatus = JobStatus.open


class JobCreate(JobBase):
    pass


class JobUpdate(BaseModel):
    """All fields optional to support partial updates."""

    title: Optional[str] = Field(None, min_length=2, max_length=255)
    description: Optional[str] = Field(None, min_length=10)
    department: Optional[str] = Field(None, max_length=150)
    location: Optional[str] = Field(None, max_length=150)
    employment_type: Optional[str] = Field(None, max_length=50)
    min_experience: Optional[int] = Field(None, ge=0)
    max_experience: Optional[int] = Field(None, ge=0)
    required_skills: Optional[List[str]] = None
    status: Optional[JobStatus] = None


class JobResponse(JobBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_by_id: int
    created_at: datetime
    updated_at: datetime


class JobListResponse(BaseModel):
    total: int
    items: List[JobResponse]