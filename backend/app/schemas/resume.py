"""
app/schemas/resume.py  (updated)
---------------------------------
Single change from the original:
  - ``ResumeUploadResponse`` gains an optional ``entities`` field
    (``ExtractedEntitiesSchema | None``, default None).

All existing fields and types are unchanged. Consumers that only read
``message``, ``resume``, or ``parsed`` are unaffected — the new field
simply won't be present if extraction didn't run or failed.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.resume import ResumeFileType
from app.schemas.entity import ExtractedEntitiesSchema  # NEW import


class ResumeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    candidate_id: uuid.UUID
    original_filename: str
    stored_filename: str
    file_type: ResumeFileType
    file_size: int
    uploaded_at: datetime


class ParsedResumeData(BaseModel):
    """Result of automatic resume parsing (text preview + detected sections)."""

    text_preview: str
    # Keys are always the 5 target sections (Education, Experience, Skills,
    # Projects, Certifications). Value is the extracted content if the
    # section was found, or null if it wasn't detected.
    detected_sections: dict[str, str | None]

    # Additional parsing metadata. All have safe defaults so this schema
    # stays backward compatible with any existing consumer of the API that
    # only reads `text_preview` / `detected_sections`.
    word_count: int = 0
    is_scanned: bool = False
    warnings: list[str] = Field(default_factory=list)


class ResumeUploadResponse(BaseModel):
    message: str
    resume: ResumeResponse
    # Optional: null if parsing failed or the file type isn't supported,
    # so a parsing hiccup never breaks the upload response itself.
    parsed: ParsedResumeData | None = None
    # NEW — null if extraction failed or was skipped (scanned document).
    # Placed last so adding it is backward-compatible with existing API clients
    # that don't read this field yet.
    entities: ExtractedEntitiesSchema | None = None
