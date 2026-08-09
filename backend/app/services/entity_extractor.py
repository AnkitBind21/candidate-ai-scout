"""
app/services/entity_extractor.py
---------------------------------
Production-ready entity extraction for resume text.

Design contract
~~~~~~~~~~~~~~~
Input:  full_text (str)          — cleaned text from resume_parser.clean_text()
        detected_sections (dict) — output of resume_parser.detect_sections()
                                   keys: Education, Experience, Skills,
                                         Projects, Certifications
                                   values: str | None

Output: ExtractedEntities        — typed dataclass, JSON-serialisable via
                                   .to_dict() for the API layer or a future
                                   scoring / job-matching pipeline.

Why this module is separate from resume_parser
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
The parser's job is raw I/O: open a file, pull out text, find rough section
boundaries. This module's job is semantics: understand what the text *means*.
Keeping them separate means:
- The parser stays framework-free and fast (it runs on every upload).
- The extractor can be skipped, replaced, or upgraded (e.g. swapped for an
  LLM later) without touching the parser or the upload router.
- Both can be called independently from tests, CLI scripts, or background
  re-processing jobs.

NLP strategy
~~~~~~~~~~~~
- spaCy en_core_web_sm  — PERSON NER for candidate name; ORG NER for
  institution / company names inside Education and Experience blocks.
  We intentionally use the small model: it's fast, has no external deps, and
  covers everything we need. Upgrade to en_core_web_lg in config if accuracy
  matters more than speed.
- Regex                 — email, phone, LinkedIn, GitHub, date ranges, degree
  keywords, GPA, publication signals. These patterns are deterministic and
  unit-testable without a GPU.
- Heuristics            — skill splitting/dedup, header stripping, name
  fallback when NER returns nothing or a bad candidate.

spaCy model loading
~~~~~~~~~~~~~~~~~~~
spaCy models are expensive to load (~200 ms for sm, ~1.5 s for lg). We load
once at module import time using a module-level singleton. If the model is
missing the extractor raises a clear ImportError with the install command,
rather than crashing mid-request with a cryptic message.
"""

from __future__ import annotations

import logging
import re
import unicodedata
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)

# --------------------------------------------------------------------------
# spaCy model — loaded once at import time
# --------------------------------------------------------------------------

try:
    import spacy

    _NLP = spacy.load("en_core_web_sm")
except OSError:
    raise ImportError(
        "spaCy model 'en_core_web_sm' is not installed. "
        "Run:  python -m spacy download en_core_web_sm"
    ) from None
except ImportError:
    raise ImportError(
        "spaCy is not installed. "
        "Run:  pip install spacy && python -m spacy download en_core_web_sm"
    ) from None


# --------------------------------------------------------------------------
# Output types
# --------------------------------------------------------------------------


@dataclass
class EducationEntry:
    institution: str
    degree: str | None = None
    field_of_study: str | None = None
    start_year: str | None = None
    end_year: str | None = None
    gpa: str | None = None
    raw: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "institution": self.institution,
            "degree": self.degree,
            "field_of_study": self.field_of_study,
            "start_year": self.start_year,
            "end_year": self.end_year,
            "gpa": self.gpa,
            "raw": self.raw,
        }


@dataclass
class ExperienceEntry:
    company: str
    title: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    is_current: bool = False
    responsibilities: list[str] = field(default_factory=list)
    raw: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "company": self.company,
            "title": self.title,
            "start_date": self.start_date,
            "end_date": self.end_date,
            "is_current": self.is_current,
            "responsibilities": self.responsibilities,
            "raw": self.raw,
        }


@dataclass
class ProjectEntry:
    name: str
    description: str | None = None
    technologies: list[str] = field(default_factory=list)
    url: str | None = None
    # Link labels mentioned in the project block (e.g. "GitHub", "Live
    # Demo", "Video Demo") that don't have (or aren't paired with) an
    # actual URL right there in the text. We never invent a URL for
    # these — they're recorded purely as labels. When a real URL IS
    # present alongside a label (e.g. "GitHub: github.com/user/project"),
    # both `url` and this label are populated.
    links: list[str] = field(default_factory=list)
    raw: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "technologies": self.technologies,
            "url": self.url,
            "links": self.links,
            "raw": self.raw,
        }


@dataclass
class CertificationEntry:
    name: str
    issuer: str | None = None
    date: str | None = None
    raw: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {"name": self.name, "issuer": self.issuer, "date": self.date, "raw": self.raw}


@dataclass
class PublicationEntry:
    title: str
    venue: str | None = None
    year: str | None = None
    authors: list[str] = field(default_factory=list)
    doi: str | None = None
    raw: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "title": self.title,
            "venue": self.venue,
            "year": self.year,
            "authors": self.authors,
            "doi": self.doi,
            "raw": self.raw,
        }


@dataclass
class ExtractedEntities:
    """
    All entities extracted from a single resume.
    Every field has a safe default so partial extractions never raise.
    """

    # ── Contact ──────────────────────────────────────────────────────────────
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    linkedin: str | None = None
    github: str | None = None

    # ── Content ──────────────────────────────────────────────────────────────
    skills: list[str] = field(default_factory=list)
    education: list[EducationEntry] = field(default_factory=list)
    experience: list[ExperienceEntry] = field(default_factory=list)
    projects: list[ProjectEntry] = field(default_factory=list)
    certifications: list[CertificationEntry] = field(default_factory=list)
    publications: list[PublicationEntry] = field(default_factory=list)

    # ── Meta ─────────────────────────────────────────────────────────────────
    extraction_warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "email": self.email,
            "phone": self.phone,
            "linkedin": self.linkedin,
            "github": self.github,
            "skills": self.skills,
            "education": [e.to_dict() for e in self.education],
            "experience": [e.to_dict() for e in self.experience],
            "projects": [p.to_dict() for p in self.projects],
            "certifications": [c.to_dict() for c in self.certifications],
            "publications": [p.to_dict() for p in self.publications],
            "extraction_warnings": self.extraction_warnings,
        }


# --------------------------------------------------------------------------
# Compiled regex patterns
# --------------------------------------------------------------------------

# Contact
_EMAIL_RE = re.compile(
    r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}",
    re.IGNORECASE,
)

# Accepts international formats: +91 98765 43210, +91-98765-43210,
# (415) 555-0123, 07700 900000, +1 (415) 555-2671, and unbroken runs like
# +919876543210 / 9876543210. Two alternatives:
#   1. "Formatted" — an optional +country code, an optional parenthesized
#      area code, then 2+ digit groups separated by space/hyphen/dot.
#   2. "Unformatted" — a bare optional +country code directly followed by
#      one continuous 10-13 digit run (common for Indian mobile numbers
#      copy-pasted without spacing).
_PHONE_RE = re.compile(
    r"""
    (?<!\d)                                    # no digit immediately before
    (?:
        # --- Formatted: grouped digits with separators ---
        (?:\+\s?\d{1,3}[\s\-.]?)?               # optional country code, e.g. +91, +1, +44
        (?:\(\s?\d{1,4}\s?\)[\s\-.]?)?           # optional parenthesized area code, e.g. (415), (0)
        \d{2,6}                                  # first digit group
        (?:[\s\-.]\d{2,6}){1,3}                  # 1-3 more digit groups, separator required
        |
        # --- Unformatted: continuous digit run, optional country code ---
        (?:\+\s?\d{1,3}[\s\-]?)?\d{10,13}
    )
    (?:\s*(?:x|ext\.?|extension)\s*\d{1,6})?    # optional extension
    (?!\d)                                      # no digit immediately after
    """,
    re.VERBOSE,
)

