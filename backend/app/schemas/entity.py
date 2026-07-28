"""
app/schemas/entity.py
---------------------
Pydantic schemas that mirror the ExtractedEntities dataclass from
app/services/entity_extractor.py.

These are the outward-facing API types — they live here so the router
layer stays decoupled from the internal service dataclasses. When the
entity extractor's internals change (e.g. a new field is added), only
this file and the router need to be updated.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, HttpUrl


class EducationEntrySchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    institution: str
    degree: str | None = None
    field_of_study: str | None = None
    start_year: str | None = None
    end_year: str | None = None
    gpa: str | None = None
    raw: str = Field("", description="Original text block — for debugging / audit.")


class ExperienceEntrySchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    company: str
    title: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    is_current: bool = False
    responsibilities: list[str] = Field(default_factory=list)
    raw: str = ""


class ProjectEntrySchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str
    description: str | None = None
    technologies: list[str] = Field(default_factory=list)
    url: str | None = None  # kept as str — project URLs vary too much for strict HttpUrl
    raw: str = ""


class CertificationEntrySchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str
    issuer: str | None = None
    date: str | None = None
    raw: str = ""


class PublicationEntrySchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    title: str
    venue: str | None = None
    year: str | None = None
    authors: list[str] = Field(default_factory=list)
    doi: str | None = None
    raw: str = ""


class ExtractedEntitiesSchema(BaseModel):
    """
    Full entity extraction result returned by GET /resume/{id}/entities
    and embedded in the upload response when extraction succeeds.
    """

    model_config = ConfigDict(from_attributes=True)

    # Contact
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    linkedin: str | None = None
    github: str | None = None

    # Content
    skills: list[str] = Field(default_factory=list)
    education: list[EducationEntrySchema] = Field(default_factory=list)
    experience: list[ExperienceEntrySchema] = Field(default_factory=list)
    projects: list[ProjectEntrySchema] = Field(default_factory=list)
    certifications: list[CertificationEntrySchema] = Field(default_factory=list)
    publications: list[PublicationEntrySchema] = Field(default_factory=list)

    # Meta
    extraction_warnings: list[str] = Field(default_factory=list)
