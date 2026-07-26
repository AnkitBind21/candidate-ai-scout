"""Pydantic schemas for the health check endpoint."""

from pydantic import BaseModel, ConfigDict


class HealthResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    status: str
    app_name: str
    version: str
    environment: str
    database: str
