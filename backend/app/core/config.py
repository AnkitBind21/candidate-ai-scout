from pathlib import Path

from pydantic import computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )

    # ---------------- App ----------------
    APP_NAME: str = "Candidate AI Scout API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    # ---------------- Database ----------------
    DATABASE_URL: str
    DB_ECHO: bool = False
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 10

    @computed_field
    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        return self.DATABASE_URL

    # ---------------- JWT ----------------
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # ---------------- Upload ----------------
    UPLOAD_DIR: Path = Path("uploads")
    MAX_RESUME_SIZE_MB: int = 10

    # NEW
    ALLOWED_RESUME_EXTENSIONS: set[str] = {
        ".pdf",
        ".docx",
    }

    # NEW
    ALLOWED_RESUME_MIME_TYPES: set[str] = {
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }

    # NEW
    @computed_field
    @property
    def MAX_RESUME_SIZE_BYTES(self) -> int:
        return self.MAX_RESUME_SIZE_MB * 1024 * 1024

    # ---------------- CORS ----------------
    CORS_ORIGINS: str = "http://localhost:5173"

    @property
    def cors_origins_list(self):
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]


settings = Settings()

settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)