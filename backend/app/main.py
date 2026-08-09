"""FastAPI application entrypoint."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.database import Base, engine

# Import all models so SQLAlchemy registers them
from app.models import User, Job, Candidate, Resume, Analysis

# Create all database tables (only if they don't already exist)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    debug=settings.DEBUG,
)

# ---------------- CORS ----------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------- Routers ----------------
app.include_router(api_router)


@app.get("/", tags=["Root"])
def root() -> dict[str, str]:
    """Simple root endpoint pointing to the docs and health check."""
    return {
        "message": f"{settings.APP_NAME} is running",
        "docs": "/docs",
        "health": "/health",
    }