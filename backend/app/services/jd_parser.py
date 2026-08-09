"""
app/services/jd_parser.py
--------------------------
Production-ready Job Description (JD) parser.

Architecture mirrors resume_parser.py + entity_extractor.py deliberately —
same dataclass + to_dict() pattern, same exception hierarchy, same two-phase
design (raw text → ParsedJD → JobEntities).

Design contract
~~~~~~~~~~~~~~~
Input:  raw_text (str)  — JD text pasted by a recruiter, copied from a
                          job board, or extracted from a PDF/DOCX upstream.
                          This module does NOT do file I/O; that belongs to
                          the caller (router, CLI, background task).

Output: JobEntities     — typed dataclass, JSON-serialisable via .to_dict().
                          Consumed by the /jobs/parse-jd API endpoint and,
                          in the future, by the job-matching scoring pipeline.

Two-pass parsing strategy
~~~~~~~~~~~~~~~~~~~~~~~~~
PASS 1 — Structured header detection.
  Scans the text line-by-line for known section headers using the same
  _normalize_header_candidate() logic as resume_parser.py.  Each detected
  section is buffered until the next header.  Works for JDs formatted like:

      Required Skills:
      - Python
      - FastAPI

  Extended to handle JD-style labelled-field lines where the header and
  value share one line ("Employment Type: Contract", "Location: Mumbai").
  The value is seeded into the section buffer so extraction is seamless.

PASS 2 — Inline / paragraph extraction.
  Used unconditionally for fields that are almost never given their own
  section heading even in structured JDs (title, employment type, experience
  range), and as the sole method for fully unstructured paragraphs where
  PASS 1 detects no sections at all.

No AI, no LLM, no spaCy
~~~~~~~~~~~~~~~~~~~~~~~~
JD parsing is purely regex + heuristics.  This keeps jd_parser.py importable
without the spaCy model and makes every extraction decision deterministic and
unit-testable.  The skill-splitting logic is a local copy of the same
implementation used in entity_extractor.py; it is reproduced here rather than
imported to avoid pulling in the spaCy module-level singleton at import time.
"""

from __future__ import annotations

import logging
import re
import unicodedata
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Exceptions — framework-agnostic, mirrors ResumeParsingError hierarchy
# ---------------------------------------------------------------------------


class JDParsingError(Exception):
    """Base class for all JD parsing failures."""


class JDEmptyError(JDParsingError):
    """The supplied text is empty or whitespace-only."""


class JDTooShortError(JDParsingError):
    """The supplied text is too short to be a real job description."""


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

# Minimum character count to be considered a real JD.
MIN_JD_LENGTH = 30

# Skills section content longer than this is truncated before splitting,
# bounding worst-case processing time while still covering real JDs.
MAX_SKILLS_SECTION_LENGTH = 8_000


# ---------------------------------------------------------------------------
# Output types
# ---------------------------------------------------------------------------


@dataclass
class JobEntities:
    """
    All entities extracted from a single job description.

    Every field defaults to None or [] so callers can always safely read
    any field without an existence check.  Serialise with .to_dict().

    Fields map directly to the Job SQLAlchemy model columns (models/job.py)
    so the router can propagate extracted values to JobCreate/JobUpdate
    without any field-name translation.
    """

    # ── Core identity ─────────────────────────────────────────────────────────
    title: str | None = None
    department: str | None = None
    location: str | None = None
    employment_type: str | None = None

    # ── Experience ────────────────────────────────────────────────────────────
    min_experience: int | None = None
    max_experience: int | None = None

    # ── Skills ───────────────────────────────────────────────────────────────
    required_skills: list[str] = field(default_factory=list)
    preferred_skills: list[str] = field(default_factory=list)

    # ── Content ──────────────────────────────────────────────────────────────
    responsibilities: list[str] = field(default_factory=list)
    qualifications: list[str] = field(default_factory=list)
    education: list[str] = field(default_factory=list)

    # ── Meta ─────────────────────────────────────────────────────────────────
    parsing_warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "title": self.title,
            "department": self.department,
            "location": self.location,
            "employment_type": self.employment_type,
            "min_experience": self.min_experience,
            "max_experience": self.max_experience,
            "required_skills": self.required_skills,
            "preferred_skills": self.preferred_skills,
            "responsibilities": self.responsibilities,
            "qualifications": self.qualifications,
            "education": self.education,
            "parsing_warnings": self.parsing_warnings,
        }


@dataclass
class ParsedJD:
    """
    Intermediate representation produced by parse_jd(), consumed by
    extract_jd_entities().  Mirrors ParsedResume from resume_parser.py.

    full_text:         Cleaned, normalised JD text.
    detected_sections: Dict mapping canonical section names to their
                       buffered content (str) or None if not found.
                       Keys always present: Title, RequiredSkills,
                       PreferredSkills, Responsibilities, Qualifications,
                       Education, Location, Department, EmploymentType,
                       Experience.
    is_structured:     True when at least one section header was detected.
    word_count:        Token count of full_text.
    warnings:          Non-fatal issues encountered during parsing.
    """

    full_text: str
    detected_sections: dict[str, str | None]
    is_structured: bool
    word_count: int
    warnings: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# JD section names — the canonical keys used throughout this module
# ---------------------------------------------------------------------------

_JD_SECTION_NAMES = (
    "Title",
    "RequiredSkills",
    "PreferredSkills",
    "Responsibilities",
    "Qualifications",
    "Education",
    "Location",
    "Department",
    "EmploymentType",
    "Experience",
)