_LINKEDIN_RE = re.compile(
    r"(?:https?://)?(?:www\.)?linkedin\.com/in/([A-Za-z0-9\-_%]+)/?",
    re.IGNORECASE,
)

_GITHUB_RE = re.compile(
    r"(?:https?://)?(?:www\.)?github\.com/([A-Za-z0-9\-_.]+)/?",
    re.IGNORECASE,
)

_URL_RE = re.compile(r"https?://[^\s<>\"{}|\\^`\[\]]+", re.IGNORECASE)

# Education
_DEGREE_RE = re.compile(
    r"""
    \b(?:
        B\.?S\.?c?\.?|B\.?E\.?|B\.?Tech\.?|B\.?A\.?|B\.?Com\.?|B\.?Sc\.? |
        M\.?S\.?c?\.?|M\.?E\.?|M\.?Tech\.?|M\.?B\.?A\.?|M\.?A\.?|M\.?Sc\.?|
        Ph\.?D\.?|Doctor(?:ate)?(?:\s+of\s+\w+)?|
        Bachelor(?:'s)?\s*(?:of\s+\w+(?:\s+\w+)*)?|
        Master(?:'s)?\s*(?:of\s+\w+(?:\s+\w+)*)?|
        Associate(?:'s)?|Diploma|Certificate|High\s+School|Secondary|
        B\.Eng\.|M\.Eng\.|LL\.B|LL\.M|BBA|MBA|MCA|BCA
    )\b
    """,
    re.IGNORECASE | re.VERBOSE,
)

_GPA_RE = re.compile(
    r"(?:GPA|CGPA|CGPI|Grade\s+Point\s+Average?|Score)\s*:?\s*(\d+\.?\d*)\s*/\s*(\d+\.?\d*)",
    re.IGNORECASE,
)

# Date ranges — used for Experience and Education blocks
_MONTH_NAMES = (
    r"(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?"
    r"|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)"
)
_DATE_RE = re.compile(
    rf"({_MONTH_NAMES}[\s,.]*)?"
    r"(\d{{4}})"
    r"\s*[-–—]\s*"
    rf"(?:{_MONTH_NAMES}[\s,.]*)?(\d{{4}}|[Pp]resent|[Cc]urrent|[Nn]ow|[Tt]oday)",
    re.IGNORECASE,
)

# Year-only fallback
_YEAR_ONLY_RE = re.compile(r"\b((?:19|20)\d{2})\b")

# Publications
_DOI_RE = re.compile(r"10\.\d{4,9}/[^\s\"'<>]+", re.IGNORECASE)
_VOLUME_RE = re.compile(r"\bvol(?:ume)?\.?\s*\d+\b", re.IGNORECASE)
_JOURNAL_KEYWORDS_RE = re.compile(
    r"\b(?:journal|conference|proceedings|workshop|symposium|transactions|"
    r"arxiv|preprint|IEEE|ACM|Springer|Elsevier|Nature|Science|PLOS)\b",
    re.IGNORECASE,
)

# Certifications
_CERT_YEAR_RE = re.compile(r"\b((?:19|20)\d{2})\b")
_CERT_ISSUER_KEYWORDS = re.compile(
    r"\b(?:issued\s+by|from|by|certified\s+by)\b",
    re.IGNORECASE,
)

# Skill-category prefix — matches a leading "Label:" on its own line, e.g.
# "Languages:", "AI/ML:", "Databases:", "Web/App:", "Tools:". Generic on
# purpose (not a hardcoded word list) so any similarly-formatted category
# label is stripped, leaving only the actual skill tokens after the colon.
_SKILL_CATEGORY_PREFIX_RE = re.compile(
    r"^\s*[A-Za-z][A-Za-z0-9/&+\-\s]{0,40}:\s*"
)

# Skill delimiters — covers comma, semicolon, pipe, bullet variants
_SKILL_DELIMITER_RE = re.compile(r"[,;|\n]|(?:\s*[-•·]\s+)")
# Noise inside a skill token that should disqualify it
_SKILL_NOISE_RE = re.compile(r"[<>{}()\[\]@#$%^&*=+~`]|https?://|www\.")
# Tokens that look like year strings
_YEAR_TOKEN_RE = re.compile(r"^\d{4}$")

# Name heuristics — now the PRIMARY strategy (see _extract_name). spaCy PERSON
# NER is only consulted as a fallback when neither pattern below matches.
# A single "Title-Case shaped" word: capital + lowercase, with optional
# internal capitals after an apostrophe/hyphen (O'Brien, Mary-Jane, D'Angelo),
# and an optional trailing period for initials ("A.").
_TITLECASE_WORD = r"[A-Z][a-z]*(?:['\-][A-Z]?[a-z]+)*\.?"
# Title-Case shape: "John Smith", "Mary-Jane O'Brien", "A. B. Rao"
_NAME_TITLECASE_RE = re.compile(
    rf"^({_TITLECASE_WORD}(?:\s+{_TITLECASE_WORD}){{1,4}})$"
)
# ALL-CAPS shape: "JOHN SMITH" — common in resume headers/templates.
# (Checked only if Title-Case doesn't match first — see _first_meaningful_line_name.)
_NAME_ALLCAPS_RE = re.compile(
    r"^([A-Z][A-Z'.\-]*(?:\s+[A-Z][A-Z'.\-]*){1,4})$"
)

# Words that, if present anywhere in a name candidate, disqualify it. These
# are the words that keep showing up in resume headers/hero sections that
# are NOT a person's name — section labels, contact labels, and portfolio
# link labels like "Video Demo" / "Live Demo" / "View Portfolio".
_NAME_BLACKLIST_WORDS = {
    "resume", "curriculum", "vitae", "cv", "portfolio", "profile",
    "objective", "summary", "about", "contact", "address", "email",
    "phone", "mobile", "website", "github", "linkedin", "video", "demo",
    "sample", "template", "personal", "details", "information", "bio",
    "biodata", "career", "info", "link", "links", "live", "preview",
    "watch", "click", "here", "download",
}


def _is_blacklisted_name_candidate(candidate: str) -> bool:
    """True if any whole word in *candidate* is a known non-name term."""
    words = re.findall(r"[a-zA-Z]+", candidate.lower())
    return any(w in _NAME_BLACKLIST_WORDS for w in words)


# Known resume section/header words — a name candidate matching one of
# these outright (as its full text, case-insensitive) is rejected.
_NAME_SECTION_WORDS = {
    "education", "experience", "skills", "projects",
    "certifications", "summary", "objective", "profile",
    "publications", "work", "history", "career", "contact",
    "references", "awards", "hobbies", "interests",
}


def _titlecase_name(candidate: str) -> str:
    """Converts an ALL-CAPS name match to Title Case for display consistency."""
    return " ".join(w.capitalize() for w in candidate.split())


# --------------------------------------------------------------------------
# Internal helpers
# --------------------------------------------------------------------------


def _first_n_lines(text: str, n: int = 30) -> str:
    """Return the first *n* non-blank lines of *text*, joined."""
    lines = [ln for ln in text.splitlines() if ln.strip()]
    return "\n".join(lines[:n])


