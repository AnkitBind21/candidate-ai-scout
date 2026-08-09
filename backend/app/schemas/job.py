"""
app/schemas/job.py  (updated)
-------------------------------
All existing classes (JobBase, JobCreate, JobUpdate, JobResponse,
JobListResponse) are completely unchanged — copied verbatim from the
original file.

Two new schema classes are added below them:
  JobEntitiesSchema   — mirrors JobEntities dataclass in jd_parser.py
  ParsedJDRequest     — request body for POST /jobs/parse-jd
  ParsedJDSchema      — response for POST /jobs/parse-jd

These are consumed ONLY by the new parse-jd endpoint.
No existing endpoint reads or returns these types.
"""

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.job import JobStatus


# ==========================================================================
# Existing schemas — UNCHANGED
# ==========================================================================


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


# ==========================================================================
# NEW schemas — for POST /jobs/parse-jd only
# ==========================================================================


class JobEntitiesSchema(BaseModel):
    """
    API-facing mirror of the JobEntities dataclass (jd_parser.JobEntities).

    Returned by POST /jobs/parse-jd inside ParsedJDSchema.entities.

    Field names match the Job SQLAlchemy model columns exactly so the caller
    can forward extracted values straight into a JobCreate payload without
    any translation layer.
    """

    # ── Core identity ─────────────────────────────────────────────────────────
    title: Optional[str] = None
    department: Optional[str] = None
    location: Optional[str] = None
    employment_type: Optional[str] = None

    # ── Experience ────────────────────────────────────────────────────────────
    min_experience: Optional[int] = None
    max_experience: Optional[int] = None

    # ── Skills ───────────────────────────────────────────────────────────────
    required_skills: List[str] = Field(default_factory=list)
    preferred_skills: List[str] = Field(default_factory=list)

    # ── Content ──────────────────────────────────────────────────────────────
    responsibilities: List[str] = Field(default_factory=list)
    qualifications: List[str] = Field(default_factory=list)
    education: List[str] = Field(default_factory=list)

    # ── Meta ─────────────────────────────────────────────────────────────────
    parsing_warnings: List[str] = Field(default_factory=list)


class ParsedJDRequest(BaseModel):
    """
    Request body for POST /jobs/parse-jd.

    The caller submits the raw JD text; everything else is derived
    server-side by jd_parser.parse_jd() and extract_jd_entities().
    """

    text: str = Field(
        ...,
        min_length=30,
        description=(
            "Raw job description text (paste from job board, PDF extract, etc.). "
            "Minimum 30 characters."
        ),
    )


class ParsedJDSchema(BaseModel):
    """
    Response from POST /jobs/parse-jd.

    Mirrors ParsedJD (the intermediate struct from jd_parser.parse_jd)
    while adding the fully-extracted entities so the caller gets both the
    section breakdown AND clean entity extraction in one call.
    """

    # Mirrors ParsedJD fields
    word_count: int
    is_structured: bool
    detected_sections: Dict[str, Optional[str]] = Field(
        description=(
            "Raw section content keyed by canonical section name. "
            "Null when the section was not detected in the JD."
        )
    )

    # The extracted entities — the primary payload most callers want
    entities: JobEntitiesSchema

    # Non-fatal issues encountered during parsing / extraction
    warnings: List[str] = Field(default_factory=list)