# Canonical section name → list of regex patterns that match its header.
# Patterns are applied against the *normalised* line (see
# _normalize_header_candidate), so decorative markers (":", "#",
# bullets, trailing spaces) are stripped before matching.
_JD_SECTION_PATTERNS: dict[str, list[str]] = {
    "RequiredSkills": [
        r"^required\s+skills?$",
        r"^must\s+have\s+skills?$",
        r"^mandatory\s+skills?$",
        r"^technical\s+skills?\s+required$",
        r"^key\s+skills?$",
        r"^core\s+skills?$",
        r"^skills?\s+required$",
        r"^skills?$",
        r"^technical\s+skills?$",
        r"^primary\s+skills?$",
    ],
    "PreferredSkills": [
        r"^preferred\s+skills?$",
        r"^nice\s+to\s+have\s+skills?$",
        r"^nice\s+to\s+have$",           # common shorthand without "skills" suffix
        r"^good\s+to\s+have\s+skills?$",
        r"^good\s+to\s+have$",
        r"^optional\s+skills?$",
        r"^bonus\s+skills?$",
        r"^additional\s+skills?$",
        r"^secondary\s+skills?$",
        r"^desired\s+skills?$",
        r"^would\s+be\s+a\s+plus$",
        r"^added\s+advantage$",
        r"^value[\s-]add(?:s)?$",
    ],
    "Responsibilities": [
        r"^responsibilities?$",
        r"^key\s+responsibilities?$",
        r"^job\s+responsibilities?$",
        r"^role\s+(?:and\s+)?responsibilities?$",
        r"^duties$",
        r"^key\s+duties$",
        r"^what\s+you(?:'ll|'d)?\s+do$",
        r"^your\s+role$",
        r"^day[- ]to[- ]day\s+responsibilities?$",
    ],
    "Qualifications": [
        r"^qualifications?$",
        r"^minimum\s+qualifications?$",
        r"^required\s+qualifications?$",
        r"^requirements?$",
        r"^job\s+requirements?$",
        r"^candidate\s+requirements?$",
        r"^what\s+(?:we(?:'re)?\s+looking\s+for|you(?:'ll)?\s+need)$",
        r"^who\s+(?:we(?:'re)?\s+looking\s+for|you\s+are)$",
        r"^skills?\s+(?:and\s+)?qualifications?$",
    ],
    "Education": [
        r"^education(?:al)?\s*(?:requirements?|qualifications?)?$",
        r"^academic\s+(?:background|requirements?|qualifications?)$",
        r"^degree\s+requirements?$",
    ],
    "Location": [
        r"^location$",
        r"^work\s+location$",
        r"^job\s+location$",
        r"^office\s+location$",
        r"^place\s+of\s+work$",
    ],
    "Department": [
        r"^department$",
        r"^team$",
        r"^division$",
        r"^business\s+unit$",
        r"^function$",
    ],
    "EmploymentType": [
        r"^employment\s+type$",
        r"^job\s+type$",
        r"^position\s+type$",
        r"^contract\s+type$",
        r"^work\s+(?:type|mode|arrangement)$",
        r"^type\s+of\s+(?:employment|position|role)$",
    ],
    "Experience": [
        r"^experience(?:\s+required)?$",
        r"^work\s+experience$",
        r"^required\s+experience$",
        r"^years?\s+of\s+experience$",
        r"^minimum\s+experience$",
        r"^experience\s+level$",
    ],
}

_JD_COMPILED_PATTERNS: dict[str, list[re.Pattern]] = {
    name: [re.compile(p, re.IGNORECASE) for p in patterns]
    for name, patterns in _JD_SECTION_PATTERNS.items()
}

# Non-target JD headers that should stop content capture from whatever
# target section came immediately before.
_JD_OTHER_HEADER_RE = re.compile(
    r"^(?:"
    r"about\s+(?:us|the\s+(?:company|role|job|team|position))|"
    r"company\s+(?:overview|description|profile)|"
    r"overview|introduction|summary|"
    r"benefits?|perks?|what\s+we\s+offer|"
    r"compensation|salary|pay|"
    r"interview\s+process|hiring\s+process|"
    r"how\s+to\s+apply|application\s+(?:process|instructions?)|"
    r"equal\s+opportunity|diversity|"
    r"notes?|additional\s+(?:information|details?)"
    r")$",
    re.IGNORECASE,
)

_MAX_HEADER_LINE_LENGTH = 60


# ---------------------------------------------------------------------------
# Text cleaning — same pipeline as resume_parser.clean_text()
# ---------------------------------------------------------------------------

_CONTROL_CHARS_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_HYPHEN_LINEBREAK_RE = re.compile(r"(\w)-\n(\w)")
_MULTI_BLANK_LINES_RE = re.compile(r"\n{3,}")
_MULTI_SPACE_RE = re.compile(r"[ \t]{2,}")
_BULLET_CHARS = "•◦▪‣∙●○■□➤➢★✓✔"
_BULLET_LINE_RE = re.compile(rf"^[{re.escape(_BULLET_CHARS)}]\s*", re.MULTILINE)
# ASCII markdown-style bullet markers ("* item", "+ item"). Handled by a
# separate, stricter pattern than _BULLET_LINE_RE: a mandatory trailing
# space is required so "*bold*" (emphasis, no space after the marker) and
# "+1 415 555 0123" (a phone number, no space right after "+") are never
# mistaken for a bullet. The unicode glyphs in _BULLET_CHARS are unambiguous
# bullet-only characters, so they don't need this extra guard.
_ASCII_BULLET_LINE_RE = re.compile(r"^[*+]\s+", re.MULTILINE)


def _clean_text(raw_text: str) -> str:
    """
    Normalises JD text using the same pipeline as resume_parser.clean_text().
    Kept as a private copy so jd_parser is importable without resume_parser.
    """
    if not raw_text:
        return ""
    text = unicodedata.normalize("NFKC", raw_text)
    text = _CONTROL_CHARS_RE.sub("", text)
    text = _HYPHEN_LINEBREAK_RE.sub(r"\1\2", text)
    text = _BULLET_LINE_RE.sub("- ", text)
    text = _ASCII_BULLET_LINE_RE.sub("- ", text)
    text = _MULTI_SPACE_RE.sub(" ", text)
    text = "\n".join(line.strip() for line in text.splitlines())
    text = _MULTI_BLANK_LINES_RE.sub("\n\n", text)
    return text.strip()


