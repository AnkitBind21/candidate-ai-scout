"""Health check API routes."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.health import HealthResponse
from app.services.health_service import get_health_status

router = APIRouter(tags=["Health"])


@router.get("/health", response_model=HealthResponse)
def health_check(db: Session = Depends(get_db)) -> HealthResponse:
    """
    Returns the current health of the API, including whether the
    database connection is alive.
    """
    return get_health_status(db)
