"""
app/api/jobs.py  (updated)
---------------------------
All existing endpoints (POST /jobs, GET /jobs, GET /jobs/{id},
PUT /jobs/{id}, DELETE /jobs/{id}) are completely unchanged — copied
verbatim from the original file.

One new endpoint is added at the bottom:

    POST /jobs/parse-jd
        Accepts a raw JD text string, runs it through jd_parser.parse_jd()
        and jd_parser.extract_jd_entities(), and returns a ParsedJDSchema
        response containing both the section breakdown and extracted entities.

        STATELESS — does not create or update any DB record.  The caller
        uses the returned entities to pre-fill a JobCreate form, then POSTs
        to /jobs to persist the job.

        Authentication is required (same as all other job endpoints).

Route ordering note: FastAPI matches routes top-to-bottom.  "/jobs/parse-jd"
must be declared BEFORE "/jobs/{job_id}" so the literal path segment
"parse-jd" is not swallowed by the UUID path parameter.
"""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.api.dependencies import get_current_user
from app.models.job import Job, JobStatus
from app.schemas.job import (
    JobCreate,
    JobEntitiesSchema,
    JobListResponse,
    JobResponse,
    JobUpdate,
    ParsedJDRequest,
    ParsedJDSchema,
)
from app.services.jd_parser import (
    JDEmptyError,
    JDParsingError,
    JDTooShortError,
    extract_jd_entities,
    parse_jd,
)

router = APIRouter(prefix="/jobs", tags=["Jobs"])


# ==========================================================================
# Existing endpoints — UNCHANGED
# ==========================================================================


@router.post("", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
def create_job(
    payload: JobCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    job = Job(**payload.model_dump(), created_by_id=current_user.id)
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


@router.get("", response_model=JobListResponse)
def list_jobs(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status_filter: Optional[JobStatus] = Query(None, alias="status"),
    search: Optional[str] = Query(None, description="Search by job title"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = db.query(Job)

    if status_filter:
        query = query.filter(Job.status == status_filter)

    if search:
        query = query.filter(Job.title.ilike(f"%{search}%"))

    total = query.count()
    items = query.order_by(Job.created_at.desc()).offset(skip).limit(limit).all()

    return JobListResponse(total=total, items=items)


# NOTE: /parse-jd is declared HERE — before /{job_id} — so FastAPI doesn't
# interpret the literal string "parse-jd" as a UUID value.
@router.post(
    "/parse-jd",
    response_model=ParsedJDSchema,
    status_code=status.HTTP_200_OK,
    summary="Parse a raw job description and extract structured entities",
    description=(
        "Accepts the raw text of a job description and returns a structured "
        "breakdown: title, required/preferred skills, responsibilities, "
        "qualifications, education requirements, experience range, location, "
        "department, and employment type.\n\n"
        "**Stateless** — does not create a Job record. Use the returned "
        "`entities` to pre-fill a `JobCreate` payload, then POST to `/jobs` "
        "to persist the job."
    ),
)
def parse_job_description(
    payload: ParsedJDRequest,
    current_user=Depends(get_current_user),
) -> ParsedJDSchema:
    """
    Parse a raw JD string and return structured entities.

    - HTTP 400: text is empty or too short.
    - HTTP 422: text could not be parsed (logged server-side).
    """
    try:
        parsed = parse_jd(payload.text)
    except (JDEmptyError, JDTooShortError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except JDParsingError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Job description could not be parsed: {exc}",
        ) from exc

    entities = extract_jd_entities(
        full_text=parsed.full_text,
        detected_sections=parsed.detected_sections,
    )

    all_warnings = parsed.warnings + entities.parsing_warnings

    return ParsedJDSchema(
        word_count=parsed.word_count,
        is_structured=parsed.is_structured,
        detected_sections=parsed.detected_sections,
        entities=JobEntitiesSchema(**entities.to_dict()),
        warnings=all_warnings,
    )


@router.get("/{job_id}", response_model=JobResponse)
def get_job(
    job_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return job


@router.put("/{job_id}", response_model=JobResponse)
def update_job(
    job_id: uuid.UUID,
    payload: JobUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    update_data = payload.model_dump(exclude_unset=True)
    for f, value in update_data.items():
        setattr(job, f, value)

    db.commit()
    db.refresh(job)
    return job


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_job(
    job_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    db.delete(job)
    db.commit()
    return None
