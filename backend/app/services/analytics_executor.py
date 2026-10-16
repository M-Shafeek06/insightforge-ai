from __future__ import annotations

import math
from pathlib import Path
from typing import Any

import pandas as pd

from app.data.loaders.tabular import load_tabular_file
from app.schemas.execution import (
    Aggregation,
    AnalyticsExecutionRequest,
    AnalyticsExecutionResponse,
    ExecutionOperation,
)


class AnalyticsExecutionError(ValueError):
    """Raised when an analytical operation cannot be executed."""


class DatasetNotFoundError(FileNotFoundError):
    """Raised when the requested dataset does not exist."""


def find_dataset_path(
    dataset_id: str,
    upload_dir: Path,
) -> Path:
    """Locate an uploaded CSV or XLSX dataset by its identifier."""

    matching_files = [
        path
        for path in upload_dir.glob(f"{dataset_id}.*")
        if path.suffix.lower() in {".csv", ".xlsx"}
        and path.is_file()
    ]

    if not matching_files:
        raise DatasetNotFoundError("Dataset not found.")

    if len(matching_files) > 1:
        raise AnalyticsExecutionError(
            "Multiple files were found for this dataset identifier."
        )

    return matching_files[0]


def execute_kpi(
    path: Path,
    dataset_id: str,
    request: AnalyticsExecutionRequest,
) -> AnalyticsExecutionResponse:
    """Execute a supported KPI aggregation against an uploaded dataset."""

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

    series = df[request.column]

    valid_value_count = int(series.notna().sum())
    null_count = int(series.isna().sum())

    if request.aggregation == Aggregation.COUNT:
        result = valid_value_count

    else:
        if not pd.api.types.is_numeric_dtype(series):
            raise AnalyticsExecutionError(
                f"Aggregation '{request.aggregation.value}' "
                "requires a numeric column."
            )

        valid_values = series.dropna()

        if valid_values.empty:
            raise AnalyticsExecutionError(
                "The selected column contains no valid values."
            )

        if not all(
            math.isfinite(float(value))
            for value in valid_values
        ):
            raise AnalyticsExecutionError(
                "The selected column contains non-finite numeric values."
            )

        if request.aggregation == Aggregation.SUM:
            result = valid_values.sum()

        elif request.aggregation == Aggregation.AVERAGE:
            result = valid_values.mean()

        else:
            raise AnalyticsExecutionError(
                "The requested aggregation is not supported."
            )

    numeric_result = float(result)

    if not math.isfinite(numeric_result):
        raise AnalyticsExecutionError(
            "The aggregation produced a non-finite result."
        )

    return AnalyticsExecutionResponse(
        dataset_id=dataset_id,
        operation=ExecutionOperation.KPI,
        column=request.column,
        aggregation=request.aggregation,
        value=numeric_result,
        row_count=len(df),
        valid_value_count=valid_value_count,
        null_count=null_count,
    )