"""Business logic for health checks."""

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.schemas.health import HealthResponse


def check_database_connection(db: Session) -> str:
    """
    Runs a trivial query against the database to verify connectivity.
    Returns "connected" or "disconnected".
    """
    try:
        db.execute(text("SELECT 1"))
        return "connected"
    except Exception:
        return "disconnected"


def get_health_status(db: Session) -> HealthResponse:
    """Builds the full health status response."""
    db_status = check_database_connection(db)

    return HealthResponse(
        status="ok" if db_status == "connected" else "degraded",
        app_name=settings.APP_NAME,
        version=settings.APP_VERSION,
        environment=settings.ENVIRONMENT,
        database=db_status,
    )
