import re

from fastapi import APIRouter, HTTPException

from app.schemas.execution import (
    AnalyticsExecutionRequest,
    AnalyticsExecutionResponse,
    DescriptiveAnalyticsResponse,
    ExecutionOperation,
    GroupedAnalyticsExecutionResponse,
)

from app.services.analytics_executor import (
    AnalyticsExecutionError,
    DatasetNotFoundError,
    execute_grouped_kpi,
    execute_kpi,
    find_dataset_path,
)

from app.services.descriptive_executor import execute_descriptive
from app.services.settings import settings


router = APIRouter(
    prefix="/datasets",
    tags=["Analytics Execution"],
)


@router.post("/{dataset_id}/execute")
def execute_dataset_analysis(
    dataset_id: str,
    request: AnalyticsExecutionRequest,
) -> (
    AnalyticsExecutionResponse
    | GroupedAnalyticsExecutionResponse
    | DescriptiveAnalyticsResponse
):
    """Execute a supported KPI or descriptive analytics operation."""

    if not re.fullmatch(r"[A-Za-z0-9_-]{1,100}", dataset_id):
        raise HTTPException(
            status_code=422,
            detail="Invalid dataset identifier.",
        )

    try:
        path = find_dataset_path(
            dataset_id=dataset_id,
            upload_dir=settings.upload_dir,
        )

        if request.operation == ExecutionOperation.DESCRIPTIVE:
            if request.aggregation is not None:
                raise HTTPException(
                    status_code=422,
                    detail="Descriptive analytics does not accept an aggregation.",
                )

            if request.group_by is not None:
                raise HTTPException(
                    status_code=422,
                    detail="Descriptive analytics does not support group_by.",
                )

            return execute_descriptive(
                path=path,
                dataset_id=dataset_id,
                request=request,
            )

        if request.aggregation is None:
            raise HTTPException(
                status_code=422,
                detail="KPI operations require an aggregation.",
            )

        if request.group_by is not None:
            return execute_grouped_kpi(
                path=path,
                dataset_id=dataset_id,
                request=request,
            )

        return execute_kpi(
            path=path,
            dataset_id=dataset_id,
            request=request,
        )

    except DatasetNotFoundError as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc),
        ) from exc

    except (AnalyticsExecutionError, ValueError) as exc:
        raise HTTPException(
            status_code=422,
            detail=str(exc),
        ) from exc