# ---------------------------------------------------------------------------
# Header normalisation
# ---------------------------------------------------------------------------


def _normalize_header_candidate(line: str) -> str:
    """
    Strips decorative wrapping so headers like "== Required Skills ==",
    "**Responsibilities:**", "3. Qualifications:" all reduce to their bare
    text before pattern matching.

    Extended from the resume_parser version to also handle JD-style
    labelled-field lines where the header and its value share one line:

        "Employment Type: Contract"  →  "Employment Type"
        "Location: Mumbai, India"    →  "Location"
        "Department: Engineering"    →  "Department"

    The colon-split only fires when the text before the colon is ≤ 50 chars
    and looks like a label (letters, spaces, and a small set of punctuation),
    and there is a non-whitespace value after the colon.  Full-sentence lines
    like "We are looking for engineers who have:" are left intact so they
    don't accidentally match a section header pattern.
    """
    stripped = line.strip()

    # Strip "field value" from labelled lines before other normalisations.
    colon_match = re.match(
        r"^([A-Za-z][A-Za-z0-9 /&()'.\-]{0,50}):\s+\S",
        stripped,
    )
    if colon_match:
        stripped = colon_match.group(1).strip()

    stripped = re.sub(r"^[^A-Za-z]+", "", stripped)
    stripped = re.sub(r"[^A-Za-z\s]+$", "", stripped)
    stripped = re.sub(r"\s+", " ", stripped)
    return stripped.strip()


def _match_jd_section_header(line: str) -> str | None:
    """Returns the canonical JD section name if *line* looks like a header."""
    candidate = _normalize_header_candidate(line)
    if not candidate or len(candidate) > _MAX_HEADER_LINE_LENGTH:
        return None
    for canonical, patterns in _JD_COMPILED_PATTERNS.items():
        for pattern in patterns:
            if pattern.match(candidate):
                return canonical
    return None


def _is_jd_other_known_header(line: str) -> bool:
    candidate = _normalize_header_candidate(line)
    if not candidate or len(candidate) > _MAX_HEADER_LINE_LENGTH:
        return False
    return bool(_JD_OTHER_HEADER_RE.match(candidate))


# ---------------------------------------------------------------------------
# Section detection — PASS 1 (structured JD)
# ---------------------------------------------------------------------------

# Matches "Header: inline value" lines so the value can be seeded into the
# section buffer even when header and value share one line.
_INLINE_VALUE_RE = re.compile(r"^[A-Za-z][A-Za-z0-9 /&()'.\-]{0,50}:\s+(.+)$")


def _detect_jd_sections(text: str) -> tuple[dict[str, str | None], bool]:
    """
    Scans cleaned text line-by-line for JD section headers and buffers each
    section's content until the next header.

    When a header line also contains its value inline
    ("Employment Type: Contract"), the value is seeded into the buffer so
    single-line fields are captured correctly.

    Returns (sections_dict, is_structured) where is_structured is True when
    at least one target section header was found.
    """
    sections: dict[str, str | None] = {name: None for name in _JD_SECTION_NAMES}
    buffers: dict[str, list[str]] = {name: [] for name in _JD_SECTION_NAMES}

    current_section: str | None = None
    any_header_found = False

    for line in text.splitlines():
        header_match = _match_jd_section_header(line)
        if header_match:
            current_section = header_match
            any_header_found = True
            # If the line is "Header: value", seed the buffer with the value
            # so single-line fields are never empty due to the header format.
            inline_m = _INLINE_VALUE_RE.match(line.strip())
            if inline_m:
                buffers[current_section].append(inline_m.group(1).strip())
            continue

        if current_section and _is_jd_other_known_header(line):
            current_section = None
            continue

        if current_section:
            buffers[current_section].append(line.strip())

    for name, lines in buffers.items():
        if lines:
            content = "\n".join(lines).strip()
            content = _MULTI_BLANK_LINES_RE.sub("\n\n", content)
            sections[name] = content[:MAX_SKILLS_SECTION_LENGTH]

    return sections, any_header_found


# ---------------------------------------------------------------------------
# Compiled regex patterns for entity extraction
# ---------------------------------------------------------------------------

# ── Title heuristics ──────────────────────────────────────────────────────────
_LABEL_LINE_RE = re.compile(r"^\s*[A-Za-z][A-Za-z\s/&]{0,40}:\s*.+$")

# Paragraph-only heuristic: pulls just the title noun phrase out of a
# hiring-intent sentence, e.g. "We are looking for an AI Automation
# Specialist who will design..." -> "AI Automation Specialist". Captures a
# run of capitalized-word tokens right after the trigger phrase and stops
# at the first lowercase word (typically "who"/"to"/"that"/etc.), so the
# rest of the sentence is never swept in.
_TITLE_PHRASE_RE = re.compile(
    r"\b(?:looking\s+for|seeking|hiring\s+for|hiring|in\s+search\s+of|"
    r"searching\s+for)\s+(?:an?\s+)?"
    r"((?:[A-Z][\w&/+-]*)(?:\s+[A-Z][\w&/+-]*)*)"
)

# ── Experience range ──────────────────────────────────────────────────────────
_EXP_RANGE_RE = re.compile(
    r"(\d+)\s*[-–—to]+\s*(\d+)\s*\+?\s*(?:years?|yrs?)",
    re.IGNORECASE,
)
_EXP_MIN_ONLY_RE = re.compile(
    r"(?:minimum|min\.?|at\s+least|over|more\s+than)\s+(\d+)\s*\+?\s*(?:years?|yrs?)",
    re.IGNORECASE,
)
_EXP_SINGLE_RE = re.compile(
    r"(\d+)\s*\+?\s*(?:years?|yrs?)\s+(?:of\s+)?(?:experience|exp\b|work|professional)",
    re.IGNORECASE,
)
_EXP_PLUS_RE = re.compile(
    r"(\d+)\s*\+\s*(?:years?|yrs?)",
    re.IGNORECASE,
)

