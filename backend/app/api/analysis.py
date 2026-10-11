from pathlib import Path

from fastapi import APIRouter, HTTPException

from app.schemas.analysis import (
    AnalysisPlanResponse,
    AnalysisPlanningRequest,
)
from app.services.analysis_planner import plan_dataset_analysis
from app.services.settings import settings

router = APIRouter(prefix="/datasets", tags=["Analysis Planning"])


@router.post(
    "/{dataset_id}/analysis-plan",
    response_model=AnalysisPlanResponse,
)
def create_analysis_plan(
    dataset_id: str,
    request: AnalysisPlanningRequest,
) -> AnalysisPlanResponse:
    """Generate a deterministic business analysis plan for an uploaded dataset."""

    matching_files = [
        path
        for path in settings.upload_dir.glob(f"{dataset_id}.*")
        if path.suffix.lower() in {".csv", ".xlsx"}
        and path.is_file()
    ]

    if not matching_files:
        raise HTTPException(
            status_code=404,
            detail="Dataset not found.",
        )

    try:
        result = plan_dataset_analysis(
            path=Path(matching_files[0]),
            dataset_id=dataset_id,
            business_objective=request.business_objective,
            business_questions=request.business_questions,
        )
        return AnalysisPlanResponse.model_validate(result)

    except (ValueError, OSError) as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Unable to create analysis plan: {exc}",
        ) from exc
