from pathlib import Path

from fastapi import APIRouter, HTTPException

from app.schemas.quality import DatasetQualityResponse
from app.services.quality import assess_dataset_quality
from app.services.settings import settings

router = APIRouter(prefix="/datasets", tags=["datasets"])


@router.get("/{dataset_id}/quality", response_model=DatasetQualityResponse)
def get_dataset_quality(dataset_id: str) -> dict:
    matches = list(settings.upload_dir.glob(f"{dataset_id}.*"))
    data_files = [
        path
        for path in matches
        if path.suffix.lower() in {".csv", ".xlsx"}
    ]

    if not data_files:
        raise HTTPException(
            status_code=404,
            detail="Dataset not found.",
        )

    path = data_files[0]

    return assess_dataset_quality(
        path=Path(path),
        dataset_id=dataset_id,
    )