# ── Employment type ───────────────────────────────────────────────────────────
_EMP_TYPE_RE = re.compile(
    r"\b(full[- ]time|part[- ]time|contract(?:or)?|freelance|"
    r"intern(?:ship)?|temporary|remote|hybrid|on[- ]site)\b",
    re.IGNORECASE,
)

_EMP_TYPE_CANONICAL: dict[str, str] = {
    "full-time": "full-time",
    "full time": "full-time",
    "part-time": "part-time",
    "part time": "part-time",
    "contract": "contract",
    "contractor": "contract",
    "freelance": "freelance",
    "internship": "internship",
    "intern": "internship",
    "temporary": "temporary",
    "remote": "remote",
    "hybrid": "hybrid",
    "on-site": "on-site",
    "on site": "on-site",
}

# ── Location ──────────────────────────────────────────────────────────────────
_LOCATION_LABEL_RE = re.compile(
    r"^(?:location|place|city|office\s*(?:location)?|"
    r"based\s+(?:in|at)|work\s+location|job\s+location)\s*:\s*(.+)$",
    re.IGNORECASE | re.MULTILINE,
)
_INLINE_LOC_RE = re.compile(
    r"(?i:\b(?:located?\s+(?:in|at)|based\s+(?:in|at)|position\s+in|role\s+in))\s+"
    r"([A-Z][a-zA-Z]*(?:[\s,]+[A-Z][a-zA-Z]*){0,3})"
)

# ── Department ────────────────────────────────────────────────────────────────
_DEPT_LABEL_RE = re.compile(
    r"^(?:department|team|division|business\s+unit|function)\s*:\s*(.+)$",
    re.IGNORECASE | re.MULTILINE,
)

# ── Degree / education ────────────────────────────────────────────────────────
_DEGREE_RE = re.compile(
    r"\b(?:"
    r"B\.?S\.?c?\.?|B\.?E\.?|B\.?Tech\.?|B\.?A\.?|B\.?Com\.?|"
    r"M\.?S\.?c?\.?|M\.?E\.?|M\.?Tech\.?|M\.?B\.?A\.?|M\.?A\.?|M\.?Sc\.?|"
    r"Ph\.?D\.?|Doctor(?:ate)?(?:\s+of\s+\w+)?|"
    r"Bachelor(?:'s)?\s*(?:of\s+\w+(?:\s+\w+)*)?|"
    r"Master(?:'s)?\s*(?:of\s+\w+(?:\s+\w+)*)?|"
    r"Associate(?:'s)?|Diploma|Certificate|High\s+School|Secondary|"
    r"B\.Eng\.|M\.Eng\.|LL\.B|LL\.M|BBA|MBA|MCA|BCA"
    r")\b",
    re.IGNORECASE,
)

# ── Preferred skill markers ───────────────────────────────────────────────────
_PREFERRED_MARKER_RE = re.compile(
    r"\b(?:preferred|nice\s+to\s+have|good\s+to\s+have|bonus|"
    r"advantage|desirable|optional|beneficial|would\s+be\s+a\s+plus|"
    r"plus\s+if|added\s+advantage|value[\s-]add)\b",
    re.IGNORECASE,
)

# ── Responsibility / bullet list ──────────────────────────────────────────────
_BULLET_ITEM_RE = re.compile(r"^-\s+(.+)$")

# ── Skill delimiters (identical to entity_extractor._SKILL_DELIMITER_RE) ─────
_SKILL_DELIMITER_RE = re.compile(r"[,;|\n]|(?:\s*[-•·]\s+)")
_SKILL_NOISE_RE = re.compile(r"[<>{}()\[\]@#$%^&*=+~`]|https?://|www\.")
_SKILL_CATEGORY_PREFIX_RE = re.compile(r"^\s*[A-Za-z][A-Za-z0-9/&+\-\s]{0,40}:\s*")
_YEAR_TOKEN_RE = re.compile(r"^\d{4}$")

# ── Section header keywords that must not be treated as a title ───────────────
_JD_SECTION_KEYWORDS: set[str] = {
    s.lower()
    for s in list(_JD_SECTION_PATTERNS.keys()) + [
        "required", "skills", "responsibilities", "qualifications",
        "education", "location", "department", "experience", "overview",
        "description", "summary", "requirements", "benefits",
    ]
}


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------


def _split_skills(text: str) -> list[str]:
    """
    Split a skills block into individual skill tokens, clean, and deduplicate.

    This is a local copy of entity_extractor._extract_skills() — reproduced
    here (rather than imported) to avoid pulling in the spaCy singleton that
    entity_extractor loads at module import time.  The logic is identical.
    """
    if not text:
        return []

    text = re.sub(r"^[-•·▪]\s*", "", text, flags=re.MULTILINE)
    text = "\n".join(
        _SKILL_CATEGORY_PREFIX_RE.sub("", line) for line in text.splitlines()
    )

    raw_tokens = _SKILL_DELIMITER_RE.split(text)
    seen: set[str] = set()
    cleaned: list[str] = []

    for token in raw_tokens:
        token = token.strip()
        if not token or len(token) < 2:
            continue
        if _SKILL_NOISE_RE.search(token):
            continue
        if _YEAR_TOKEN_RE.match(token):
            continue
        if len(token) > 60:
            continue
        if sum(c.isdigit() for c in token) > len(token) / 2:
            continue
        key = token.lower()
        if key not in seen:
            seen.add(key)
            cleaned.append(token)

    return cleaned


