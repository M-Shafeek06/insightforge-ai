from __future__ import annotations

import math
from pathlib import Path

import pandas as pd

from app.data.loaders.tabular import load_tabular_file
from app.schemas.execution import (
    CorrelationAnalyticsResponse,
    CorrelationDataPoint,
    ExecutionOperation,
)
from app.services.analytics_executor import AnalyticsExecutionError


MAX_CORRELATION_CHART_POINTS = 1000


def execute_correlation(
    path: Path,
    dataset_id: str,
    column: str,
    second_column: str,
) -> CorrelationAnalyticsResponse:
    """Calculate Pearson correlation between two numeric columns."""

    if column == second_column:
        raise AnalyticsExecutionError(
            "Select two different columns for correlation analysis."
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

    for requested_column in (column, second_column):
        if requested_column not in df.columns:
            raise AnalyticsExecutionError(
                f"Column '{requested_column}' does not exist in the dataset."
            )

        if not pd.api.types.is_numeric_dtype(df[requested_column]):
            raise AnalyticsExecutionError(
                f"Column '{requested_column}' must contain numeric values "
                "for correlation analysis."
            )

        valid_values = df[requested_column].dropna()

        if not all(
            math.isfinite(float(value))
            for value in valid_values
        ):
            raise AnalyticsExecutionError(
                f"Column '{requested_column}' contains non-finite "
                "numeric values."
            )

    paired = df[[column, second_column]].dropna()

    observation_count = len(paired)

    if observation_count < 2:
        raise AnalyticsExecutionError(
            "Correlation requires at least two rows with valid values "
            "in both selected columns."
        )

    first = paired[column]
    second = paired[second_column]

    if first.nunique() < 2:
        raise AnalyticsExecutionError(
            f"Column '{column}' is constant among valid paired observations; "
            "correlation is undefined."
        )

    if second.nunique() < 2:
        raise AnalyticsExecutionError(
            f"Column '{second_column}' is constant among valid paired "
            "observations; correlation is undefined."
        )

    # Scale each column before calculating Pearson correlation to reduce
    # numerical overflow risk for large-magnitude finite values.
    first_scale = max(abs(float(value)) for value in first)
    second_scale = max(abs(float(value)) for value in second)

    if first_scale == 0 or second_scale == 0:
        raise AnalyticsExecutionError(
            "Correlation is undefined for a constant column."
        )

    scaled_first = first.astype("float64") / first_scale
    scaled_second = second.astype("float64") / second_scale

    try:
        coefficient = float(
            scaled_first.corr(scaled_second, method="pearson")
        )
    except (ArithmeticError, TypeError, ValueError) as exc:
        raise AnalyticsExecutionError(
            "Unable to calculate the correlation coefficient."
        ) from exc

    if not math.isfinite(coefficient):
        raise AnalyticsExecutionError(
            "Correlation could not be calculated reliably for these columns."
        )

    # Protect against tiny floating-point excursions outside [-1, 1].
    coefficient = max(-1.0, min(1.0, coefficient))

    absolute_coefficient = abs(coefficient)

    if absolute_coefficient < 0.1:
        strength = "negligible"
    elif absolute_coefficient < 0.3:
        strength = "weak"
    elif absolute_coefficient < 0.7:
        strength = "moderate"
    else:
        strength = "strong"

    if coefficient > 0:
        direction = "positive"
    elif coefficient < 0:
        direction = "negative"
    else:
        direction = "none"

    # The coefficient uses every valid paired observation. The chart uses
    # a bounded, deterministic sample for large datasets.
    sampled = observation_count > MAX_CORRELATION_CHART_POINTS

    if sampled:
        sample_positions = [
            (index * (observation_count - 1))
            // (MAX_CORRELATION_CHART_POINTS - 1)
            for index in range(MAX_CORRELATION_CHART_POINTS)
        ]
        chart_pairs = paired.iloc[sample_positions]
    else:
        chart_pairs = paired

    points = [
        CorrelationDataPoint(
            x=float(x_value),
            y=float(y_value),
        )
        for x_value, y_value in chart_pairs.itertuples(
            index=False,
            name=None,
        )
    ]

    return CorrelationAnalyticsResponse(
        dataset_id=dataset_id,
        operation=ExecutionOperation.CORRELATION,
        column=column,
        second_column=second_column,
        correlation=coefficient,
        observation_count=observation_count,
        strength=strength,
        direction=direction,
        points=points,
        sampled=sampled,
    )
