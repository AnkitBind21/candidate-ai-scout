"""
app/api/matching.py
--------------------
POST /match — runs the deterministic ATS Matching Engine between a
candidate and a job.

Neither resume entities nor full job entities are persisted anywhere
today (see app/models/resume.py, app/models/job.py), so this endpoint
regenerates both on demand:

- Resume: mirrors the exact pattern already used by
  GET /resume/{id}/entities in app/api/resume.py — re-run
  parse_resume() + extract_entities() against the stored file.
- Job: the Job row's own persisted columns (title, department, location,
  employment_type, min/max_experience, required_skills) are the source
  of truth, since a recruiter may have hand-edited them after the JD was
  first parsed. Job.description (which IS persisted) is re-parsed via
  parse_jd() + extract_jd_entities() to fill in the fields the Job model
  doesn't have columns for (preferred_skills, responsibilities,
  qualifications, education), then the persisted columns override the
  freshly re-parsed ones wherever both exist.

This file, app/services/matching_engine.py, and app/schemas/matching.py
are the only new files added for the matching engine. entity_extractor.py,
jd_parser.py, and resume_parser.py are untouched.
"""

import json
import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database import get_db
from app.api.dependencies import get_current_user
from app.models.analysis import Analysis, AnalysisStatus
from app.models.candidate import Candidate
from app.models.job import Job
from app.schemas.matching import MatchRequest, MatchResponse, MatchResultSchema
from app.services.entity_extractor import extract_entities
from app.services.jd_parser import (
    JDEmptyError,
    JDParsingError,
    JDTooShortError,
    JobEntities,
    extract_jd_entities,
    parse_jd,
)
from app.services.matching_engine import match_resume_to_job
from app.services.resume_parser import ResumeParsingError, parse_resume

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Matching"])


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------


def _load_job_entities(job: Job) -> tuple[JobEntities, list[str]]:
    """
    Builds JobEntities for matching: re-parses Job.description for the
    fields the Job model doesn't persist, then lets the persisted Job
    columns win for everything the model DOES store (see module
    docstring for why).
    """
    warnings: list[str] = []
    entities = JobEntities()

    try:
        parsed = parse_jd(job.description)
        entities = extract_jd_entities(parsed.full_text, parsed.detected_sections)
    except (JDEmptyError, JDTooShortError, JDParsingError) as exc:
        warnings.append(f"Could not re-parse job description for enrichment: {exc}")
    except Exception:  # noqa: BLE001
        logger.exception("Unexpected error re-parsing job_id=%s description", job.id)
        warnings.append(
            "Unexpected error re-parsing job description; using stored job fields only."
        )

    # Persisted DB columns are the source of truth over the freshly
    # re-parsed values (a recruiter may have hand-edited these).
    entities.title = job.title or entities.title
    entities.department = job.department or entities.department
    entities.location = job.location or entities.location
    entities.employment_type = job.employment_type or entities.employment_type
    entities.min_experience = (
        job.min_experience if job.min_experience is not None else entities.min_experience
    )
    entities.max_experience = (
        job.max_experience if job.max_experience is not None else entities.max_experience
    )
    if job.required_skills:
        entities.required_skills = list(job.required_skills)

    return entities, warnings


def _latest_resume(candidate: Candidate):
    """Candidates can have more than one uploaded resume over time; match
    against the most recently uploaded one."""
    if not candidate.resumes:
        return None
    return sorted(candidate.resumes, key=lambda r: r.uploaded_at, reverse=True)[0]


# --------------------------------------------------------------------------
# Endpoint
# --------------------------------------------------------------------------


@router.post("/match", response_model=MatchResponse, status_code=status.HTTP_200_OK)
async def match_candidate_to_job(
    request: MatchRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Runs the ATS Matching Engine between a candidate's most recent resume
    and a job, returning skill/experience/education scores, an overall
    score, and a recommendation.

    404 if the candidate or job doesn't exist. 422 if the candidate has
    no uploaded resume, or the resume can't be parsed (e.g. scanned/
    image-based document with no selectable text).
    """
    warnings: list[str] = []

    candidate = db.query(Candidate).filter(Candidate.id == request.candidate_id).first()
    if not candidate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found."
        )

    job = db.query(Job).filter(Job.id == request.job_id).first()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found.")

    resume = _latest_resume(candidate)
    if not resume:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Candidate has no uploaded resume to match against.",
        )

    try:
        absolute_path = settings.UPLOAD_DIR / resume.file_path
        parsed_resume = parse_resume(absolute_path, resume.file_type)
    except ResumeParsingError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Could not parse candidate's resume: {exc}",
        ) from exc

    if parsed_resume.is_scanned:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "Candidate's resume appears to be scanned/image-based. "
                "Matching requires selectable text."
            ),
        )

    resume_entities = extract_entities(parsed_resume.full_text, parsed_resume.detected_sections)
    warnings.extend(resume_entities.extraction_warnings)

    job_entities, job_warnings = _load_job_entities(job)
    warnings.extend(job_warnings)
    warnings.extend(job_entities.parsing_warnings)

    result = match_resume_to_job(resume_entities, job_entities)
    result_dict = result.to_dict()

    try:
        analysis = Analysis(
            resume_id=resume.id,
            job_id=job.id,
            candidate_id=candidate.id,
            match_score=result_dict.get("overall_score"),
            status=AnalysisStatus.completed,
            notes=json.dumps(result_dict),
        )
        db.add(analysis)
        db.commit()
    except Exception:  # noqa: BLE001
        db.rollback()
        logger.exception(
            "Failed to persist Analysis row for candidate_id=%s job_id=%s",
            candidate.id,
            job.id,
        )
        warnings.append(
            "Match computed successfully but could not be saved to analysis history."
        )

    return MatchResponse(
        candidate_id=candidate.id,
        job_id=job.id,
        result=MatchResultSchema.model_validate(result_dict),
        warnings=warnings,
    )
