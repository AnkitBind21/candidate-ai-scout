import logging
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database import get_db
from app.api.dependencies import get_current_user
from app.models.candidate import Candidate
from app.models.resume import Resume
from app.schemas.resume import ParsedResumeData, ResumeUploadResponse
from app.services.resume_parser import ResumeParsingError, parse_resume
from app.utils.file_handler import save_upload_file

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/resume", tags=["Resumes"])


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

    - Validates file extension and MIME type against an allow-list.
    - Streams the file to disk while enforcing a max size limit, so an
      oversized file never gets fully buffered in memory.
    - Persists the file under uploads/<candidate_id>/<uuid>.<ext>.
    - Automatically parses the saved file to extract a text preview and
      detect common resume sections. Parsing failures (corrupted file,
      encrypted PDF, scanned/image-only document, etc.) are logged and
      returned as `parsed: null` — they do NOT fail the upload, since the
      resume record has already been saved successfully at that point.
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
    )