def _split_into_blocks(text: str) -> list[str]:
    """
    Split *text* into logical blocks separated by blank lines.
    Short blocks (< 5 chars) are skipped.
    """
    return [b.strip() for b in re.split(r"\n\s*\n", text) if b.strip() and len(b.strip()) >= 5]


def _strip_trailing_noise(text: str) -> str:
    """Remove leading/trailing punctuation, digits, and whitespace."""
    return re.sub(r"^[\s\W]+|[\s\W]+$", "", text)


def _extract_urls_from_text(text: str) -> list[str]:
    return _URL_RE.findall(text)


def _extract_date_range(text: str) -> tuple[str | None, str | None, bool]:
    """
    Find the first date range in *text*.
    Returns (start, end, is_current).
    is_current is True when the end token is Present / Current / Now / Today.
    """
    m = _DATE_RE.search(text)
    if m:
        start_year = m.group(2)
        end_raw = m.group(3)
        is_current = end_raw is None or end_raw.lower() in {"present", "current", "now", "today"}
        end_year = None if is_current else end_raw
        return start_year, end_year, is_current

    # Year-only fallback: "2019 - 2022" or "2019 — Present"
    years = _YEAR_ONLY_RE.findall(text)
    if len(years) >= 2:
        return years[0], years[1], False
    if len(years) == 1:
        current_signals = re.search(r"\b(?:present|current|now|today)\b", text, re.IGNORECASE)
        if current_signals:
            return years[0], None, True

    return None, None, False


def _nlp_orgs(text: str) -> list[str]:
    """Return all unique ORG entity strings from *text* via spaCy NER."""
    doc = _NLP(text[:3000])  # cap to avoid slow processing of huge sections
    seen: set[str] = set()
    orgs: list[str] = []
    for ent in doc.ents:
        if ent.label_ == "ORG":
            clean = ent.text.strip()
            if clean and clean not in seen:
                seen.add(clean)
                orgs.append(clean)
    return orgs


# --------------------------------------------------------------------------
# Contact field extractors
# --------------------------------------------------------------------------


def _extract_email(text: str) -> str | None:
    m = _EMAIL_RE.search(text)
    return m.group(0).lower() if m else None


def _extract_phone(text: str) -> str | None:
    m = _PHONE_RE.search(text)
    if not m:
        return None
    raw = m.group(0).strip()
    digit_count = len(re.sub(r"\D", "", raw))
    # Reject matches that are obviously part of a year / zip code / GPA (too
    # short) or clearly not a real phone number (too long).
    if digit_count < 7 or digit_count > 15:
        return None
    return raw


def _extract_linkedin(text: str) -> str | None:
    m = _LINKEDIN_RE.search(text)
    if not m:
        return None
    # Return the full URL so the frontend can render a clickable link
    username = m.group(1)
    return f"https://linkedin.com/in/{username}"


def _extract_github(text: str) -> str | None:
    m = _GITHUB_RE.search(text)
    if not m:
        return None
    username = m.group(1)
    # Filter out common false positives (GitHub Actions, Gist etc.)
    if username.lower() in {"actions", "gist", "orgs", "topics", "marketplace"}:
        return None
    return f"https://github.com/{username}"


def _extract_name(full_text: str) -> str | None:
    """
    Extracts the candidate's name using two strategies, in this priority
    order:

    1. First-meaningful-line heuristic (PRIMARY). Resumes overwhelmingly
       put the candidate's name as the very first line, before any contact
       info or section content — this is deterministic, fast, and immune
       to spaCy mislabeling something else (e.g. a "Video Demo" link label)
       as a PERSON entity.
    2. spaCy PERSON NER (FALLBACK). Only consulted if no line in the header
       matches the name shape — e.g. unusual layouts, a name embedded in a
       sentence, or a name that doesn't fit the plain Title-Case/ALL-CAPS
       pattern (accented characters, single-word mononyms, etc.).
    """
    # Strategy 1 — first meaningful line
    header = _first_n_lines(full_text, 15)
    candidate = _first_meaningful_line_name(header)
    if candidate:
        return candidate

    # Strategy 2 — spaCy PERSON NER fallback, on a slightly larger window
    wider_header = _first_n_lines(full_text, 30)
    doc = _NLP(wider_header)
    for ent in doc.ents:
        if ent.label_ == "PERSON":
            candidate = ent.text.strip()
            # Reject if it contains digits, @, is a section keyword, or
            # matches one of the known non-name phrases (e.g. "Video Demo").
            if re.search(r"[\d@]", candidate):
                continue
            if candidate.lower() in _NAME_SECTION_WORDS:
                continue
            if _is_blacklisted_name_candidate(candidate):
                continue
            if len(candidate.split()) < 2:
                # Single-word PERSON entities are usually noise
                continue
            return candidate

    return None


def _first_meaningful_line_name(header: str) -> str | None:
    """
    Returns the first line in *header* that plausibly IS the candidate's
    name, or None if no line qualifies.

    A line qualifies only if it:
    - isn't blank, isn't a contact-info line (email/phone/URL/LinkedIn/GitHub)
    - doesn't contain a "|" separator (typical of contact-info header lines)
    - doesn't contain any blacklisted word (portfolio/demo/contact labels etc.)
    - isn't itself a known resume section header
    - matches a Title-Case or ALL-CAPS name shape (2-5 words)
    """
    for line in header.splitlines():
        line = line.strip()
        if not line or len(line) < 3 or len(line) > 60:
            continue
        if _EMAIL_RE.search(line) or _PHONE_RE.search(line):
            continue
        if _LINKEDIN_RE.search(line) or _GITHUB_RE.search(line) or _URL_RE.search(line):
            continue
        if "|" in line or "@" in line:
            continue
        if line.lower().strip(":") in _NAME_SECTION_WORDS:
            continue
        if _is_blacklisted_name_candidate(line):
            continue

        m = _NAME_TITLECASE_RE.match(line)
        if m:
            return m.group(1)

        m = _NAME_ALLCAPS_RE.match(line)
        if m:
            return _titlecase_name(m.group(1))

    return None


# --------------------------------------------------------------------------
# Skills extractor
# --------------------------------------------------------------------------


def _extract_skills(skills_text: str) -> list[str]:
    """
    Splits the Skills section into individual skill tokens, cleans them,
    and deduplicates while preserving first-seen order and original casing.

    Handles:
    - Comma-separated lists ("Python, FastAPI, PostgreSQL")
    - Newline-delimited bullets ("- React\n- Node.js")
    - Mixed delimiters ("Python | JavaScript; TypeScript")
    """
    if not skills_text:
        return []

    # Normalise bullets produced by resume_parser.clean_text() (already "- ")
    # plus any remaining raw bullet glyphs
    text = re.sub(r"^[-•·▪]\s*", "", skills_text, flags=re.MULTILINE)

    # Strip category prefixes like "Languages:", "AI/ML:", "Databases:",
    # "Web/App:", "Tools:" from the START of each line. This relies on
    # resume_parser.detect_sections() preserving real newlines between
    # category lines (see resume_parser.py changes) — without that, these
    # labels would already be flattened into the skill list with no line
    # boundary to anchor on.
    text = "\n".join(
        _SKILL_CATEGORY_PREFIX_RE.sub("", line) for line in text.splitlines()
    )

    raw_tokens = _SKILL_DELIMITER_RE.split(text)

    seen: set[str] = set()
    cleaned: list[str] = []

    for token in raw_tokens:
        token = token.strip()
        # Skip empty, too short, or noisy tokens
        if not token or len(token) < 2:
            continue
        if _SKILL_NOISE_RE.search(token):
            continue
        if _YEAR_TOKEN_RE.match(token):
            continue
        # Skip tokens that are over 60 chars — those are sentences, not skills
        if len(token) > 60:
            continue
        # Skip if token is mostly digits
        if sum(c.isdigit() for c in token) > len(token) / 2:
            continue

        key = token.lower()
        if key not in seen:
            seen.add(key)
            cleaned.append(token)

    return cleaned


