"""
Utilities for validating and persisting uploaded resume files.

Handles:
- Extension whitelist validation (.pdf, .docx)
- Size validation (streamed, so we never fully buffer an oversized file in memory)
- Safe, collision-free storage under UPLOAD_DIR
"""

import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status

from app.core.config import settings
from app.models.resume import ResumeFileType

# Read/write in chunks to avoid loading huge files fully into memory.
_CHUNK_SIZE = 1024 * 1024  # 1 MB


def validate_extension(filename: str) -> str:
    """
    Validates the file extension against the allowed whitelist.
    Returns the normalized extension (e.g. '.pdf') on success.
    """
    if not filename or "." not in filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file must have a valid extension (.pdf or .docx).",
        )

    ext = Path(filename).suffix.lower()

    if ext not in settings.ALLOWED_RESUME_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Unsupported file type '{ext}'. "
                f"Allowed types: {', '.join(sorted(settings.ALLOWED_RESUME_EXTENSIONS))}"
            ),
        )
    return ext


def validate_mime_type(content_type: str) -> None:
    """Defense-in-depth check against the client-reported MIME type."""
    if content_type not in settings.ALLOWED_RESUME_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported content-type '{content_type}'.",
        )


def _extension_to_file_type(ext: str) -> ResumeFileType:
    return ResumeFileType.pdf if ext == ".pdf" else ResumeFileType.docx


async def save_upload_file(file: UploadFile, candidate_id: uuid.UUID) -> dict:
    """
    Validates and streams an UploadFile to disk under UPLOAD_DIR.

    Returns a dict with the fields needed to create a Resume row:
        {
            "original_filename": str,
            "stored_filename": str,
            "file_path": str,   # relative path, stored in DB
            "file_type": ResumeFileType,
            "file_size": int,
        }

    Raises HTTPException(400) on validation failure, cleaning up any
    partially written file.
    """
    ext = validate_extension(file.filename)

    if file.content_type:
        validate_mime_type(file.content_type)

    # Namespace resumes by candidate to avoid collisions and keep things tidy.
    candidate_dir = settings.UPLOAD_DIR / str(candidate_id)
    candidate_dir.mkdir(parents=True, exist_ok=True)

    stored_filename = f"{uuid.uuid4().hex}{ext}"
    destination_path = candidate_dir / stored_filename

    total_size = 0
    try:
        with open(destination_path, "wb") as out_file:
            while True:
                chunk = await file.read(_CHUNK_SIZE)
                if not chunk:
                    break
                total_size += len(chunk)

                if total_size > settings.MAX_RESUME_SIZE_BYTES:
                    out_file.close()
                    destination_path.unlink(missing_ok=True)
                    max_mb = settings.MAX_RESUME_SIZE_BYTES // (1024 * 1024)
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"File exceeds maximum allowed size of {max_mb} MB.",
                    )

                out_file.write(chunk)
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        destination_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save uploaded file: {exc}",
        ) from exc
    finally:
        await file.close()

    if total_size == 0:
        destination_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    # Store a path relative to UPLOAD_DIR so the DB isn't coupled to an
    # absolute filesystem location.
    relative_path = str(destination_path.relative_to(settings.UPLOAD_DIR))

    return {
        "original_filename": file.filename,
        "stored_filename": stored_filename,
        "file_path": relative_path,
        "file_type": _extension_to_file_type(ext),
        "file_size": total_size,
    }
