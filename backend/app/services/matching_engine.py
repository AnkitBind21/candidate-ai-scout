"""
app/services/matching_engine.py
--------------------------------
The ATS Matching Engine: compares a parsed resume (entity_extractor.
ExtractedEntities) against a parsed job description (jd_parser.
JobEntities) and produces a deterministic match score.

Deliberately free of FastAPI, SQLAlchemy, or HTTP concerns — same
convention as entity_extractor.py and jd_parser.py. It only knows how to
turn two already-parsed entity dataclasses into a MatchResult. Fetching a
candidate's resume, fetching a job, and persisting/serving the result are
the API layer's job (see app/api/matching.py).

Score categories (weights sum to 1.0):
    Skills      60%  — required_skills only, case-insensitive, exact match
    Experience  25%  — candidate total years vs. JD min/max_experience
    Education   15%  — highest degree level: resume vs. JD requirement

This module intentionally does ONLY deterministic, rule-based matching.
It's structured so each category is a small, independent, pure function —
see "Extension points" below for how later phases plug in without
disturbing this one.

Extension points (not implemented here — future phases):
    - Semantic skill matching (embeddings) to catch synonyms/near-matches
      that exact string matching misses (e.g. "GCP" vs "Google Cloud").
    - LLM-based scoring for qualitative fit (culture, seniority framing).
    - Project matching (resume ProjectEntry vs JD responsibilities).
    - Publication matching (resume PublicationEntry vs JD research needs).
    - GitHub activity scoring (resume ProjectEntry.url / .links).
  Each of these should land as its own `_score_*` function plus a new
  entry in `_WEIGHTS`, following the exact pattern the three categories
  below already use — `match_resume_to_job` is the only place that needs
  to change to wire a new category in.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from app.services.entity_extractor import EducationEntry, ExperienceEntry, ExtractedEntities
from app.services.jd_parser import JobEntities

# --------------------------------------------------------------------------
# Result dataclass
# --------------------------------------------------------------------------


@dataclass
class MatchResult:
    """
    Result of matching one resume against one job description.
    Serialise with .to_dict() — matches the API response shape exactly.
    """

    overall_score: int = 0
    skill_score: float = 0.0
    experience_score: float = 0.0
    education_score: float = 0.0

    matched_skills: list[str] = field(default_factory=list)
    missing_skills: list[str] = field(default_factory=list)
    extra_skills: list[str] = field(default_factory=list)

    recommendation: str = "Reject"

    # Not part of the required output shape, but useful for debugging/
    # transparency without breaking the contract above — omit from
    # to_dict() rather than remove, in case a future caller wants them.
    candidate_experience_years: float = 0.0
    matching_warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "overall_score": self.overall_score,
            "skill_score": self.skill_score,
            "experience_score": self.experience_score,
            "education_score": self.education_score,
            "matched_skills": self.matched_skills,
            "missing_skills": self.missing_skills,
            "extra_skills": self.extra_skills,
            "recommendation": self.recommendation,
        }


# --------------------------------------------------------------------------
# Weights & recommendation thresholds
# --------------------------------------------------------------------------

_WEIGHTS = {
    "skills": 0.60,
    "experience": 0.25,
    "education": 0.15,
}

_RECOMMENDATION_THRESHOLDS = (
    (90, "Highly Recommended"),
    (75, "Recommended"),
    (60, "Consider"),
)
_DEFAULT_RECOMMENDATION = "Reject"


def _recommendation(overall_score: int) -> str:
    for threshold, label in _RECOMMENDATION_THRESHOLDS:
        if overall_score >= threshold:
            return label
    return _DEFAULT_RECOMMENDATION


# --------------------------------------------------------------------------
# 1. Skill Match (60%)
# --------------------------------------------------------------------------

_WHITESPACE_RE = re.compile(r"\s+")


def _normalize_skill(skill: str) -> str:
    """Case-insensitive, whitespace-collapsed key used for deduping and
    comparing skills. Display values keep their original casing."""
    return _WHITESPACE_RE.sub(" ", skill.strip().lower())


def _dedupe_skills(skills: list[str]) -> dict[str, str]:
    """Maps normalized-key -> first-seen original casing, preserving order."""
    result: dict[str, str] = {}
    for skill in skills:
        key = _normalize_skill(skill)
        if key and key not in result:
            result[key] = skill.strip()
    return result


def _score_skills(
    candidate_skills: list[str],
    required_skills: list[str],
) -> tuple[float, list[str], list[str], list[str]]:
    """
    Exact, case-insensitive matching against JD `required_skills` ONLY
    (preferred_skills are intentionally excluded from scoring, per spec).
    Semantic/fuzzy matching is a future phase — see module docstring.

    Returns (skill_score, matched_skills, missing_skills, extra_skills).
    """
    candidate_by_key = _dedupe_skills(candidate_skills)
    required_by_key = _dedupe_skills(required_skills)

    if not required_by_key:
        # JD lists no required skills — nothing to fail the candidate
        # against, so this category can't penalize them.
        return 100.0, [], [], list(candidate_by_key.values())

    matched = [
        display for key, display in required_by_key.items() if key in candidate_by_key
    ]
    missing = [
        display for key, display in required_by_key.items() if key not in candidate_by_key
    ]
    extra = [
        display for key, display in candidate_by_key.items() if key not in required_by_key
    ]

    score = (len(matched) / len(required_by_key)) * 100
    return round(score, 1), matched, missing, extra


# --------------------------------------------------------------------------
# 2. Experience Match (25%)
# --------------------------------------------------------------------------

_YEAR_RE = re.compile(r"(?:19|20)\d{2}")


def _extract_year(date_text: str | None) -> int | None:
    if not date_text:
        return None
    match = _YEAR_RE.search(date_text)
    return int(match.group(0)) if match else None


def _estimate_total_experience_years(experience: list[ExperienceEntry]) -> float:
    """
    Deterministic, best-effort total professional experience in years,
    derived from each ExperienceEntry's free-text start_date/end_date.

    Intentionally simple: year-level granularity, entries are summed
    without de-duplicating overlapping date ranges. That's a reasonable
    v1 given start_date/end_date are unnormalized free text (e.g. "Jan
    2022", "2022", "Present") — precise overlap-aware date math is a good
    candidate for a later, smarter pass, not part of this deterministic
    matching phase.
    """
    if not experience:
        return 0.0

    current_year = datetime.utcnow().year
    total = 0.0

    for entry in experience:
        start_year = _extract_year(entry.start_date)
        if start_year is None:
            continue

        end_year = current_year if entry.is_current else (_extract_year(entry.end_date) or start_year)
        span = end_year - start_year

        if span > 0:
            total += span
        else:
            # Same-year entry (e.g. a short contract) — some experience,
            # not zero.
            total += 0.5

    return round(total, 1)


def _score_experience(
    candidate_years: float,
    min_experience: int | None,
    max_experience: int | None,
) -> float:
    """
    100 when candidate_years falls within [min_experience, max_experience].
    Below the minimum, the score scales down linearly toward 0. Above the
    maximum ("overqualified"), a mild, capped penalty applies rather than
    a hard cliff — overqualification is a softer signal than
    underqualification.
    """
    if min_experience is None and max_experience is None:
        # JD doesn't specify an experience requirement.
        return 100.0

    if min_experience is not None and min_experience > 0 and candidate_years < min_experience:
        return round(max(0.0, (candidate_years / min_experience) * 100), 1)

    if max_experience is not None and candidate_years > max_experience:
        overage_years = candidate_years - max_experience
        penalty = min(30.0, overage_years * 5)
        return round(max(70.0, 100.0 - penalty), 1)

    return 100.0


# --------------------------------------------------------------------------
# 3. Education Match (15%)
# --------------------------------------------------------------------------

# Ordered highest -> lowest so the loop below can just take the max level
# found in a piece of text. Deliberately a NEW, purpose-built ranking
# table rather than reusing entity_extractor's degree-detection regex:
# that one only needs to answer "is a degree mentioned here at all", not
# "which is the HIGHER of two degrees" — a genuinely different job.
_DEGREE_LEVELS: list[tuple[re.Pattern[str], int]] = [
    (re.compile(r"\bph\.?d\.?\b|\bdoctorate\b", re.IGNORECASE), 4),
    (
        re.compile(
            r"\bmaster'?s?\b|\bm\.?tech\.?\b|\bm\.?e\.?\b|\bmba\b|\bm\.?s\.?c?\.?\b|\bm\.?a\.?\b",
            re.IGNORECASE,
        ),
        3,
    ),
    (
        re.compile(
            r"\bbachelor'?s?\b|\bb\.?tech\.?\b|\bb\.?e\.?\b|\bb\.?s\.?c?\.?\b|\bb\.?a\.?\b|\bb\.?com\.?\b",
            re.IGNORECASE,
        ),
        2,
    ),
    (re.compile(r"\bassociate'?s?\b|\bdiploma\b", re.IGNORECASE), 1),
]


def _degree_level(text: str | None) -> int:
    """Highest recognized degree level implied by a text phrase; 0 if none."""
    if not text:
        return 0
    return max((level for pattern, level in _DEGREE_LEVELS if pattern.search(text)), default=0)


def _score_education(resume_education: list[EducationEntry], jd_education: list[str]) -> float:
    """
    Compares the candidate's highest recognized degree level against the
    highest degree level implied anywhere in the JD's education
    requirements. Field-of-study matching (e.g. "Computer Science" vs
    "Information Technology") is deferred to a future semantic-matching
    phase — for now this is a degree-*level* comparison only.
    """
    if not jd_education:
        # JD doesn't specify an education requirement.
        return 100.0

    required_level = max((_degree_level(item) for item in jd_education), default=0)
    if required_level == 0:
        # JD mentions education but nothing we recognize as a concrete
        # degree level (e.g. just "related field required") — nothing to
        # check the candidate against.
        return 100.0

    candidate_level = 0
    for entry in resume_education:
        candidate_level = max(
            candidate_level,
            _degree_level(entry.degree),
            _degree_level(entry.raw),
        )

    if candidate_level >= required_level:
        return 100.0
    if candidate_level == required_level - 1:
        return 60.0
    if candidate_level > 0:
        return 30.0
    return 0.0


# --------------------------------------------------------------------------
# Public entrypoint
# --------------------------------------------------------------------------


def match_resume_to_job(resume: ExtractedEntities, job: JobEntities) -> MatchResult:
    """
    Runs deterministic matching between one parsed resume and one parsed
    job description.

    Args:
        resume: ExtractedEntities from entity_extractor.extract_entities().
        job:    JobEntities from jd_parser.extract_jd_entities().

    Returns:
        MatchResult — typed dataclass with a .to_dict() method matching
        the required API response shape.

    Designed to be called from:
    - The POST /match API endpoint (see app/api/matching.py).
    - A batch re-scoring worker (e.g. nightly re-rank of all candidates
      for an open job).
    - Unit tests, CLI scripts, notebooks.
    """
    warnings: list[str] = []

    skill_score, matched_skills, missing_skills, extra_skills = _score_skills(
        resume.skills, job.required_skills
    )
    if not job.required_skills:
        warnings.append("Job has no required_skills listed; skill_score defaulted to 100.")

    candidate_years = _estimate_total_experience_years(resume.experience)
    experience_score = _score_experience(candidate_years, job.min_experience, job.max_experience)
    if not resume.experience:
        warnings.append("Resume has no parsed experience entries; assuming 0 years.")

    education_score = _score_education(resume.education, job.education)

    overall = (
        skill_score * _WEIGHTS["skills"]
        + experience_score * _WEIGHTS["experience"]
        + education_score * _WEIGHTS["education"]
    )
    overall_score = round(overall)
    overall_score = min(100, max(0, overall_score))

    return MatchResult(
        overall_score=overall_score,
        skill_score=skill_score,
        experience_score=experience_score,
        education_score=education_score,
        matched_skills=matched_skills,
        missing_skills=missing_skills,
        extra_skills=extra_skills,
        recommendation=_recommendation(overall_score),
        candidate_experience_years=candidate_years,
        matching_warnings=warnings,
    )