# --------------------------------------------------------------------------
# Education extractor
# --------------------------------------------------------------------------


_INSTITUTION_KEYWORDS_RE = re.compile(
    r"\b(?:universit(?:y|ies)|colleges?|institutes?|schools?|academ(?:y|ies)|polytechnics?)\b",
    re.IGNORECASE,
)


def _extract_institution(block: str, lines: list[str], field_of_study: str | None) -> str:
    """
    Institution extraction, in priority order:

    1. The first line (within the first few lines of the block) that
       explicitly contains an institution keyword (university/college/
       institute/school/academy/polytechnic) and isn't itself a bare degree
       line. This is deterministic and sidesteps the most common failure
       mode: spaCy's small ORG model mistaking a degree's field of study
       (e.g. "Information Technology") for the institution name.
    2. A spaCy ORG entity — but rejected if it's identical to the
       already-extracted field_of_study, or if it's just the degree
       keyword itself (both are recurring false positives for this model).
    3. The first non-empty line of the block, as a last resort.
    """
    for line in lines[:5]:
        if _INSTITUTION_KEYWORDS_RE.search(line) and not _DEGREE_RE.fullmatch(line.strip()):
            return _strip_trailing_noise(line)

    orgs = _nlp_orgs(block)
    for org in orgs:
        normalized = org.strip().lower()
        if field_of_study and normalized == field_of_study.strip().lower():
            continue
        if _DEGREE_RE.fullmatch(org.strip()):
            continue
        return org

    return lines[0]


# Splits "<degree/field> – <institution>" on an en dash (or em dash) with
# surrounding spaces. Deliberately NOT a plain hyphen, so abbreviations
# like "L.U.J." or "M.V." inside an institution name are never mistaken
# for the degree/institution separator.
_EDU_EN_DASH_SPLIT_RE = re.compile(r"\s[–—]\s")

# Self-contained "line has its own year range" check used only to decide
# whether an Education block should be split per-line (see
# _split_education_blocks). Deliberately independent of the shared
# _DATE_RE/_YEAR_ONLY_RE machinery used elsewhere in this file, so this
# fix stays scoped to Education and doesn't change Experience/other date
# handling.
_EDU_YEAR_RANGE_LINE_RE = re.compile(
    r"\b(?:19|20)\d{2}\b\s*[-–—]\s*(?:\b(?:19|20)\d{2}\b|present|current)",
    re.IGNORECASE,
)


# Headers that mark the end of the Education section. This is deliberately
# independent of resume_parser.py's own section detection (which is not
# being modified here) — it's a defensive second check, entirely local to
# this module, that truncates the Education text at the first line that
# looks like the start of another section. This also covers combined
# headers like "ACHIEVEMENTS & CERTIFICATIONS" / "ACHIEVEMENTS AND
# CERTIFICATIONS" that a plain single-word header match would miss.
_EDU_STOP_HEADER_RE = re.compile(
    r"^(?:experience|projects?|skills?|publications?|certifications?|achievements?)"
    r"(?:\s*(?:&|and)\s*(?:certifications?|achievements?))?\s*$",
    re.IGNORECASE,
)


def _truncate_at_next_section(section_text: str) -> str:
    """Cuts the Education text off at the first line that looks like the
    start of another section, so an entry never absorbs unrelated content
    from EXPERIENCE / PROJECTS / SKILLS / PUBLICATIONS / CERTIFICATIONS /
    ACHIEVEMENTS (including combined "ACHIEVEMENTS & CERTIFICATIONS" /
    "ACHIEVEMENTS AND CERTIFICATIONS" style headers)."""
    lines = section_text.splitlines()
    for i, line in enumerate(lines):
        # Normalize away stray punctuation/bullets so "ACHIEVEMENTS:" or
        # "- Achievements" still matches the plain header pattern.
        normalized = re.sub(r"[^A-Za-z&\s]", "", line).strip()
        normalized = re.sub(r"\s+", " ", normalized)
        if normalized and _EDU_STOP_HEADER_RE.match(normalized):
            return "\n".join(lines[:i])
    return section_text


def _split_education_blocks(section_text: str) -> list[str]:
    """
    Splits the Education section into one block per degree entry.

    Some resumes list multiple degrees (e.g. UG / HSC / SSC) as consecutive
    lines with NO blank line between them, each line being fully
    self-contained: "<degree> – <institution> | <gpa/%> | <years>". Treating
    that as a single ``_split_into_blocks`` block would merge all degrees
    into one bogus entry. Detect this case — every non-empty line in the
    block independently contains its own year range — and split it into
    one block per line; otherwise keep the traditional blank-line block
    (institution and degree/dates spread across multiple lines).
    """
    blocks = _split_into_blocks(section_text)
    final_blocks: list[str] = []

    for block in blocks:
        lines = [ln for ln in block.splitlines() if ln.strip()]
        if len(lines) > 1 and all(_EDU_YEAR_RANGE_LINE_RE.search(ln) for ln in lines):
            final_blocks.extend(lines)
        else:
            final_blocks.append(block)

    return final_blocks


def _parse_degree_and_field(text: str) -> tuple[str | None, str | None]:
    """
    Extracts (degree, field_of_study) from a line or block such as:
        "Bachelor of Science in Information Technology"
        "B.Sc. Information Technology"

    _DEGREE_RE's "Bachelor/Master (?:of <subject>)?" alternative is
    written to also match multi-word subjects (e.g. "of Science"), and
    since a plain "\\w+(?:\\s+\\w+)*" doesn't know where the subject ends,
    it will happily keep consuming " in Information Technology" as well —
    turning the whole phrase into one giant "degree" with no field left
    over. Splitting on the literal word " in " FIRST, then only running
    _DEGREE_RE against the text before it, sidesteps that entirely.
    """
    in_split = re.split(r"\s+in\s+", text, maxsplit=1, flags=re.IGNORECASE)

    if len(in_split) == 2:
        left, right = in_split[0].strip(), in_split[1].strip()
        if _DEGREE_RE.search(left):
            degree = _strip_trailing_noise(left)
            field = _strip_trailing_noise(right)
            # Keep the field of study reasonably short — a full sentence
            # ending up here (rather than a genuine field name) means the
            # line wasn't actually a degree/field line to begin with.
            field = field if field and len(field) < 80 else None
            return degree or None, field

    # No " in " connector — fall back to the previous same-line remainder
    # heuristic ("B.Sc. Information Technology", "B.Tech Computer Science").
    degree_match = _DEGREE_RE.search(text)
    if not degree_match:
        return None, None

    degree = degree_match.group(0).strip()
    end_pos = degree_match.end()
    if end_pos < len(text) and text[end_pos] == ".":
        degree += "."
        end_pos += 1

    remainder = text[end_pos:].strip()
    remainder = re.sub(r"\n.*", "", remainder, flags=re.DOTALL)  # same line only
    remainder = re.split(r"\||(?=\d{4})", remainder, maxsplit=1)[0].strip()
    remainder = re.sub(r"^(?:in|of)\s+", "", remainder, flags=re.IGNORECASE)
    remainder = _strip_trailing_noise(remainder)
    field = remainder if remainder and len(remainder) < 80 else None
    return degree, field


