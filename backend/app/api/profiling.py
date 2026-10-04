import json

from fastapi import APIRouter, HTTPException

from app.schemas.dataset import DatasetProfileResponse
from app.services.profiler import profile_dataset
from app.services.settings import settings

router = APIRouter(prefix="/datasets", tags=["datasets"])

@router.get("/{dataset_id}/profile", response_model=DatasetProfileResponse)
def get_dataset_profile(dataset_id: str) -> dict:
    matches = list(settings.upload_dir.glob(f"{dataset_id}.*"))
    data_files = [p for p in matches if p.suffix.lower() in {".csv", ".xlsx"}]
    if not data_files:
        raise HTTPException(status_code=404, detail="Dataset not found.")

    path = data_files[0]
    metadata_path = settings.upload_dir / f"{dataset_id}.json"
    filename = path.name
    if metadata_path.exists():
        try:
            filename = json.loads(metadata_path.read_text(encoding="utf-8")).get("filename", filename)
        except (json.JSONDecodeError, OSError):
            pass

    return profile_dataset(path, dataset_id, filename)
