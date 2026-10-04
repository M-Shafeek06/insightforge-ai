from pathlib import Path
import json
from uuid import uuid4

from fastapi import APIRouter, File, HTTPException, UploadFile, status

from app.data.loaders.tabular import SUPPORTED_EXTENSIONS
from app.services.settings import settings
from app.schemas.dataset import DatasetUploadResponse

router = APIRouter(prefix="/datasets", tags=["datasets"])

MAX_FILE_SIZE = 50 * 1024 * 1024

@router.post("/upload", response_model=DatasetUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_dataset(file: UploadFile = File(...)) -> dict[str, str]:
    extension = Path(file.filename or "").suffix.lower()
    if extension not in SUPPORTED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Only CSV and XLSX files are supported.")

    dataset_id = str(uuid4())
    target = settings.upload_dir / f"{dataset_id}{extension}"
    metadata_target = settings.upload_dir / f"{dataset_id}.json"
    settings.upload_dir.mkdir(parents=True, exist_ok=True)

    size = 0
    try:
        with target.open("wb") as destination:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_FILE_SIZE:
                    target.unlink(missing_ok=True)
                    raise HTTPException(status_code=413, detail="File exceeds the 50 MB upload limit.")
                destination.write(chunk)
        metadata_target.write_text(json.dumps({"filename": file.filename or target.name}), encoding="utf-8")
    except HTTPException:
        raise
    except Exception as exc:
        target.unlink(missing_ok=True)
        metadata_target.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail="Unable to save uploaded file.") from exc

    return {"dataset_id": dataset_id, "filename": file.filename or target.name}