def _extract_education(section_text: str) -> list[EducationEntry]:
    """
    Splits the Education section into per-institution blocks and extracts:
    - Institution name
    - Degree keyword
    - Field of study (text following the degree keyword)
    - Date range
    - GPA / CGPA / CGPI (or a bare percentage, e.g. "55.17%", as a fallback)

    Stops immediately at the start of any other section (EXPERIENCE,
    PROJECTS, SKILLS, PUBLICATIONS, CERTIFICATIONS, ACHIEVEMENTS, or a
    combined "ACHIEVEMENTS & CERTIFICATIONS" style header) — see
    ``_truncate_at_next_section``.

    Two Education line formats are handled:

    1. Pipe-delimited, one-degree-per-line, entirely on a SINGLE line
       (the common case for Indian resumes listing UG/HSC/SSC on
       consecutive lines with no blank line between them), e.g.:
           "B.Sc. Information Technology – Sheth L.U.J. & Sir M.V.
            College, Mumbai University | CGPA: 9.48/10 | 2023–2026"
       Each such line is first split into its own block (see
       ``_split_education_blocks``), then split again on the en dash into
       a "degree + field" side and an "institution" side — this is what
       keeps the institution from ending up as the entire raw line.
    2. Genuine multi-line blocks, where degree/field, dates, institution,
       and GPA each sit on their own line, e.g.:
           "Bachelor of Science in Information Technology
            2023 – Present
            Seth L. U. J. College of Arts & Sir M. V. College of Science
            and Commerce
            CGPI: 8.92/10"
       Here the institution is found via a keyword line, and the degree
       line is split on " in " *before* running the degree regex, since
       ``_DEGREE_RE``'s "Bachelor ... of <subject>" alternative is greedy
       enough to otherwise swallow "in Information Technology" as part of
       the degree itself.
    """
    if not section_text:
        return []

    section_text = _truncate_at_next_section(section_text)
    if not section_text.strip():
        return []

    blocks = _split_education_blocks(section_text)
    entries: list[EducationEntry] = []

    for block in blocks:
        lines = [ln.strip() for ln in block.splitlines() if ln.strip()]
        if not lines:
            continue

        degree_str: str | None = None
        field_of_study: str | None = None
        institution: str | None = None

        if len(lines) == 1:
            # Format 1 — a single, self-contained pipe-delimited line.
            # A pipe-delimited line typically looks like:
            #   "<degree + field> – <institution> | <gpa/%> | <years>"
            # Isolate the first ("main") segment before any trailing
            # metadata (GPA, percentage, year range) on the same line.
            pipe_segments = [seg.strip() for seg in block.split("|")]
            main_segment = pipe_segments[0] if pipe_segments else block

            dash_parts = _EDU_EN_DASH_SPLIT_RE.split(main_segment, maxsplit=1)

            if len(dash_parts) == 2:
                left, right = dash_parts[0].strip(), dash_parts[1].strip()
                institution = _strip_trailing_noise(right)

                degree_match = _DEGREE_RE.search(left)
                if degree_match:
                    degree_str = degree_match.group(0).strip()
                    end_pos = degree_match.end()
                    # _DEGREE_RE's trailing \b can't match between two
                    # non-word characters (e.g. "." followed by a
                    # space), so it silently drops a real trailing
                    # period like the one in "B.Sc.". Restore it here
                    # rather than touching the shared regex (keeps this
                    # fix scoped to Education).
                    if end_pos < len(left) and left[end_pos] == ".":
                        degree_str += "."
                        end_pos += 1
                    remainder = left[end_pos:].strip()
                    remainder = re.sub(r"^(?:in|of)\s+", "", remainder, flags=re.IGNORECASE)
                    remainder = _strip_trailing_noise(remainder)
                    if remainder:
                        field_of_study = remainder
                else:
                    # No recognizable degree keyword (e.g. "HSC", "SSC")
                    # — the left side itself is the degree label.
                    degree_str = _strip_trailing_noise(left) or None
            else:
                # No en-dash on this single line — fall back to the
                # whole-block heuristics used for Format 2 below.
                degree_str, field_of_study = _parse_degree_and_field(block)
                institution = _extract_institution(block, lines, field_of_study)
        else:
            # Format 2 — genuine multi-line block: institution, degree,
            # dates, and GPA typically each sit on their own line.
            institution_line = next(
                (
                    ln for ln in lines
                    if _INSTITUTION_KEYWORDS_RE.search(ln) and not _DEGREE_RE.fullmatch(ln)
                ),
                None,
            )
            institution = _strip_trailing_noise(institution_line) if institution_line else None

            for ln in lines:
                if ln == institution_line:
                    continue
                degree_str, field_of_study = _parse_degree_and_field(ln)
                if degree_str:
                    break

            if not institution:
                institution = _extract_institution(block, lines, field_of_study)

        # Dates — search the whole block so a trailing "| 2023–2026"
        # pipe segment, or a date on its own line, is still found.
        start_year, end_year, _ = _extract_date_range(block)

        # GPA — explicit "GPA:"/"CGPA:"/"CGPI:" fraction first; fall back
        # to a bare percentage (e.g. "55.17%"), common for HSC/SSC-style
        # entries that don't use a GPA-style score.
        gpa_str: str | None = None
        gpa_m = _GPA_RE.search(block)
        if gpa_m:
            gpa_str = f"{gpa_m.group(1)}/{gpa_m.group(2)}"
        else:
            pct_m = re.search(r"\b(\d{1,3}(?:\.\d+)?)\s*%", block)
            if pct_m:
                gpa_str = f"{pct_m.group(1)}%"

        if not institution:
            institution = lines[0]

        entries.append(
            EducationEntry(
                institution=institution,
                degree=degree_str,
                field_of_study=field_of_study,
                start_year=start_year,
                end_year=end_year,
                gpa=gpa_str,
                raw=block[:300],
            )
        )

    return entries


# --------------------------------------------------------------------------
# Experience extractor
# --------------------------------------------------------------------------


