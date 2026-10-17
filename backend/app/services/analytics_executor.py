from __future__ import annotations

import math
from pathlib import Path

import pandas as pd

from app.data.loaders.tabular import load_tabular_file
from app.schemas.execution import (
    Aggregation,
    AnalyticsExecutionGroup,
    AnalyticsExecutionRequest,
    AnalyticsExecutionResponse,
    ExecutionOperation,
    GroupedAnalyticsExecutionResponse,
)


class AnalyticsExecutionError(ValueError):
    """Raised when an analytical operation cannot be executed."""


class DatasetNotFoundError(FileNotFoundError):
    """Raised when the requested dataset does not exist."""


def _stable_mean(values: pd.Series) -> float:
    """Calculate a mean while reducing intermediate overflow and rounding error."""

    if values.empty:
        raise AnalyticsExecutionError(
            "Cannot calculate an average without valid values."
        )

    numeric_values = [float(value) for value in values]
    scale = max(abs(value) for value in numeric_values)

    if scale == 0:
        return 0.0

    scaled_sum = math.fsum(
        value / scale for value in numeric_values
    )

    scaled_mean = scaled_sum / len(numeric_values)

    return float(scale * scaled_mean)


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
            result = _stable_mean(valid_values)

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


def execute_grouped_kpi(
    path: Path,
    dataset_id: str,
    request: AnalyticsExecutionRequest,
) -> GroupedAnalyticsExecutionResponse:
    """Execute a supported KPI aggregation for each distinct group."""

    if request.group_by is None:
        raise AnalyticsExecutionError(
            "A grouping column is required for grouped execution."
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
            f"Grouping column '{request.group_by}' "
            "does not exist in the dataset."
        )

    grouping_series = df[request.group_by]

    if pd.api.types.is_numeric_dtype(grouping_series):
        valid_group_values = grouping_series.dropna()

        if not all(
            math.isfinite(float(value))
            for value in valid_group_values
        ):
            raise AnalyticsExecutionError(
                "The grouping column contains non-finite numeric values."
            )

    series = df[request.column]

    if request.aggregation != Aggregation.COUNT:
        if not pd.api.types.is_numeric_dtype(series):
            raise AnalyticsExecutionError(
                f"Aggregation '{request.aggregation.value}' "
                "requires a numeric column."
            )

        valid_values = series.dropna()

        if not all(
            math.isfinite(float(value))
            for value in valid_values
        ):
            raise AnalyticsExecutionError(
                "The selected column contains non-finite numeric values."
            )

    groups: list[AnalyticsExecutionGroup] = []

    grouped_data = df.groupby(
        request.group_by,
        dropna=False,
        sort=False,
        observed=True,
    )

    for group_value, group_df in grouped_data:
        group_series = group_df[request.column]

        valid_values = group_series.dropna()
        valid_value_count = int(group_series.notna().sum())
        null_count = int(group_series.isna().sum())

        if request.aggregation == Aggregation.COUNT:
            result = float(valid_value_count)

        elif valid_values.empty:
            result = None

        elif request.aggregation == Aggregation.SUM:
            result = float(valid_values.sum())

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

        if pd.isna(group_value):
            normalized_group_value = None

        elif isinstance(group_value, pd.Timestamp):
            normalized_group_value = group_value.isoformat()

        elif hasattr(group_value, "item"):
            normalized_group_value = group_value.item()

        else:
            normalized_group_value = group_value

        if not (
            normalized_group_value is None
            or isinstance(
                normalized_group_value,
                (str, int, float, bool),
            )
        ):
            normalized_group_value = str(normalized_group_value)

        groups.append(
            AnalyticsExecutionGroup(
                group=normalized_group_value,
                value=result,
                row_count=len(group_df),
                valid_value_count=valid_value_count,
                null_count=null_count,
            )
        )

    groups.sort(
        key=lambda item: (
            item.group is None,
            str(item.group).casefold(),
            type(item.group).__name__,
        )
    )

    return GroupedAnalyticsExecutionResponse(
        dataset_id=dataset_id,
        operation=ExecutionOperation.KPI,
        column=request.column,
        aggregation=request.aggregation,
        group_by=request.group_by,
        groups=groups,
    )