def _extract_experience_range(text: str) -> tuple[int | None, int | None]:
    """
    Extract min and max years of experience from *text*.

    Priority:
    1. Explicit range ("0–2 years", "3 to 5 years")
    2. Minimum-only phrasing ("minimum 3 years", "at least 5 years")
    3. Single-mention with experience keyword ("5 years of experience")
    4. Plus notation ("2+ years")
    """
    m = _EXP_RANGE_RE.search(text)
    if m:
        return int(m.group(1)), int(m.group(2))

    m = _EXP_MIN_ONLY_RE.search(text)
    if m:
        return int(m.group(1)), None

    m = _EXP_SINGLE_RE.search(text)
    if m:
        return int(m.group(1)), None

    m = _EXP_PLUS_RE.search(text)
    if m:
        return int(m.group(1)), None

    return None, None


def _extract_employment_type(text: str) -> str | None:
    """
    Identify the employment type from *text*, returning a canonical lowercase
    string ("full-time", "part-time", "contract", "internship", …) or None.
    """
    m = _EMP_TYPE_RE.search(text)
    if not m:
        return None
    raw = m.group(1).lower()
    return _EMP_TYPE_CANONICAL.get(raw, raw)


def _extract_location(text: str) -> str | None:
    """
    Prefer an explicit "Location: …" label; fall back to inline prose
    ("We are located in Mumbai, India.").
    """
    m = _LOCATION_LABEL_RE.search(text)
    if m:
        return m.group(1).strip()

    m = _INLINE_LOC_RE.search(text)
    if m:
        return m.group(1).strip().rstrip(",")

    return None


def _extract_department(text: str) -> str | None:
    """Extract department from a labelled field line."""
    m = _DEPT_LABEL_RE.search(text)
    return m.group(1).strip() if m else None


def _looks_like_non_title_line(line: str) -> bool:
    """
    True if *line* is clearly a value belonging to a DIFFERENT JD field
    (experience, employment type, or location) rather than a job title.

    Used to guard the "first meaningful line" fallback in _extract_title().
    That heuristic only checked for labelled fields ("Field: value") and
    known section-header keywords -- it had no way to recognise an
    *unlabelled* value line like a bare "5+ years" sitting on its own line,
    so it would happily return it as the title. This reuses the same
    regexes already used elsewhere in this module to extract those fields,
    so a line is only rejected here if it would ALSO be recognised as one
    of those fields by the module's own extractors.
    """
    # Experience mentions: "5+ years", "3-5 years", "minimum 3 years", etc.
    if (
        _EXP_RANGE_RE.search(line)
        or _EXP_MIN_ONLY_RE.search(line)
        or _EXP_SINGLE_RE.search(line)
        or _EXP_PLUS_RE.search(line)
    ):
        return True

    # Employment type: reject only if the WHOLE line (aside from a trailing
    # period) is nothing but an employment-type value, e.g. "Full-Time" or
    # "Remote" on its own -- not a genuine title that merely mentions one,
    # like "Remote Support Engineer".
    if _EMP_TYPE_RE.fullmatch(line.strip().rstrip(".")):
        return True

    # Inline location phrasing: "Based in Mumbai", "Located in Pune", etc.
    if _INLINE_LOC_RE.search(line):
        return True

    # Catch-all for bare numeric/experience lines not matched above (e.g. a
    # stray "3-5" range with no "years" suffix): a line where digits make up
    # at least half of its letter+digit content is not a job title.
    digits = sum(c.isdigit() for c in line)
    letters = sum(c.isalpha() for c in line)
    if digits > 0 and digits >= letters:
        return True

    return False


def _extract_title(full_text: str, section_title: str | None) -> str | None:
    """
    Extract the job title using three strategies in priority order:

    1. Content of the detected "Title" section (structured JDs that have an
       explicit "Job Title:" header).
    2. Inline label: "Job Title:", "Position:", "Role:" on the first 10 lines.
    3. First meaningful line heuristic: the first non-blank line that is
       short (≤ 80 chars), not a labelled field, not a known section keyword,
       and not a numeric experience/employment-type/location value.
    """
    if section_title and section_title.strip():
        return section_title.strip().splitlines()[0].strip()

    _TITLE_LABEL_RE = re.compile(
        r"^(?:job\s+)?(?:title|position|role|designation|opening)\s*:\s*(.+)$",
        re.IGNORECASE,
    )

    lines = [ln.strip() for ln in full_text.splitlines() if ln.strip()]

    for line in lines[:10]:
        m = _TITLE_LABEL_RE.match(line)
        if m:
            return m.group(1).strip()

    # Priority 3 — "We are looking for an AI Automation Specialist who..."
    # style sentences: pull out just the capitalized title phrase rather
    # than falling through to the raw first-line heuristic below, which
    # would otherwise return the entire sentence.
    for line in lines[:10]:
        m = _TITLE_PHRASE_RE.search(line)
        if m:
            phrase = m.group(1).strip()
            if len(phrase.split()) >= 2 and phrase.lower() not in _JD_SECTION_KEYWORDS:
                return phrase

    for line in lines[:8]:
        if len(line) > 80:
            continue
        if _LABEL_LINE_RE.match(line):
            continue
        normalized = _normalize_header_candidate(line)
        if normalized.lower() in _JD_SECTION_KEYWORDS:
            continue
        # Never return a section header as the title -- covers headers
        # like "Required Skills:" that _match_jd_section_header() already
        # recognises (via its own regex patterns) but the plain keyword
        # check above misses, plus any bare "Label:" line in general.
        if _match_jd_section_header(line) is not None:
            continue
        if line.rstrip().endswith(":"):
            continue
        if len(line.split()) < 2:
            continue
        if _looks_like_non_title_line(line):
            continue
        return line

    return None


def _extract_bullets(text: str) -> list[str]:
    """
    Extract bullet points ("- …" after _clean_text normalisation) from *text*.
    Each bullet is stripped of its leading "- " and returned as a plain string.
    """
    items: list[str] = []
    for line in text.splitlines():
        m = _BULLET_ITEM_RE.match(line.strip())
        if m:
            items.append(m.group(1).strip())
    return items