def _extract_experience(section_text: str) -> list[ExperienceEntry]:
    """
    Splits the Experience section into per-role blocks and extracts:
    - Company name (spaCy ORG or first significant line)
    - Job title (heuristic: second line or line containing common title keywords)
    - Date range and is_current flag
    - Bullet-point responsibilities
    """
    if not section_text:
        return []

    blocks = _split_into_blocks(section_text)
    entries: list[ExperienceEntry] = []

    _TITLE_KEYWORDS_RE = re.compile(
        r"\b(?:Engineer|Developer|Analyst|Manager|Designer|Architect|"
        r"Consultant|Intern|Lead|Director|Specialist|Scientist|"
        r"Researcher|Administrator|Associate|Officer|Executive|"
        r"Coordinator|Strategist|Head|VP|CTO|CEO|CFO|COO|Founder)\b",
        re.IGNORECASE,
    )

    for block in blocks:
        lines = [ln.strip() for ln in block.splitlines() if ln.strip()]
        if not lines:
            continue

        # Date range
        start_date, end_date, is_current = _extract_date_range(block)

        # Company — spaCy ORG first
        orgs = _nlp_orgs(block)
        company = orgs[0] if orgs else lines[0]

        # Job title — search for a title-keyword line
        title: str | None = None
        for line in lines[:6]:
            if _TITLE_KEYWORDS_RE.search(line) and len(line) < 80:
                title = _strip_trailing_noise(line)
                break
        # Fallback: second line if it's short enough
        if title is None and len(lines) > 1 and len(lines[1]) < 80:
            # Only use it if it doesn't look like a date or company name
            if not _DATE_RE.search(lines[1]) and lines[1] != company:
                title = _strip_trailing_noise(lines[1])

        # Responsibilities — bullet lines ("- ..." after clean_text normalization)
        responsibilities: list[str] = []
        for line in lines:
            if line.startswith("- ") and len(line) > 3:
                resp = line[2:].strip()
                if resp:
                    responsibilities.append(resp)

        entries.append(
            ExperienceEntry(
                company=company,
                title=title,
                start_date=start_date,
                end_date=end_date,
                is_current=is_current,
                responsibilities=responsibilities[:10],  # cap to avoid noise
                raw=block[:400],
            )
        )

    return entries


# --------------------------------------------------------------------------
# Projects extractor
# --------------------------------------------------------------------------

_PROJECT_TECH_SECTION_RE = re.compile(
    r"^\s*(?:[-•·▪]\s*)?"  # optional leading bullet (from normalized "- " or a raw bullet glyph)
    r"(?:tech(?:nologies)?|tech\s*stack|stack|tools?|built\s+with|using|languages?)"
    r"\s*[:\-\u2013\u2014]\s*",  # separator: colon, hyphen, en dash, or em dash
    re.IGNORECASE,
)

# Link/demo labels that often ride on the SAME pipe-delimited line as the
# real tech stack, e.g. "Tech Stack: React, Node.js | Project: GitHub |
# Live Demo | Video Demo" — these are metadata about where to find the
# project, never actual technologies, and must be filtered out of the
# technologies list (Issue: "Exclude metadata such as Project: GitHub,
# Live Demo, Video Demo").
_PROJECT_METADATA_TOKEN_RE = re.compile(
    r"^(?:project|github|gitlab|bitbucket|live\s*demo|video\s*demo|demo|"
    r"preview|portfolio|source\s*code|repo(?:sitory)?|live\s*(?:site|link)?|"
    r"website)\s*:?\s*(?:github|gitlab|bitbucket)?$",
    re.IGNORECASE,
)


def _is_project_metadata_token(token: str) -> bool:
    return bool(_PROJECT_METADATA_TOKEN_RE.match(token.strip()))


# Canonical display form for each recognized link-label keyword.
_PROJECT_LINK_LABEL_CANONICAL = {
    "github": "GitHub",
    "gitlab": "GitLab",
    "bitbucket": "Bitbucket",
    "live demo": "Live Demo",
    "video demo": "Video Demo",
    "demo": "Demo",
    "portfolio": "Portfolio",
    "source code": "Source Code",
    "repository": "Repository",
    "repo": "Repository",
    "live site": "Live Site",
    "live link": "Live Link",
    "website": "Website",
    "preview": "Preview",
}

_PROJECT_LINK_LABEL_RE = re.compile(
    r"\b(github|gitlab|bitbucket|live\s*demo|video\s*demo|demo|portfolio|"
    r"source\s*code|repo(?:sitory)?|live\s*site|live\s*link|website|preview)\b",
    re.IGNORECASE,
)


def _extract_project_links(block: str) -> list[str]:
    """
    Finds link-LABEL mentions (GitHub / Live Demo / Video Demo / Portfolio /
    etc.) anywhere in a project block and records them in `links`, WITHOUT
    inventing any URL (Issue 4). This runs independently of URL extraction:
    - "GitHub | Live Demo | Video Demo" (no URLs at all) -> links only.
    - "GitHub: github.com/user/project" -> the existing URL extraction
      (unchanged) still finds the real URL, AND "GitHub" is recorded here
      as a link label too — both fields end up populated, matching the
      requested behaviour exactly.
    - "Project: GitHub" -> the label found is "GitHub" (the word "Project"
      itself isn't a distinct link type, so it isn't recorded on its own).
    """
    seen: set[str] = set()
    links: list[str] = []
    for m in _PROJECT_LINK_LABEL_RE.finditer(block):
        key = re.sub(r"\s+", " ", m.group(1).lower()).strip()
        canonical = _PROJECT_LINK_LABEL_CANONICAL.get(key)
        if canonical and canonical not in seen:
            seen.add(canonical)
            links.append(canonical)
    return links


_BARE_DOMAIN_LINK_RE = re.compile(
    r"(?:https?://)?(?:www\.)?(?:github|gitlab|linkedin|bitbucket)\.com/\S+",
    re.IGNORECASE,
)

_LINK_ONLY_LINE_RE = re.compile(
    rf"^(?:https?://\S+|{_BARE_DOMAIN_LINK_RE.pattern})$",
    re.IGNORECASE,
)


def _is_link_only_line(stripped_line: str) -> bool:
    """True if the whole line is just a URL (e.g. a GitHub link), with
    nothing else on it — these are supplementary metadata for the
    *current* project, never the start of a new one."""
    return bool(stripped_line) and bool(_LINK_ONLY_LINE_RE.match(stripped_line))


def _is_metadata_only_line(line: str) -> bool:
    """True if a line consists entirely of link/demo labels and/or bare
    URLs (e.g. "GitHub | Live Demo | Video Demo", "Project: GitHub"), with
    no real descriptive content. Such lines must never end up in
    `description` and must never be mistaken for the start of a new
    project (Issue 4: link labels without URLs)."""
    stripped = line.strip()
    if not stripped:
        return False
    if _is_link_only_line(stripped):
        return True
    segments = [s.strip() for s in stripped.split("|") if s.strip()]
    if not segments:
        return False
    return all(
        _is_project_metadata_token(seg) or _is_link_only_line(seg) for seg in segments
    )


def _split_project_blocks(section_text: str) -> list[str]:
    """
    Splits the Projects section into one block per project.

    Two complementary heuristics are used because resumes are inconsistent
    about whether a blank line separates projects:

    1. Blank-line separated blocks — the common case, handled by
       ``_split_into_blocks`` (splits on ``\\n\\s*\\n``).
    2. Tightly-packed lists with no blank line between projects: within a
       blank-line block, if a non-bullet "title-like" line immediately
       follows a bullet line, that's treated as the start of a new
       project (title line -> "- " bullets -> next title line -> ...).
       Link-only lines (e.g. a bare "github.com/user/repo") are treated
       as neither a bullet nor a title — they're supplementary info for
       whichever project they appear under, and never trigger a split.
    """
    blank_line_blocks = _split_into_blocks(section_text)
    final_blocks: list[str] = []

    for block in blank_line_blocks:
        lines = block.splitlines()
        sub_blocks: list[list[str]] = [[]]
        prev_was_bullet = False

        for line in lines:
            stripped = line.strip()
            is_bullet = stripped.startswith("- ")
            is_link_only = _is_metadata_only_line(stripped)
            is_title_like = (
                not is_bullet
                and not is_link_only
                and stripped
                and len(stripped) <= 100
                and stripped[0].isupper()
            )

            if prev_was_bullet and is_title_like and sub_blocks[-1]:
                sub_blocks.append([])  # new project starts here

            sub_blocks[-1].append(line)

            if is_bullet:
                prev_was_bullet = True
            elif is_title_like:
                prev_was_bullet = False
            # else (link-only or blank): leave prev_was_bullet unchanged —
            # a link line shouldn't "reset" the bullet streak it interrupts.

        for sb in sub_blocks:
            text = "\n".join(sb).strip()
            if text:
                final_blocks.append(text)

    return final_blocks


