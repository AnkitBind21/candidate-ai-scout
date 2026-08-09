"""
app/schemas/analysis.py
------------------------
Response schemas for the Analysis History API (app/api/analysis.py).

Read-only: there is no create/update schema here. Analysis rows are
written internally by POST /match (see app/api/matching.py) right after
a match result is computed; API consumers only ever read them back
through this module.
"""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict

from app.models.analysis import AnalysisStatus


class AnalysisResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    candidate_id: uuid.UUID
    job_id: uuid.UUID
    resume_id: uuid.UUID

    # Maps to Analysis.match_score. Renamed here to match the wording
    # used everywhere else in the matching engine's own response schema.
    overall_score: float | None = None

    # Analysis has no dedicated `recommendation` column -- it's stored as
    # part of the JSON match breakdown in `notes` (see notes below) and
    # surfaced here as its own field for convenience.
    recommendation: str | None = None

    status: AnalysisStatus

    # Analysis.notes is a raw Text column containing a JSON-encoded copy
    # of the full match result (see app/api/matching.py). Exposed here
    # already parsed into an object rather than as a raw string.
    notes: dict[str, Any] | None = None

    created_at: datetime
    updated_at: datetime


class AnalysisListResponse(BaseModel):
    total: int
    items: list[AnalysisResponse]
