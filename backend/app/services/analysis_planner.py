from __future__ import annotations

from pathlib import Path
from typing import Any

import pandas as pd

from app.data.loaders.tabular import load_tabular_file
from app.schemas.analysis import (
    AnalysisPlanResponse,
    AnalysisQualityWarning,
    RecommendedAnalysis,
    RecommendedKPI,
)
from app.services.profiler import _semantic_role
from app.services.quality import assess_dataset_quality


def _normalize(value: str) -> str:
    """Normalize a name for case-insensitive column matching."""
    return "".join(character for character in value.lower() if character.isalnum())


def _find_column(
    columns: list[str],
    candidates: tuple[str, ...],
) -> str | None:
    """Find a column by exact normalized name or candidate substring."""
    normalized_columns = {
        column: _normalize(column)
        for column in columns
    }

    for candidate in candidates:
        normalized_candidate = _normalize(candidate)

        for column, normalized_column in normalized_columns.items():
            if normalized_column == normalized_candidate:
                return column

    for candidate in candidates:
        normalized_candidate = _normalize(candidate)

        for column, normalized_column in normalized_columns.items():
            if normalized_candidate in normalized_column:
                return column

    return None


def _quality_warnings(
    path: Path,
    dataset_id: str,
) -> list[AnalysisQualityWarning]:
    """Reuse the existing deterministic quality assessment."""
    quality_result = assess_dataset_quality(
        path=path,
        dataset_id=dataset_id,
    )

    return [
        AnalysisQualityWarning(
            issue_type=issue["issue_type"],
            severity=issue["severity"],
            column=issue["column"],
            message=issue["message"],
            recommendation=issue["recommendation"],
        )
        for issue in quality_result["issues"]
    ]


def _recommended_kpis(
    df: pd.DataFrame,
    columns: list[str],
    objective: str,
) -> list[RecommendedKPI]:
    """Recommend KPIs using available numeric columns and objective keywords."""
    kpis: list[RecommendedKPI] = []
    objective_lower = objective.lower()

    numeric_columns = [
        str(column)
        for column in df.columns
        if pd.api.types.is_numeric_dtype(df[column])
        and not any(
            token in str(column).lower()
            for token in ("id", "code", "key", "zip", "postal")
        )
    ]

    sales_column = _find_column(
        columns,
        ("sales", "revenue", "total_amount", "amount", "turnover"),
    )

    if sales_column in numeric_columns:
        kpis.append(
            RecommendedKPI(
                name="Total Sales",
                description="Total value recorded in the sales measure.",
                required_columns=[sales_column],
                calculation=f"SUM({sales_column})",
            )
        )

        kpis.append(
            RecommendedKPI(
                name="Average Sales",
                description="Average value recorded per row.",
                required_columns=[sales_column],
                calculation=f"AVERAGE({sales_column})",
            )
        )

    profit_column = _find_column(
        columns,
        ("profit", "net_profit", "gross_profit"),
    )

    if profit_column in numeric_columns and any(
        word in objective_lower
        for word in ("profit", "margin", "financial", "performance")
    ):
        kpis.append(
            RecommendedKPI(
                name="Total Profit",
                description="Total value recorded in the profit measure.",
                required_columns=[profit_column],
                calculation=f"SUM({profit_column})",
            )
        )

    quantity_column = _find_column(
        columns,
        ("quantity", "units_sold", "units", "qty"),
    )

    if quantity_column in numeric_columns and any(
        word in objective_lower
        for word in ("sales", "product", "quantity", "inventory")
    ):
        kpis.append(
            RecommendedKPI(
                name="Total Quantity",
                description="Total quantity recorded across all rows.",
                required_columns=[quantity_column],
                calculation=f"SUM({quantity_column})",
            )
        )

    if not kpis and numeric_columns:
        column = numeric_columns[0]

        kpis.append(
            RecommendedKPI(
                name=f"Total {column}",
                description=f"Sum of values in the {column} column.",
                required_columns=[column],
                calculation=f"SUM({column})",
            )
        )

    return kpis


