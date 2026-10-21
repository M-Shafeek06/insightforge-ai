from __future__ import annotations

import math
from pathlib import Path

import pandas as pd

from app.data.loaders.tabular import load_tabular_file
from app.schemas.execution import (
    Aggregation,
    AnalyticsExecutionRequest,
    ExecutionOperation,
    TrendAnalyticsResponse,
    TrendDataPoint,
    TrendInterval,
)
from app.services.analytics_executor import AnalyticsExecutionError
from app.services.analytics_executor import _stable_mean


def execute_trend(
    path: Path,
    dataset_id: str,
    request: AnalyticsExecutionRequest,
) -> TrendAnalyticsResponse:
    """Execute deterministic time-based aggregation."""

    if request.date_column is None:
        raise AnalyticsExecutionError(
            "Trend analysis requires a date column."
        )

    if request.interval is None:
        raise AnalyticsExecutionError(
            "Trend analysis requires a time interval."
        )

    if request.aggregation is None:
        raise AnalyticsExecutionError(
            "Trend analysis requires an aggregation."
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

    if request.date_column not in df.columns:
        raise AnalyticsExecutionError(
            f"Date column '{request.date_column}' "
            "does not exist in the dataset."
        )

    values = df[request.column]
    dates = pd.to_datetime(
        df[request.date_column],
        errors="coerce",
        utc=True,
    )

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

    valid_date_mask = dates.notna()

    if not valid_date_mask.any():
        raise AnalyticsExecutionError(
            "The date column contains no valid dates."
        )

    working = pd.DataFrame(
        {
            "_period": dates[valid_date_mask],
            "_value": values[valid_date_mask],
        }
    )

    frequency = {
        TrendInterval.DAY: "D",
        TrendInterval.WEEK: "W-SUN",
        TrendInterval.MONTH: "MS",
        TrendInterval.YEAR: "YS",
    }[request.interval]

    working["_period"] = working["_period"].dt.tz_convert(None)

    grouped = working.groupby(
        pd.Grouper(key="_period", freq=frequency),
        sort=True,
    )

    points: list[TrendDataPoint] = []

    for period, group_df in grouped:
        if group_df.empty:
            continue

        series = group_df["_value"]
        valid_values = series.dropna()

        valid_count = int(series.notna().sum())
        null_count = int(series.isna().sum())

        if request.aggregation == Aggregation.COUNT:
            result = float(valid_count)

        elif valid_values.empty:
            result = None

        elif request.aggregation == Aggregation.SUM:
            result = float(math.fsum(
                float(value) for value in valid_values
            ))

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

        points.append(
            TrendDataPoint(
                period=period.isoformat(),
                value=result,
                row_count=len(group_df),
                valid_value_count=valid_count,
                null_count=null_count,
            )
        )

    if not points:
        raise AnalyticsExecutionError(
            "No valid time periods were available for trend analysis."
        )

    return TrendAnalyticsResponse(
        dataset_id=dataset_id,
        operation=ExecutionOperation.TREND,
        column=request.column,
        date_column=request.date_column,
        aggregation=request.aggregation,
        interval=request.interval,
        points=points,
    )