def _extract_prose_sentences(text: str, min_length: int = 20) -> list[str]:
    """
    Split *text* into sentences (or meaningful line-based items) for sections
    like Responsibilities / Qualifications presented as prose rather than lists.
    """
    items: list[str] = []
    for line in text.splitlines():
        line = line.strip().lstrip("- ").strip()
        if len(line) >= min_length:
            if len(line) > 200:
                parts = re.split(r"(?<=[.!?])\s+", line)
                items.extend(p.strip() for p in parts if len(p.strip()) >= min_length)
            else:
                items.append(line)
    return items


def _extract_list_or_prose(text: str) -> list[str]:
    """
    Prefer bullet extraction; fall back to prose sentence splitting.
    """
    bullets = _extract_bullets(text)
    return bullets if bullets else _extract_prose_sentences(text)


def _extract_education_from_text(text: str) -> list[str]:
    """
    Extract education requirements as a list of strings from a section block.
    Tries bullets first; falls back to degree-keyword line scan.
    """
    bullets = _extract_bullets(text)
    if bullets:
        return [b for b in bullets if _DEGREE_RE.search(b) or len(b) > 5]

    degree_lines: list[str] = []
    for line in text.splitlines():
        line = line.strip()
        if _DEGREE_RE.search(line) and len(line) >= 5:
            degree_lines.append(line)
    return degree_lines


# Words/punctuation that end a degree phrase once we're inside its
# trailing "in/of <Field>" clause, e.g. "...in Computer Science or related
# field" should stop at " or", not swallow "or related field" too.
_DEGREE_PHRASE_STOP_RE = re.compile(
    r"\s+(?:or|and|with|who|required|preferred|is|are|plus|while|but)\b|[.,;]",
    re.IGNORECASE,
)


def _extract_degree_phrase(sentence: str) -> str | None:
    """
    Isolates just the degree phrase from a sentence — e.g. "Bachelor's
    Degree in Computer Science" out of "...should have a Bachelor's
    Degree in Computer Science or related field with 3+ years..." —
    instead of returning the whole sentence (paragraph-only helper; the
    structured Education-section extractor is untouched).
    """
    m = _DEGREE_RE.search(sentence)
    if not m:
        return None

    end = m.end()
    remainder = sentence[end:]

    # Optionally fold in a following literal "Degree" word, e.g.
    # "Bachelor's" + " Degree" -> "Bachelor's Degree".
    degree_word_m = re.match(r"\s*Degree\b", remainder, re.IGNORECASE)
    if degree_word_m:
        end += degree_word_m.end()
        remainder = sentence[end:]

    # Optionally fold in a trailing "in/of <Field>" clause, stopping at
    # the first sentence-continuation word or punctuation so we don't
    # swallow the rest of the sentence.
    field_m = re.match(r"\s+(?:in|of)\s+", remainder, re.IGNORECASE)
    if field_m:
        field_start = end + field_m.end()
        stop_m = _DEGREE_PHRASE_STOP_RE.search(sentence[field_start:])
        end = field_start + stop_m.start() if stop_m else len(sentence)

    phrase = sentence[m.start():end].strip().rstrip(",;.")
    return phrase or None


def _extract_education_from_prose(full_text: str) -> list[str]:
    """
    Fallback for unstructured JDs: scan the whole text for sentences
    containing a degree keyword and pull out just the degree phrase
    (e.g. "Bachelor's Degree in Computer Science"), not the entire
    surrounding sentence/paragraph.
    """
    results: list[str] = []
    seen: set[str] = set()
    for line in full_text.splitlines():
        line = line.strip()
        if not line:
            continue
        # A paragraph JD may pack multiple sentences onto one line; split
        # so the degree-phrase search below stays scoped to one sentence
        # (same 200-char threshold _extract_prose_sentences already uses).
        sentences = re.split(r"(?<=[.!?])\s+", line) if len(line) > 200 else [line]
        for sentence in sentences:
            phrase = _extract_degree_phrase(sentence)
            if phrase and len(phrase) >= 5:
                key = phrase.lower()
                if key not in seen:
                    seen.add(key)
                    results.append(phrase)
    return results[:5]


def _extract_inline_skills_from_prose(full_text: str) -> list[str]:
    """
    For unstructured JDs: extract skills from comma/semicolon-delimited
    lists that appear after known skill-trigger phrases.

    Examples caught:
      "experience with Python, FastAPI, SQL, and Docker"
      "proficiency in JavaScript, React, and Node.js"
    """
    _SKILL_TRIGGER_RE = re.compile(
        r"(?:experience\s+(?:in|with)|proficien(?:t|cy)\s+in|"
        r"knowledge\s+of|expertise\s+in|skilled\s+in|"
        r"familiarity\s+with|hands[- ]on\s+(?:experience\s+)?(?:in|with)|"
        r"working\s+knowledge\s+of|strong\s+background\s+in)\s+",
        re.IGNORECASE,
    )

    skills: list[str] = []
    seen: set[str] = set()

    for m in _SKILL_TRIGGER_RE.finditer(full_text):
        start = m.end()
        chunk = full_text[start: start + 200]
        chunk = re.split(r"(?<=[.!?])\s", chunk, maxsplit=1)[0]
        chunk = re.split(r"\n\n", chunk, maxsplit=1)[0]
        # Paragraph-only normalization: a standalone " and " (with or
        # without a preceding comma) separates skills just as much as a
        # comma does in prose ("Docker and REST APIs", "SQL, and Docker").
        # _split_skills' delimiter set is shared with the structured
        # parser and intentionally left untouched, so the conjunction is
        # folded into a comma here first instead.
        chunk = re.sub(r"\s*,?\s+and\s+", ", ", chunk, flags=re.IGNORECASE)
        for skill in _split_skills(chunk):
            skill = skill.rstrip(".")
            if skill.lower() not in seen and not re.search(
                r"\b(?:and|or|with|for)\b$", skill, re.IGNORECASE
            ):
                seen.add(skill.lower())
                skills.append(skill)

    return skills


