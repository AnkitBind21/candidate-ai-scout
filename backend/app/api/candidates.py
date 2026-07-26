import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.api.dependencies import get_current_user
from app.models.candidate import Candidate
from app.models.job import Job
from app.schemas.candidate import (
    CandidateCreate,
    CandidateResponse,
    CandidateDetailResponse,
    CandidateListResponse,
)

router = APIRouter(prefix="/candidate", tags=["Candidates"])


@router.post("", response_model=CandidateResponse, status_code=status.HTTP_201_CREATED)
def create_candidate(
    payload: CandidateCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    job = db.query(Job).filter(Job.id == payload.job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Referenced job does not exist.",
        )

    candidate = Candidate(**payload.model_dump())
    db.add(candidate)
    db.commit()
    db.refresh(candidate)
    return candidate


@router.get("", response_model=CandidateListResponse)
def list_candidates(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    job_id: Optional[uuid.UUID] = Query(None, description="Filter by job"),
    search: Optional[str] = Query(None, description="Search by candidate name or email"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = db.query(Candidate)

    if job_id:
        query = query.filter(Candidate.job_id == job_id)

    if search:
        like = f"%{search}%"
        query = query.filter(
            (Candidate.full_name.ilike(like)) | (Candidate.email.ilike(like))
        )

    total = query.count()
    items = (
        query.order_by(Candidate.created_at.desc()).offset(skip).limit(limit).all()
    )

    return CandidateListResponse(total=total, items=items)


@router.get("/{candidate_id}", response_model=CandidateDetailResponse)
def get_candidate(
    candidate_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    candidate = (
        db.query(Candidate)
        .options(joinedload(Candidate.resumes))
        .filter(Candidate.id == candidate_id)
        .first()
    )
    if not candidate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found"
        )
    return candidate