def _recommended_analyses(
    df: pd.DataFrame,
    columns: list[str],
) -> list[RecommendedAnalysis]:
    """Recommend analyses based on available time, measure and dimension columns."""
    analyses: list[RecommendedAnalysis] = []

    numeric_columns = [
        str(column)
        for column in df.columns
        if pd.api.types.is_numeric_dtype(df[column])
        and not any(
            token in str(column).lower()
            for token in ("id", "code", "key", "zip", "postal")
        )
    ]

    time_columns = [
        str(column)
        for column in df.columns
        if _semantic_role(df[column]) == "time"
    ]

    dimension_columns = [
        str(column)
        for column in df.columns
        if _semantic_role(df[column]) == "dimension"
    ]

    if numeric_columns and time_columns:
        analyses.append(
            RecommendedAnalysis(
                name="Trend Analysis",
                description="Examine how numeric measures change over time.",
                analysis_method="Time-based aggregation",
                required_columns=[time_columns[0], numeric_columns[0]],
                business_value="Identify trends, peaks and declines over time.",
            )
        )

    if numeric_columns and dimension_columns:
        analyses.append(
            RecommendedAnalysis(
                name="Segment Comparison",
                description="Compare a numeric measure across categories.",
                analysis_method="Group-by aggregation",
                required_columns=[dimension_columns[0], numeric_columns[0]],
                business_value="Identify the categories contributing most to the measure.",
            )
        )

    if len(numeric_columns) >= 2:
        analyses.append(
            RecommendedAnalysis(
                name="Measure Relationship",
                description="Explore the relationship between numeric measures.",
                analysis_method="Correlation analysis",
                required_columns=numeric_columns[:2],
                business_value="Identify potential associations between measures.",
            )
        )

    if not analyses and numeric_columns:
        analyses.append(
            RecommendedAnalysis(
                name="Descriptive Analysis",
                description="Summarize the distribution of a numeric measure.",
                analysis_method="Descriptive statistics",
                required_columns=[numeric_columns[0]],
                business_value="Understand the scale and distribution of the measure.",
            )
        )

    return analyses


def plan_dataset_analysis(
    path: Path,
    dataset_id: str,
    business_objective: str,
    business_questions: list[str] | None = None,
) -> dict[str, Any]:
    """Create a deterministic analysis plan for an uploaded dataset."""
    df = load_tabular_file(path)
    columns = [str(column) for column in df.columns]

    objective = business_objective.strip()
    questions = business_questions or []

    recommended_kpis = _recommended_kpis(
        df=df,
        columns=columns,
        objective=objective,
    )

    recommended_analyses = _recommended_analyses(
        df=df,
        columns=columns,
    )

    required_columns = {
        column
        for kpi in recommended_kpis
        for column in kpi.required_columns
    }

    required_columns.update(
        column
        for analysis in recommended_analyses
        for column in analysis.required_columns
    )

    missing_required_columns = sorted(
        column
        for column in required_columns
        if column not in columns
    )

    if not columns or len(df) == 0:
        feasibility_status = "not_feasible"
        feasibility_reason = "The dataset contains no usable rows or columns."
    elif not recommended_kpis and not recommended_analyses:
        feasibility_status = "not_feasible"
        feasibility_reason = (
            "No suitable numeric measures were identified for the current analysis rules."
        )
    else:
        feasibility_status = "feasible"
        feasibility_reason = (
            "The dataset contains columns suitable for the recommended analyses."
        )

    quality_warnings = _quality_warnings(
        path=path,
        dataset_id=dataset_id,
    )

    return AnalysisPlanResponse(
        dataset_id=dataset_id,
        business_objective=objective,
        feasibility_status=feasibility_status,
        feasibility_reason=feasibility_reason,
        recommended_kpis=recommended_kpis,
        recommended_analyses=recommended_analyses,
        available_columns=columns,
        missing_required_columns=missing_required_columns,
        quality_warnings=quality_warnings,
    ).model_dump()