def _split_project_title_line(line: str) -> tuple[str, str | None]:
    """
    Splits a project's title line into (name, inline_remainder).

    Handles the common resume patterns where the technology list or a short
    description is appended directly to the project name on the same line:
    - "E-Commerce Platform | React, Node.js, MongoDB"
    - "Chat App (Socket.io, Express)"
    - "Portfolio Site: personal site built with Next.js"

    Returns (name, None) if the line doesn't match any of these patterns —
    the whole line is then just treated as the name, same as before.
    """
    if "|" in line:
        name, _, rest = line.partition("|")
        return _strip_trailing_noise(name), rest.strip() or None

    paren_m = re.match(r"^(.+?)\s*\(([^)]+)\)\s*$", line)
    if paren_m:
        return _strip_trailing_noise(paren_m.group(1)), paren_m.group(2).strip()

    if ":" in line:
        name, _, rest = line.partition(":")
        if len(name) <= 60:  # guard against splitting a plain descriptive sentence
            return _strip_trailing_noise(name), rest.strip() or None

    return _strip_trailing_noise(line), None


def _extract_projects(section_text: str) -> list[ProjectEntry]:
    """
    Splits the Projects section into per-project blocks and extracts:
    - Project name (from the title line, with inline tech/description split off)
    - Description (remaining prose lines)
    - Technologies (inline on the title line, and/or a "Technologies:" /
      "Tech:" / "Stack:" line — merged and deduplicated)
    - URL (any http/https URL found in the block)
    - Links (link labels like GitHub/Live Demo/Video Demo, with no invented URLs)
    """
    if not section_text:
        return []

    blocks = _split_project_blocks(section_text)
    entries: list[ProjectEntry] = []

    for block in blocks:
        lines = [ln.strip() for ln in block.splitlines() if ln.strip()]
        if not lines:
            continue

        name, inline_rest = _split_project_title_line(lines[0])
        if not name:
            continue

        # URL — prefer GitHub project links, else first URL found anywhere.
        # Checks both full https:// URLs and bare domain references (e.g.
        # a resume line that's just "github.com/user/repo" with no scheme,
        # which _extract_urls_from_text's http(s)-only regex would miss).
        urls = _extract_urls_from_text(block)
        urls += [u for u in _BARE_DOMAIN_LINK_RE.findall(block) if u not in urls]
        url: str | None = None
        for u in urls:
            if "github.com" in u:
                url = u if u.startswith(("http://", "https://")) else f"https://{u}"
                break
        if url is None and urls:
            u = urls[0]
            url = u if u.startswith(("http://", "https://")) else f"https://{u}"

        # Technologies — merge inline (from the title line) with an explicit
        # "Technologies:" / "Tech:" / "Stack:" line if one exists, dedup
        # while preserving first-seen order.
        technologies: list[str] = [
            t for t in _extract_skills(inline_rest) if not _is_project_metadata_token(t)
        ] if inline_rest else []
        for line in lines[1:]:
            if _PROJECT_TECH_SECTION_RE.search(line):
                after = _PROJECT_TECH_SECTION_RE.sub("", line).strip()
                for tech in _extract_skills(after):
                    if _is_project_metadata_token(tech):
                        continue
                    if tech.lower() not in {t.lower() for t in technologies}:
                        technologies.append(tech)
                break

        # Description — all non-bullet, non-tech, non-URL prose lines
        # except the title line
        description_lines: list[str] = []
        for line in lines[1:]:
            if _PROJECT_TECH_SECTION_RE.search(line):
                continue
            if _is_metadata_only_line(line):
                continue
            if line.startswith("- "):
                description_lines.append(line[2:].strip())
            elif len(line) > 20 and not _URL_RE.match(line):
                description_lines.append(line)
        description = " ".join(description_lines[:3]).strip() or None

        # Link labels (GitHub / Live Demo / Video Demo / etc.) — recorded
        # without inventing URLs (Issue 4). Scanned over the block body
        # only (excluding the title line), so a project literally named
        # something like "Portfolio Website" doesn't get spurious labels
        # pulled from its own name.
        links = _extract_project_links("\n".join(lines[1:]))

        entries.append(
            ProjectEntry(
                name=name,
                description=description,
                technologies=technologies,
                url=url,
                links=links,
                raw=block[:400],
            )
        )

    return entries


# --------------------------------------------------------------------------
# Certifications extractor
# --------------------------------------------------------------------------

_CERT_KNOWN_ISSUERS_RE = re.compile(
    r"\b(?:AWS|Amazon|Google|Microsoft|Coursera|Udemy|edX|LinkedIn|"
    r"Cisco|CompTIA|Oracle|IBM|Meta|Apple|ISACA|PMI|Scrum\.org|"
    r"HackerRank|DataCamp|Kaggle)\b",
    re.IGNORECASE,
)


def _extract_certifications(section_text: str) -> list[CertificationEntry]:
    """
    Each line (or short block) in the Certifications section is typically
    one certification. Extracts:
    - Certification name
    - Issuer (well-known provider names or text after "by / from / issued by")
    - Year
    """
    if not section_text:
        return []

    entries: list[CertificationEntry] = []
    # Each logical unit is separated by a newline or blank line
    raw_items = [item.strip() for item in re.split(r"\n+", section_text) if item.strip()]

    for raw in raw_items:
        # Skip if it looks like a pure section header (already handled by parser)
        if len(raw) < 5:
            continue

        # Year
        year_m = _CERT_YEAR_RE.search(raw)
        year = year_m.group(1) if year_m else None

        # Issuer — check for known names first
        issuer: str | None = None
        known = _CERT_KNOWN_ISSUERS_RE.search(raw)
        if known:
            issuer = known.group(0)
        else:
            # Try "by <X>" / "from <X>" / "issued by <X>"
            by_m = re.search(
                r"\b(?:issued\s+by|certified\s+by|from|by)\s+([A-Za-z][^\n,|]+)",
                raw,
                re.IGNORECASE,
            )
            if by_m:
                issuer = _strip_trailing_noise(by_m.group(1))

        # Name — remove year, issuer hints, and leading bullet
        name = raw
        name = re.sub(r"\b(?:19|20)\d{2}\b", "", name).strip()
        name = re.sub(r"\b(?:issued\s+by|certified\s+by|from|by)\s+[^\n,]+", "", name, flags=re.IGNORECASE).strip()
        name = _strip_trailing_noise(re.sub(r"^[-•·]\s*", "", name))

        if name:
            entries.append(CertificationEntry(name=name, issuer=issuer, date=year, raw=raw[:200]))

    return entries


# --------------------------------------------------------------------------
# Publications extractor
# --------------------------------------------------------------------------

