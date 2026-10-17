from __future__ import annotations

import math
from pathlib import Path

import pandas as pd

from app.data.loaders.tabular import load_tabular_file
from app.schemas.execution import (
    AnalyticsExecutionRequest,
    DescriptiveAnalyticsResponse,
    DescriptiveStatistics,
)


def _stable_descriptive_mean(values: list[float]) -> float:
    """Calculate a mean with reduced intermediate overflow risk."""
    scale = max(abs(value) for value in values)

    if scale == 0:
        return 0.0

    scaled_mean = math.fsum(value / scale for value in values) / len(values)
    result = scale * scaled_mean

    if not math.isfinite(result):
        raise ValueError("The mean could not be calculated safely.")

    return result


def _stable_descriptive_median(values: list[float]) -> float:
    """Calculate the median while avoiding overflow when averaging."""
    ordered_values = sorted(values)
    middle = len(ordered_values) // 2

    if len(ordered_values) % 2 == 1:
        median_value = ordered_values[middle]
    else:
        lower = ordered_values[middle - 1]
        upper = ordered_values[middle]

        # Divide first to avoid overflow from adding large finite values.
        median_value = lower / 2.0 + upper / 2.0

    if not math.isfinite(median_value):
        raise ValueError("Median could not be calculated safely.")

    return median_value


def _sample_standard_deviation(values: list[float]) -> float | None:
    """Calculate sample standard deviation with scaled deviations."""
    if len(values) < 2:
        return None

    scale = max(abs(value) for value in values)

    if scale == 0:
        return 0.0

    scaled_values = [value / scale for value in values]
    scaled_mean = math.fsum(scaled_values) / len(scaled_values)

    squared_deviations = math.fsum(
        (value - scaled_mean) ** 2 for value in scaled_values
    )

    scaled_std = math.sqrt(squared_deviations / (len(values) - 1))
    standard_deviation = scale * scaled_std

    if not math.isfinite(standard_deviation):
        raise ValueError(
            "Standard deviation could not be calculated safely."
        )

    return standard_deviation


def execute_descriptive(
    path: Path,
    dataset_id: str,
    request: AnalyticsExecutionRequest,
) -> DescriptiveAnalyticsResponse:
    """Calculate descriptive statistics for a numeric dataset column."""
    try:
        df = load_tabular_file(path)
    except (OSError, ValueError, ImportError) as exc:
        raise ValueError("Unable to read the dataset.") from exc

    if df.empty:
        raise ValueError("Cannot execute analytics on an empty dataset.")

    if not df.columns.is_unique:
        raise ValueError("The dataset contains duplicate column names.")

    column = request.column

    if column not in df.columns:
        raise ValueError(
            f"Column '{column}' does not exist in the dataset."
        )

    original = df[column]
    numeric = pd.to_numeric(original, errors="coerce")

    invalid = original.notna() & numeric.isna()

    if invalid.any():
        raise ValueError(
            f"Column '{column}' contains non-numeric values."
        )

    values = [float(value) for value in numeric.dropna().tolist()]

    if not values:
        raise ValueError(
            f"Column '{column}' has no valid numeric values."
        )

    if not all(math.isfinite(value) for value in values):
        raise ValueError(
            f"Column '{column}' contains non-finite numeric values."
        )

    try:
        mean_value = _stable_descriptive_mean(values)
        median_value = _stable_descriptive_median(values)
        minimum_value = min(values)
        maximum_value = max(values)
        standard_deviation = _sample_standard_deviation(values)

    except (OverflowError, ValueError) as exc:
        raise ValueError(
            "Descriptive statistics could not be calculated safely."
        ) from exc

    return DescriptiveAnalyticsResponse(
        dataset_id=dataset_id,
        operation="descriptive",
        column=column,
        row_count=len(df),
        valid_value_count=len(values),
        null_count=int(original.isna().sum()),
        statistics=DescriptiveStatistics(
            mean=mean_value,
            median=median_value,
            minimum=minimum_value,
            maximum=maximum_value,
            standard_deviation=standard_deviation,
        ),
    )