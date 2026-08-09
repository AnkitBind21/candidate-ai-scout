"""
app/api/analysis.py
--------------------
Read-only Analysis History API.

Analysis rows are written by POST /match (see app/api/matching.py) right
after a match result is computed -- this module only exposes them for
retrieval. It never computes, recomputes, or otherwise touches a score.
"""

import json
import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.api.dependencies import get_current_user
from app.models.analysis import Analysis
from app.models.candidate import Candidate
from app.schemas.analysis import AnalysisListResponse, AnalysisResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analyses", tags=["Analysis"])


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------


def _to_response(analysis: Analysis) -> AnalysisResponse:
    """
    Builds the response schema from an Analysis row.

    `notes` is stored as a raw JSON string (see app/api/matching.py); it's
    parsed here so API consumers get a real object instead of a string,
    and `recommendation` is pulled out of that parsed JSON since Analysis
    itself has no dedicated column for it. Malformed/legacy notes are
    handled gracefully -- they never fail the request, they just come back
    as null.
    """
    parsed_notes: dict | None = None
    recommendation: str | None = None

    if analysis.notes:
        try:
            candidate_notes = json.loads(analysis.notes)
            if isinstance(candidate_notes, dict):
                parsed_notes = candidate_notes
                recommendation = candidate_notes.get("recommendation")
        except (TypeError, ValueError):
            logger.warning(
                "Analysis %s has non-JSON notes; returning notes as null.", analysis.id
            )

    return AnalysisResponse(
        id=analysis.id,
        candidate_id=analysis.candidate_id,
        job_id=analysis.job_id,
        resume_id=analysis.resume_id,
        overall_score=analysis.match_score,
        recommendation=recommendation,
        status=analysis.status,
        notes=parsed_notes,
        created_at=analysis.created_at,
        updated_at=analysis.updated_at,
    )


# --------------------------------------------------------------------------
# Endpoints
# --------------------------------------------------------------------------


@router.get("/candidate/{candidate_id}", response_model=AnalysisListResponse)
def get_candidate_analysis_history(
    candidate_id: uuid.UUID,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Returns a candidate's past analyses, most recent first."""
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found."
        )

    query = db.query(Analysis).filter(Analysis.candidate_id == candidate_id)
    total = query.count()
    rows = (
        query.order_by(Analysis.created_at.desc()).offset(skip).limit(limit).all()
    )

    return AnalysisListResponse(total=total, items=[_to_response(a) for a in rows])


@router.get("/{analysis_id}", response_model=AnalysisResponse)
def get_analysis(
    analysis_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Returns a single analysis by id."""
    analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
    if not analysis:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Analysis not found."
        )

    return _to_response(analysis)
