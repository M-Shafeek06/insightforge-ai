from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    upload_dir: Path = Path("../data/raw")
    processed_dir: Path = Path("../data/processed")
    database_url: str = (
        "postgresql+psycopg://insightforge:insightforge_dev@localhost:5432/insightforge"
    )

    model_config = SettingsConfigDict(
        env_file="../.env",
        extra="ignore",
        case_sensitive=False,
    )


settings = Settings()