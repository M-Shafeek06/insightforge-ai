from __future__ import annotations

import math
from pathlib import Path

import pandas as pd

from app.data.loaders.tabular import load_tabular_file
from app.schemas.execution import (
    Aggregation,
    AnalyticsExecutionGroup,
    AnalyticsExecutionRequest,
    ExecutionOperation,
    SegmentComparisonResponse,
)
from app.services.analytics_executor import (
    AnalyticsExecutionError,
    _stable_mean,
)


def execute_segment_comparison(
    path: Path,
    dataset_id: str,
    request: AnalyticsExecutionRequest,
) -> SegmentComparisonResponse:
    """Compare a selected measure across distinct segment values."""

    if request.group_by is None:
        raise AnalyticsExecutionError(
            "Segment comparison requires a segment column."
        )

    if request.aggregation is None:
        raise AnalyticsExecutionError(
            "Segment comparison requires an aggregation."
        )

    try:
        df = load_tabular_file(path)
    except (OSError, ValueError, ImportError) as exc:
        raise AnalyticsExecutionError(
            "Unable to read the dataset."
        ) from exc

    if df.empty:
        raise AnalyticsExecutionError(
            "Cannot execute analytics on an empty dataset."
        )

    if not df.columns.is_unique:
        raise AnalyticsExecutionError(
            "The dataset contains duplicate column names."
        )

    if request.column not in df.columns:
        raise AnalyticsExecutionError(
            f"Column '{request.column}' does not exist in the dataset."
        )

    if request.group_by not in df.columns:
        raise AnalyticsExecutionError(
            f"Segment column '{request.group_by}' "
            "does not exist in the dataset."
        )

    if request.column == request.group_by:
        raise AnalyticsExecutionError(
            "The measure column and segment column must be different."
        )

    values = df[request.column]
    segment_values = df[request.group_by]

    if request.aggregation != Aggregation.COUNT:
        if not pd.api.types.is_numeric_dtype(values):
            raise AnalyticsExecutionError(
                f"Aggregation '{request.aggregation.value}' "
                "requires a numeric column."
            )

        valid_values = values.dropna()

        if not all(
            math.isfinite(float(value))
            for value in valid_values
        ):
            raise AnalyticsExecutionError(
                "The selected column contains non-finite numeric values."
            )

    if pd.api.types.is_numeric_dtype(segment_values):
        valid_segments = segment_values.dropna()

        if not all(
            math.isfinite(float(value))
            for value in valid_segments
        ):
            raise AnalyticsExecutionError(
                "The segment column contains non-finite numeric values."
            )

    grouped = df.groupby(
        request.group_by,
        dropna=False,
        sort=False,
        observed=True,
    )

    segments: list[AnalyticsExecutionGroup] = []

    for segment_value, group_df in grouped:
        group_values = group_df[request.column]
        valid_values = group_values.dropna()

        valid_count = int(group_values.notna().sum())
        null_count = int(group_values.isna().sum())

        if request.aggregation == Aggregation.COUNT:
            result = float(valid_count)

        elif valid_values.empty:
            result = None

        elif request.aggregation == Aggregation.SUM:
            result = float(
                math.fsum(float(value) for value in valid_values)
            )

        elif request.aggregation == Aggregation.AVERAGE:
            result = _stable_mean(valid_values)

        else:
            raise AnalyticsExecutionError(
                "The requested aggregation is not supported."
            )

        if result is not None and not math.isfinite(result):
            raise AnalyticsExecutionError(
                "The aggregation produced a non-finite result."
            )

        if pd.isna(segment_value):
            normalized_segment = None
        elif isinstance(segment_value, pd.Timestamp):
            normalized_segment = segment_value.isoformat()
        elif hasattr(segment_value, "item"):
            normalized_segment = segment_value.item()
        else:
            normalized_segment = segment_value

        if not (
            normalized_segment is None
            or isinstance(
                normalized_segment,
                (str, int, float, bool),
            )
        ):
            normalized_segment = str(normalized_segment)

        segments.append(
            AnalyticsExecutionGroup(
                group=normalized_segment,
                value=result,
                row_count=len(group_df),
                valid_value_count=valid_count,
                null_count=null_count,
            )
        )

    segments.sort(
        key=lambda item: (
            item.group is None,
            str(item.group).casefold(),
            type(item.group).__name__,
        )
    )

    return SegmentComparisonResponse(
        dataset_id=dataset_id,
        operation=ExecutionOperation.SEGMENT_COMPARISON,
        column=request.column,
        aggregation=request.aggregation,
        segment_by=request.group_by,
        segments=segments,
    )