# Matches single-word headers (Publications, Research, Papers, Articles)
# AND multi-word variants (Research Publication(s), Research Papers,
# Published Works, Selected Publications) — the original pattern only
# covered the single-word case, so headers like "Research Publication"
# were silently never detected and the whole section was skipped.
_PUBLICATION_SECTION_NAMES_RE = re.compile(
    r"^(?:"
    r"publications?|"
    r"selected\s+publications?|"
    r"research\s+publications?|"
    r"research(?:\s+(?:work|papers?))?|"
    r"papers?|"
    r"articles?|"
    r"published\s+works?"
    r")$",
    re.IGNORECASE,
)

# Signals that strongly suggest a line is a publication entry
_PUB_SIGNAL_RE = re.compile(
    r"(?:doi|arxiv|isbn|issn|vol|pp\.|pages?|journal|conference|proceedings)",
    re.IGNORECASE,
)


# Matches ONLY an explicit author label line — "Authors:", "Author:", or
# "By:" — followed by one or more names. Deliberately does NOT match
# generic prose or metadata lines (page numbers, volume/issue, DOI,
# journal name, year), so those can never be mistaken for an author list.
_AUTHOR_LINE_RE = re.compile(r"^\s*(?:authors?|by)\s*:\s*(.+)$", re.IGNORECASE)


def _extract_publication_authors(block_lines: list[str]) -> list[str]:
    """
    Extracts authors from a publication block ONLY when an explicit
    "Authors:" / "Author:" / "By:" line is present. Never infers authors
    from surrounding publication metadata (page numbers like "Page 284",
    volume/issue like "Volume 13, Issue 1", DOI, journal/venue name, or
    year) — if no explicit author line exists, returns [] rather than
    guessing.
    """
    for line in block_lines:
        match = _AUTHOR_LINE_RE.match(line)
        if not match:
            continue
        raw = match.group(1).strip()
        if not raw:
            return []
        parts = re.split(r",|\s+and\s+|&", raw, flags=re.IGNORECASE)
        return [p.strip() for p in parts if p.strip()]
    return []


def _extract_publications(full_text: str) -> list[PublicationEntry]:
    """
    Publications rarely appear in the five standard parser sections, so we
    scan the full text for a "Publications" / "Research" / "Papers" header
    and extract entries from the content that follows it.

    Each paragraph/block is treated as one publication. We extract:
    - Title (first sentence / line of the block)
    - Venue (journal / conference name via keyword match)
    - Year
    - Authors (ONLY from an explicit "Authors:"/"Author:"/"By:" line — never inferred from metadata)
    - DOI
    """
    # Find a publications-like header
    lines = full_text.splitlines()
    pub_start: int | None = None
    for i, line in enumerate(lines):
        normalized = re.sub(r"[^A-Za-z\s]", "", line).strip()
        if _PUBLICATION_SECTION_NAMES_RE.match(normalized):
            pub_start = i + 1
            break

    if pub_start is None:
        return []

    # Collect lines until the next likely section header
    _OTHER_HEADER_RE = re.compile(
        r"^(education|experience|skills|projects?|certifications?|"
        r"awards?|achievements?|honou?rs?|hobbies?|interests?|references?|summary|objective)$",
        re.IGNORECASE,
    )
    pub_lines: list[str] = []
    for line in lines[pub_start:]:
        normalized = re.sub(r"[^A-Za-z\s]", "", line).strip()
        if normalized and _OTHER_HEADER_RE.match(normalized):
            break
        pub_lines.append(line)

    pub_section_text = "\n".join(pub_lines)
    blocks = _split_into_blocks(pub_section_text)
    entries: list[PublicationEntry] = []

    for block in blocks:
        if not _PUB_SIGNAL_RE.search(block) and not _DOI_RE.search(block):
            # Heuristic: skip blocks with no publication signals
            continue

        block_lines = [ln.strip() for ln in block.splitlines() if ln.strip()]
        if not block_lines:
            continue

        # Title — first line
        title = _strip_trailing_noise(block_lines[0])

        # DOI
        doi_m = _DOI_RE.search(block)
        doi = doi_m.group(0) if doi_m else None

        # Year
        year_m = _YEAR_ONLY_RE.search(block)
        year = year_m.group(1) if year_m else None

        # Venue — line containing journal/conference keywords
        venue: str | None = None
        for line in block_lines:
            if _JOURNAL_KEYWORDS_RE.search(line) or _VOLUME_RE.search(line):
                venue = _strip_trailing_noise(line)
                break

        # Authors — ONLY from an explicit "Authors:" / "Author:" / "By:"
        # line. Previously this used spaCy PERSON NER over the first 200
        # characters of the block, which happily mis-tagged publication
        # metadata like "Page 284" as a person's name. Metadata lines
        # (page/volume/issue numbers, DOI, journal name, year) must never
        # be treated as authors — if no explicit author line exists, the
        # correct result is an empty list, not a guess.
        authors = _extract_publication_authors(block_lines)

        entries.append(
            PublicationEntry(
                title=title,
                venue=venue,
                year=year,
                authors=authors,
                doi=doi,
                raw=block[:500],
            )
        )

    return entries


# --------------------------------------------------------------------------
# Public entrypoint
# --------------------------------------------------------------------------


def extract_entities(
    full_text: str,
    detected_sections: dict[str, str | None],
) -> ExtractedEntities:
    """
    Extract all named entities from a parsed resume.

    Args:
        full_text:          Cleaned resume text from ``ParsedResume.full_text``.
        detected_sections:  Section dict from ``ParsedResume.detected_sections``.
                            Keys: Education, Experience, Skills, Projects,
                            Certifications. Values: str or None.

    Returns:
        ``ExtractedEntities`` — a typed dataclass with a ``.to_dict()`` method
        for JSON serialisation. All fields default to None / [] so partial
        results are always safe to consume.

    This function is deliberately free of FastAPI, SQLAlchemy, or HTTP
    concerns. It can be called from:
    - The resume upload router (immediately after parse_resume())
    - A background worker for batch re-extraction
    - A future job-matching pipeline that needs candidate skill vectors
    - Unit tests, CLI scripts, notebooks
    """
    warnings: list[str] = []

    if not full_text or not full_text.strip():
        warnings.append("Empty text supplied; no entities can be extracted.")
        return ExtractedEntities(extraction_warnings=warnings)

    # ── Contact fields (extracted from full text — they appear anywhere) ────
    email = _extract_email(full_text)
    phone = _extract_phone(full_text)
    linkedin = _extract_linkedin(full_text)
    github = _extract_github(full_text)
    name = _extract_name(full_text)

    if name is None:
        warnings.append(
            "Could not confidently identify the candidate's name. "
            "The resume may not start with a name, or the formatting is unusual."
        )

    # ── Section-based fields ────────────────────────────────────────────────
    skills = _extract_skills(detected_sections.get("Skills") or "")
    if not skills:
        warnings.append("No skills detected. The Skills section may be missing or empty.")

    education = _extract_education(detected_sections.get("Education") or "")
    experience = _extract_experience(detected_sections.get("Experience") or "")
    projects = _extract_projects(detected_sections.get("Projects") or "")
    certifications = _extract_certifications(detected_sections.get("Certifications") or "")

    # ── Publications — always from full_text (not a standard parser section)
    publications = _extract_publications(full_text)

    return ExtractedEntities(
        name=name,
        email=email,
        phone=phone,
        linkedin=linkedin,
        github=github,
        skills=skills,
        education=education,
        experience=experience,
        projects=projects,
        certifications=certifications,
        publications=publications,
        extraction_warnings=warnings,
    )
