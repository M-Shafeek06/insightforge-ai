import re

from fastapi import APIRouter, HTTPException

from app.schemas.execution import (
    AnalyticsExecutionRequest,
    AnalyticsExecutionResponse,
    CorrelationAnalyticsResponse,
    DescriptiveAnalyticsResponse,
    ExecutionOperation,
    GroupedAnalyticsExecutionResponse,
    SegmentComparisonResponse,
    TrendAnalyticsResponse,
)

from app.services.analytics_executor import (
    AnalyticsExecutionError,
    DatasetNotFoundError,
    execute_grouped_kpi,
    execute_kpi,
    find_dataset_path,
)

from app.services.correlation_executor import execute_correlation
from app.services.descriptive_executor import execute_descriptive
from app.services.segment_executor import execute_segment_comparison
from app.services.settings import settings
from app.services.trend_executor import execute_trend


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
    | TrendAnalyticsResponse
    | SegmentComparisonResponse
    | CorrelationAnalyticsResponse
):
    """
    Execute a supported analytics operation.

    Supported operations:
    - KPI analysis
    - Grouped KPI analysis
    - Descriptive statistics
    - Trend analysis
    - Segment comparison
    - Pearson correlation analysis
    """

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

        # 1. Correlation analysis
        if request.operation == ExecutionOperation.CORRELATION:
            if request.second_column is None:
                raise HTTPException(
                    status_code=422,
                    detail=(
                        "Correlation analysis requires a second numeric "
                        "column."
                    ),
                )

            if (
                request.aggregation is not None
                or request.group_by is not None
                or request.date_column is not None
                or request.interval is not None
            ):
                raise HTTPException(
                    status_code=422,
                    detail=(
                        "Correlation analysis accepts only the two "
                        "column selections and does not support "
                        "aggregation, grouping, or trend parameters."
                    ),
                )

            return execute_correlation(
                path=path,
                dataset_id=dataset_id,
                column=request.column,
                second_column=request.second_column,
            )

        # Other operations do not accept the correlation-only parameter.
        if request.second_column is not None:
            raise HTTPException(
                status_code=422,
                detail=(
                    "second_column is supported only for correlation "
                    "analysis."
                ),
            )

        # 2. Trend analysis
        if request.operation == ExecutionOperation.TREND:
            if request.group_by is not None:
                raise HTTPException(
                    status_code=422,
                    detail="Trend analysis does not support group_by.",
                )

            return execute_trend(
                path=path,
                dataset_id=dataset_id,
                request=request,
            )

        # 3. Descriptive statistics
        if request.operation == ExecutionOperation.DESCRIPTIVE:
            if request.aggregation is not None:
                raise HTTPException(
                    status_code=422,
                    detail=(
                        "Descriptive analytics does not accept "
                        "an aggregation."
                    ),
                )

            if request.group_by is not None:
                raise HTTPException(
                    status_code=422,
                    detail=(
                        "Descriptive analytics does not support group_by."
                    ),
                )

            if (
                request.date_column is not None
                or request.interval is not None
            ):
                raise HTTPException(
                    status_code=422,
                    detail=(
                        "Descriptive analytics does not accept "
                        "trend parameters."
                    ),
                )

            return execute_descriptive(
                path=path,
                dataset_id=dataset_id,
                request=request,
            )

        # 4. Segment comparison
        if request.operation == ExecutionOperation.SEGMENT_COMPARISON:
            if (
                request.date_column is not None
                or request.interval is not None
            ):
                raise HTTPException(
                    status_code=422,
                    detail=(
                        "Segment comparison does not accept "
                        "trend parameters."
                    ),
                )

            return execute_segment_comparison(
                path=path,
                dataset_id=dataset_id,
                request=request,
            )

        # 5. KPI and grouped KPI analysis
        if (
            request.date_column is not None
            or request.interval is not None
        ):
            raise HTTPException(
                status_code=422,
                detail="KPI operations do not accept trend parameters.",
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