def _classify_preferred_from_sections(
    required_text: str | None,
    preferred_text: str | None,
) -> tuple[list[str], list[str]]:
    """
    When both RequiredSkills and PreferredSkills sections exist, split them
    cleanly.  When only RequiredSkills exists, scan it for preferred-marker
    phrases and reclassify the skills that follow them.

    Block-level preferred tracking: once a "Preferred:" / "Nice to have:"
    marker line is encountered, all subsequent bullet/skill lines belong to
    the preferred list until a blank line resets the block.  This correctly
    handles patterns like:

        - Python        <- required
        - FastAPI       <- required
        Preferred:      <- marker: switch to preferred block
        - Docker        <- preferred
        - AWS           <- preferred
    """
    required: list[str] = []
    preferred: list[str] = []
    pref_seen: set[str] = set()
    req_seen: set[str] = set()

    if preferred_text:
        for s in _split_skills(preferred_text):
            key = s.lower()
            if key not in pref_seen:
                pref_seen.add(key)
                preferred.append(s)

    if required_text:
        in_preferred_block = False

        for line in required_text.splitlines():
            stripped = line.strip()

            if not stripped:
                # A blank line closes the preferred block.
                in_preferred_block = False
                continue

            is_preferred_marker = bool(_PREFERRED_MARKER_RE.search(stripped))

            if is_preferred_marker:
                # Enter preferred block; the marker line itself may list skills inline.
                in_preferred_block = True
                for s in _split_skills(stripped):
                    key = s.lower()
                    if key not in pref_seen:
                        pref_seen.add(key)
                        preferred.append(s)

            elif in_preferred_block:
                for s in _split_skills(stripped):
                    key = s.lower()
                    if key not in pref_seen:
                        pref_seen.add(key)
                        preferred.append(s)

            else:
                for s in _split_skills(stripped):
                    key = s.lower()
                    if key not in req_seen:
                        req_seen.add(key)
                        required.append(s)

    return required, preferred


def _looks_like_bare_skill_line(line: str) -> bool:
    """
    True for short, discrete-looking tokens like "Python" or "REST APIs" —
    False for full sentences like "Strong communication skills." (ends
    with sentence punctuation) or anything long/wordy. Deliberately
    conservative: used only by ``_reclassify_mixed_requirements_section``
    so a prose-heavy "Requirements" section still contributes nothing to
    required_skills (same as before) rather than being mis-bucketed.
    """
    if not line or len(line) > 40:
        return False
    if line.endswith((".", "!", "?", ":")):
        return False
    if len(line.split()) > 4:
        return False
    return True


def _reclassify_mixed_requirements_section(
    text: str,
) -> tuple[list[str], list[str], str | None]:
    """
    Some JDs use a single generic "Requirements" header (which structurally
    maps to the Qualifications section — same as "Required Qualifications"
    or "What You'll Need") for a mixed bag of content: plain skill names,
    a degree phrase, an experience mention, a bare "Preferred" sub-marker,
    and even a bare work-mode value like "Remote" — instead of separate
    "Required Skills" / "Preferred Skills" / "Location" sections.

    This is called ONLY as a last-resort fallback, when no skills were
    found via the structured RequiredSkills/PreferredSkills sections NOR
    via inline skill-trigger prose (see call site in
    extract_jd_entities) — so a properly-labelled JD, or a prose-only
    "Requirements" section with no discrete skill-like lines, is
    completely unaffected and behaves exactly as before.

    Degree phrases and experience mentions are deliberately left alone
    here (skipped, not consumed) so the existing, unchanged
    qualifications/education/experience extraction still finds them.
    """
    required: list[str] = []
    preferred: list[str] = []
    location: str | None = None
    req_seen: set[str] = set()
    pref_seen: set[str] = set()
    in_preferred = False

    if not text:
        return required, preferred, location

    for raw_line in text.splitlines():
        line = raw_line.strip().lstrip("-•·▪").strip()
        if not line:
            continue

        # A standalone "Preferred" / "Nice to have" / etc. marker line
        # switches every subsequent line into the preferred bucket —
        # mirrors the block-level marker tracking _classify_preferred_
        # from_sections already does for a proper RequiredSkills section.
        if len(line) <= 30 and _PREFERRED_MARKER_RE.fullmatch(line):
            in_preferred = True
            continue

        # Degree phrases and experience mentions belong to qualifications/
        # education/experience — leave them for the existing extraction
        # paths rather than treating them as skills.
        if _DEGREE_RE.search(line):
            continue
        if (
            _EXP_RANGE_RE.search(line)
            or _EXP_MIN_ONLY_RE.search(line)
            or _EXP_SINGLE_RE.search(line)
            or _EXP_PLUS_RE.search(line)
        ):
            continue

        # A bare work-mode value ("Remote", "Hybrid", "On-site") on its
        # own line is a location signal here, not a skill.
        if _EMP_TYPE_RE.fullmatch(line):
            if location is None:
                location = line
            continue

        if not _looks_like_bare_skill_line(line):
            continue

        for skill in _split_skills(line):
            key = skill.lower()
            if in_preferred:
                if key not in pref_seen:
                    pref_seen.add(key)
                    preferred.append(skill)
            else:
                if key not in req_seen:
                    req_seen.add(key)
                    required.append(skill)

    return required, preferred, location


# ---------------------------------------------------------------------------
# Public entrypoint: parse_jd()
# ---------------------------------------------------------------------------


