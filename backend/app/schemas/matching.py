"""
app/schemas/matching.py
------------------------
Pydantic schemas for the ATS Matching Engine
(app/services/matching_engine.py) and the POST /match endpoint.

Follows the same convention as app/schemas/entity.py and
app/schemas/job.py: MatchResultSchema's field names match
matching_engine.MatchResult.to_dict() 1:1, so the router can do
    MatchResultSchema.model_validate(result.to_dict())
with no translation layer.
"""

import uuid
from typing import List

from pydantic import BaseModel, ConfigDict, Field


class MatchResultSchema(BaseModel):
    """
    API-facing mirror of matching_engine.MatchResult. This IS the exact
    shape requested for the matching output:

        {
            "overall_score": 0-100,
            "skill_score": ...,
            "experience_score": ...,
            "education_score": ...,
            "matched_skills": [],
            "missing_skills": [],
            "extra_skills": [],
            "recommendation": "Highly Recommended | Recommended | Consider | Reject"
        }
    """

    model_config = ConfigDict(from_attributes=True)

    overall_score: int = Field(..., ge=0, le=100)
    skill_score: float = Field(..., ge=0, le=100)
    experience_score: float = Field(..., ge=0, le=100)
    education_score: float = Field(..., ge=0, le=100)

    matched_skills: List[str] = Field(default_factory=list)
    missing_skills: List[str] = Field(default_factory=list)
    extra_skills: List[str] = Field(default_factory=list)

    recommendation: str = Field(
        ...,
        description='One of: "Highly Recommended", "Recommended", "Consider", "Reject".',
    )


class MatchRequest(BaseModel):
    """Request body for POST /match."""

    candidate_id: uuid.UUID
    job_id: uuid.UUID


class MatchResponse(BaseModel):
    """
    Response for POST /match.

    `result` is the primary payload (the exact requested score shape).
    `candidate_id`/`job_id` are echoed back for convenience when the
    caller is juggling multiple concurrent match requests. `warnings`
    surfaces any non-fatal issues from resume/JD re-parsing or from the
    matching engine itself (e.g. "no required_skills listed"), without
    ever failing the request outright.
    """

    candidate_id: uuid.UUID
    job_id: uuid.UUID
    result: MatchResultSchema
    warnings: List[str] = Field(default_factory=list)
