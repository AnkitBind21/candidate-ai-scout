import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.api.dependencies import get_current_user
from app.models.job import Job, JobStatus
from app.schemas.job import JobCreate, JobUpdate, JobResponse, JobListResponse

router = APIRouter(prefix="/jobs", tags=["Jobs"])


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
    for field, value in update_data.items():
        setattr(job, field, value)

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

    db.delete(job)  # cascades to candidates / analyses via relationship config
    db.commit()
    return None