def parse_jd(raw_text: str) -> ParsedJD:
    """
    Cleans and structurally analyses a raw job description string.

    Args:
        raw_text: JD text from any source (paste, form, PDF extraction).

    Returns:
        ParsedJD with cleaned text, detected sections, is_structured flag,
        word count, and any non-fatal warnings.

    Raises:
        JDEmptyError:    raw_text is empty/whitespace-only.
        JDTooShortError: raw_text is shorter than MIN_JD_LENGTH chars.
    """
    if not raw_text or not raw_text.strip():
        raise JDEmptyError("Job description text is empty.")

    cleaned = _clean_text(raw_text)

    if len(cleaned) < MIN_JD_LENGTH:
        raise JDTooShortError(
            f"Job description is too short ({len(cleaned)} chars). "
            f"Minimum is {MIN_JD_LENGTH} characters."
        )

    warnings: list[str] = []

    sections, is_structured = _detect_jd_sections(cleaned)

    if not is_structured:
        warnings.append(
            "No recognisable section headers detected. "
            "Falling back to inline/paragraph extraction for all fields."
        )

    return ParsedJD(
        full_text=cleaned,
        detected_sections=sections,
        is_structured=is_structured,
        word_count=len(cleaned.split()),
        warnings=warnings,
    )


# ---------------------------------------------------------------------------
# Public entrypoint: extract_jd_entities()
# ---------------------------------------------------------------------------


def extract_jd_entities(
    full_text: str,
    detected_sections: dict[str, str | None],
) -> JobEntities:
    """
    Extract all named entities from a parsed job description.

    Args:
        full_text:          Cleaned JD text from ``ParsedJD.full_text``.
        detected_sections:  Section dict from ``ParsedJD.detected_sections``.

    Returns:
        ``JobEntities`` — typed dataclass with a ``.to_dict()`` method.
        All fields default to None / [] so partial results are always safe.

    Designed to be called from:
    - The /jobs/parse-jd API endpoint (immediately after parse_jd()).
    - A background re-extraction worker.
    - A job-matching pipeline that needs structured JD vectors.
    - Unit tests, CLI scripts, notebooks.
    """
    warnings: list[str] = []

    if not full_text or not full_text.strip():
        warnings.append("Empty text supplied; no entities can be extracted.")
        return JobEntities(parsing_warnings=warnings)

    sec = detected_sections

    # ── Title ─────────────────────────────────────────────────────────────────
    title = _extract_title(full_text, sec.get("Title"))

    # ── Experience ────────────────────────────────────────────────────────────
    exp_source = sec.get("Experience") or full_text
    min_exp, max_exp = _extract_experience_range(exp_source)
    if min_exp is None:
        min_exp, max_exp = _extract_experience_range(full_text)

    # ── Employment type ───────────────────────────────────────────────────────
    # When the EmploymentType section was detected via an inline-value header
    # ("Employment Type: Contract"), the section buffer already holds just
    # the value ("Contract"). Extract directly from that value string.
    # Fall back to full-text scan only when no section was detected.
    raw_emp_section = sec.get("EmploymentType")
    if raw_emp_section and raw_emp_section.strip():
        emp_source = raw_emp_section.strip().splitlines()[0].strip()
    else:
        emp_source = full_text
    employment_type = _extract_employment_type(emp_source)

    # ── Location ──────────────────────────────────────────────────────────────
    # Same pattern: when "Location: Remote" is a header+value line, the
    # section buffer holds "Remote" directly. Return it without regex matching.
    raw_location_section = sec.get("Location")
    if raw_location_section and raw_location_section.strip():
        location = raw_location_section.strip().splitlines()[0].strip()
    else:
        location = _extract_location(full_text)

    # ── Department ────────────────────────────────────────────────────────────
    raw_dept_section = sec.get("Department")
    if raw_dept_section and raw_dept_section.strip():
        department: str | None = raw_dept_section.strip().splitlines()[0].strip()
    else:
        department = _extract_department(full_text)

    # ── Skills ────────────────────────────────────────────────────────────────
    required_skills, preferred_skills = _classify_preferred_from_sections(
        sec.get("RequiredSkills"),
        sec.get("PreferredSkills"),
    )

    reclassified_location: str | None = None

    if not required_skills:
        inline_skills = _extract_inline_skills_from_prose(full_text)
        if inline_skills:
            required_skills = inline_skills
        else:
            # Last-resort fallback: a generic "Requirements" header (which
            # structurally maps to Qualifications) may hold a mixed bag of
            # skills/degree/experience/preferred/location content instead
            # of proper sub-sections. Only ever reached when both prior
            # skill-detection strategies found nothing, so this can't
            # affect a JD that already parses correctly.
            mixed_required, mixed_preferred, mixed_location = (
                _reclassify_mixed_requirements_section(sec.get("Qualifications") or "")
            )
            if mixed_required:
                required_skills = mixed_required
                if mixed_preferred:
                    preferred_skills = mixed_preferred
                reclassified_location = mixed_location
            else:
                warnings.append(
                    "No skills section detected and no inline skill phrases found. "
                    "The JD may need manual review."
                )

    if location is None and reclassified_location:
        location = reclassified_location

    # ── Responsibilities ──────────────────────────────────────────────────────
    responsibilities: list[str] = []
    if sec.get("Responsibilities"):
        responsibilities = _extract_list_or_prose(sec["Responsibilities"])  # type: ignore[arg-type]

    # ── Qualifications ────────────────────────────────────────────────────────
    qualifications: list[str] = []
    if sec.get("Qualifications"):
        qualifications = _extract_list_or_prose(sec["Qualifications"])  # type: ignore[arg-type]

    # ── Education ─────────────────────────────────────────────────────────────
    education: list[str] = []
    if sec.get("Education"):
        education = _extract_education_from_text(sec["Education"])  # type: ignore[arg-type]
    if not education and sec.get("Qualifications"):
        education = [
            line
            for line in _extract_list_or_prose(sec["Qualifications"])  # type: ignore[arg-type]
            if _DEGREE_RE.search(line)
        ]
    if not education:
        education = _extract_education_from_prose(full_text)

    return JobEntities(
        title=title,
        department=department,
        location=location,
        employment_type=employment_type,
        min_experience=min_exp,
        max_experience=max_exp,
        required_skills=required_skills,
        preferred_skills=preferred_skills,
        responsibilities=responsibilities,
        qualifications=qualifications,
        education=education,
        parsing_warnings=warnings,
    )
