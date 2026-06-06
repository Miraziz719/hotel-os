from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://hotel_user:hotel_pass@localhost:5432/hotel_os"
    sync_database_url: str = "postgresql://hotel_user:hotel_pass@localhost:5432/hotel_os"

    # Redis
    redis_url: str = "redis://localhost:6379"

    # Security
    dashboard_password: str = "hotel_admin_2024"
    secret_key: str = "supersecretkey_change_in_production"

    # App
    debug: bool = True

    @field_validator("debug", mode="before")
    @classmethod
    def parse_debug(cls, value):
        if isinstance(value, bool):
            return value
        if value is None:
            return True

        normalized = str(value).strip().lower()
        if normalized in {"1", "true", "yes", "on", "dev", "debug"}:
            return True
        if normalized in {"0", "false", "no", "off", "prod", "production", "release"}:
            return False
        return value

    class Config:
        env_file = Path(__file__).resolve().parents[1] / ".env"


settings = Settings()
