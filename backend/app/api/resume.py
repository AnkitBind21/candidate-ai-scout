"""
app/api/resume.py  (updated)
----------------------------
Changes from the original:
  1. Imports ``extract_entities`` from the new entity extractor service.
  2. After a successful parse, calls ``extract_entities(parsed.full_text,
     parsed.detected_sections)`` and attaches the result to the upload
     response as ``entities``.
  3. Adds GET /resume/{resume_id}/entities — a standalone endpoint for
     re-running extraction on an already-uploaded resume without re-parsing.
  4. ALL existing behaviour is unchanged:
     - File validation, saving, Resume DB record, ParsedResumeData field —
       identical to the original.
     - Parsing failures still return ``parsed: null`` without failing the
       upload. Entity extraction failures follow the same pattern:
       ``entities: null`` on error, with a logged warning.

Nothing else in the codebase needs to change for these additions to work.
"""

import logging
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database import get_db
from app.api.dependencies import get_current_user
from app.models.candidate import Candidate
from app.models.resume import Resume
from app.schemas.entity import ExtractedEntitiesSchema
from app.schemas.resume import ParsedResumeData, ResumeUploadResponse
from app.services.entity_extractor import ExtractedEntities, extract_entities
from app.services.resume_parser import ResumeParsingError, parse_resume
from app.utils.file_handler import save_upload_file

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/resume", tags=["Resumes"])


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------


def _entities_to_schema(entities: ExtractedEntities) -> ExtractedEntitiesSchema:
    """
    Convert the service-layer dataclass to its Pydantic schema counterpart.
    Using .to_dict() + model_validate means we never have to update this
    function when new fields are added to either side, as long as the
    dict keys match the schema field names.
    """
    return ExtractedEntitiesSchema.model_validate(entities.to_dict())


# --------------------------------------------------------------------------
# Upload endpoint  (extended — original behaviour preserved)
# --------------------------------------------------------------------------


@router.post(
    "/upload",
    response_model=ResumeUploadResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_resume(
    candidate_id: uuid.UUID = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Uploads a resume file (.pdf or .docx) for an existing candidate.

    Extended behaviour (entity extraction):
    - After successful parsing, automatically runs entity extraction and
      returns the result in ``entities``.
    - Entity extraction failures are non-fatal: ``entities: null`` is
      returned and the failure is logged. The upload itself still succeeds.
    """
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate not found. Create the candidate before uploading a resume.",
        )

    saved_file = await save_upload_file(file, candidate_id)

    resume = Resume(
        candidate_id=candidate_id,
        original_filename=saved_file["original_filename"],
        stored_filename=saved_file["stored_filename"],
        file_path=saved_file["file_path"],
        file_type=saved_file["file_type"],
        file_size=saved_file["file_size"],
    )
    db.add(resume)
    db.commit()
    db.refresh(resume)

    parsed_data: ParsedResumeData | None = None
    entities_schema: ExtractedEntitiesSchema | None = None

    try:
        absolute_path = settings.UPLOAD_DIR / saved_file["file_path"]
        parsed = parse_resume(absolute_path, saved_file["file_type"])

        parsed_data = ParsedResumeData(
            text_preview=parsed.preview,
            detected_sections=parsed.detected_sections,
            word_count=parsed.word_count,
            is_scanned=parsed.is_scanned,
            warnings=parsed.warnings,
        )

        # Entity extraction — only attempted when we have actual text
        if not parsed.is_scanned and parsed.full_text.strip():
            try:
                entities = extract_entities(
                    full_text=parsed.full_text,
                    detected_sections=parsed.detected_sections,
                )
                entities_schema = _entities_to_schema(entities)
            except Exception:  # noqa: BLE001
                logger.exception(
                    "Entity extraction failed for resume_id=%s (upload)", resume.id
                )
        elif parsed.is_scanned:
            logger.info(
                "Skipping entity extraction for resume_id=%s: scanned document.", resume.id
            )

    except ResumeParsingError as exc:
        logger.warning(
            "Resume parsing failed for resume_id=%s (%s): %s",
            resume.id,
            type(exc).__name__,
            exc,
        )
    except Exception:  # noqa: BLE001
        logger.exception("Unexpected error parsing resume_id=%s", resume.id)

    return ResumeUploadResponse(
        message="Resume uploaded successfully.",
        resume=resume,
        parsed=parsed_data,
        entities=entities_schema,  # None if parsing/extraction failed
    )


# --------------------------------------------------------------------------
# Standalone entity endpoint — re-run extraction without re-uploading
# --------------------------------------------------------------------------


@router.get(
    "/{resume_id}/entities",
    response_model=ExtractedEntitiesSchema,
    summary="Extract entities from an already-uploaded resume",
)
async def get_resume_entities(
    resume_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Re-runs entity extraction on a stored resume file on demand.

    Useful for:
    - Retrying after a transient failure during upload.
    - Re-extracting after the extractor has been improved.
    - Building a job-matching pipeline that pulls entities on demand.

    Returns 404 if the resume record doesn't exist, 422 if the file is
    gone from disk or is a scanned document, 500 on unexpected failures.
    """
    resume = db.query(Resume).filter(Resume.id == resume_id).first()
    if not resume:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found.")

    absolute_path = settings.UPLOAD_DIR / resume.file_path
    try:
        parsed = parse_resume(absolute_path, resume.file_type)
    except ResumeParsingError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Could not re-parse resume: {exc}",
        ) from exc

    if parsed.is_scanned:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "This resume appears to be scanned / image-based. "
                "Entity extraction requires selectable text."
            ),
        )

    entities = extract_entities(
        full_text=parsed.full_text,
        detected_sections=parsed.detected_sections,
    )
    return _entities_to_schema(entities)
