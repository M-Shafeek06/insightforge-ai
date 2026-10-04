from pathlib import Path

from app.services.settings import settings

settings.upload_dir.mkdir(parents=True, exist_ok=True)
settings.processed_dir.mkdir(parents=True, exist_ok=True)

def dataset_path(dataset_id: str, suffix: str) -> Path:
    return settings.upload_dir / f"{dataset_id}{suffix}"
