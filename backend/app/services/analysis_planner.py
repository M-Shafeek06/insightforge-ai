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
    return "".join(
        character
        for character in value.lower()
        if character.isalnum()
    )


def _find_column(
    columns: list[str],
    candidates: tuple[str, ...],
) -> str | None:
    """Find a column by exact normalized name or candidate substring."""
    normalized_columns = {
        column: _normalize(column)
        for column in columns
    }

    # Prefer exact matches.
    for candidate in candidates:
        normalized_candidate = _normalize(candidate)

        for column, normalized_column in normalized_columns.items():
            if normalized_column == normalized_candidate:
                return column

    # Fall back to substring matches.
    for candidate in candidates:
        normalized_candidate = _normalize(candidate)

        for column, normalized_column in normalized_columns.items():
            if normalized_candidate in normalized_column:
                return column

    return None


def _objective_requirements(
    columns: list[str],
    objective: str,
    questions: list[str],
) -> list[str]:
    """Identify missing column requirements implied by business intent."""
    text = " ".join([objective, *questions]).lower()

    requirements: list[
        tuple[tuple[str, ...], tuple[str, ...]]
    ] = [
        (
            ("product", "products", "item", "items", "sku"),
            (
                "product",
                "product_name",
                "product_id",
                "item",
                "item_name",
                "item_id",
                "sku",
            ),
        ),
        (
            (
                "customer",
                "customers",
                "customer_id",
                "customer_name",
                "customer segment",
                "client",
                "clients",
            ),
            (
                "customer",
                "customer_id",
                "customer_name",
                "client",
                "client_id",
            ),
        ),
        (
            (
                "region",
                "regional",
                "territory",
                "geography",
                "geographic",
            ),
            (
                "region",
                "territory",
                "state",
                "country",
                "city",
                "geography",
            ),
        ),
        (
            (
                "employee",
                "employees",
                "sales representative",
                "salesperson",
            ),
            (
                "employee",
                "employee_id",
                "sales_rep",
                "salesperson",
                "representative",
            ),
        ),
    ]

    missing: list[str] = []

    for keywords, candidates in requirements:
        if not any(keyword in text for keyword in keywords):
            continue

        if _find_column(columns, candidates) is not None:
            continue

        missing.append(
            candidates[0].replace("_", " ").title()
        )

    return missing


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


def _numeric_columns(df: pd.DataFrame) -> list[str]:
    """Return numeric measure candidates, excluding common identifiers."""
    excluded_tokens = (
        "id",
        "code",
        "key",
        "zip",
        "postal",
    )

    return [
        str(column)
        for column in df.columns
        if pd.api.types.is_numeric_dtype(df[column])
        and not any(
            token in str(column).lower()
            for token in excluded_tokens
        )
    ]


def _question_column(
    columns: list[str],
    questions: list[str],
    candidates: list[str],
) -> str | None:
    """
    Select the most specific candidate column referenced in a question.

    Exact normalized matches are preferred. When only substring matches
    exist, the longest matching column name wins.
    """
    normalized_candidates = [
        (column, _normalize(column))
        for column in candidates
        if _normalize(column)
    ]

    for question in questions:
        question_normalized = _normalize(question)

        if not question_normalized:
            continue

        # Prefer a candidate that matches the complete question.
        exact_matches = [
            column
            for column, normalized in normalized_candidates
            if normalized == question_normalized
        ]

        if exact_matches:
            return max(
                exact_matches,
                key=lambda column: len(_normalize(column)),
            )

        # Resolve overlapping column names by preferring the longest.
        substring_matches = [
            (column, normalized)
            for column, normalized in normalized_candidates
            if normalized in question_normalized
        ]

        if substring_matches:
            return max(
                substring_matches,
                key=lambda match: len(match[1]),
            )[0]

    return None


def _recommended_kpis(
    df: pd.DataFrame,
    columns: list[str],
    objective: str,
) -> list[RecommendedKPI]:
    """Recommend KPIs using available numeric columns and objective keywords."""
    kpis: list[RecommendedKPI] = []
    objective_lower = objective.lower()
    numeric_columns = _numeric_columns(df)

    sales_column = _find_column(
        columns,
        (
            "sales",
            "revenue",
            "total_amount",
            "amount",
            "turnover",
        ),
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

    if (
        profit_column in numeric_columns
        and any(
            word in objective_lower
            for word in (
                "profit",
                "margin",
                "financial",
                "performance",
            )
        )
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

    if (
        quantity_column in numeric_columns
        and any(
            word in objective_lower
            for word in (
                "sales",
                "product",
                "quantity",
                "inventory",
            )
        )
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
    business_questions: list[str] | None = None,
) -> list[RecommendedAnalysis]:
    """Recommend and prioritize analyses using available columns and questions."""
    analyses: list[RecommendedAnalysis] = []
    questions = business_questions or []

    numeric_columns = _numeric_columns(df)

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

    # Select the dimension most relevant to the business questions.
    selected_dimension = (
        _question_column(
            columns,
            questions,
            dimension_columns,
        )
        or (dimension_columns[0] if dimension_columns else None)
    )

    # Select the numeric measure most relevant to the questions.
    selected_measure = (
        _question_column(
            columns,
            questions,
            numeric_columns,
        )
        or (
            _find_column(
                columns,
                ("sales", "revenue", "profit", "quantity"),
            )
            if numeric_columns
            else None
        )
    )

    if selected_measure not in numeric_columns:
        selected_measure = (
            numeric_columns[0] if numeric_columns else None
        )

    # Select the most relevant time column.
    selected_time = (
        _question_column(
            columns,
            questions,
            time_columns,
        )
        or (time_columns[0] if time_columns else None)
    )

    question_text = " ".join(questions).lower()

    # Detect explicit requests for time-based analysis.
    asks_about_trends = any(
        keyword in question_text
        for keyword in (
            "over time",
            "trend",
            "monthly",
            "daily",
            "weekly",
            "yearly",
            "change over time",
        )
    )

    # Detect explicit requests for category or segment comparisons.
    asks_about_segments = any(
        keyword in question_text
        for keyword in (
            "which region",
            "which category",
            "which product",
            "which customer",
            "by region",
            "by category",
            "by product",
            "by customer",
            "most sales",
            "generates the most",
            "highest sales",
            "top-performing",
        )
    )

    # Prioritize trend analysis when explicitly requested.
    if asks_about_trends and numeric_columns and selected_time:
        analyses.append(
            RecommendedAnalysis(
                name="Trend Analysis",
                description="Examine how numeric measures change over time.",
                analysis_method="Time-based aggregation",
                required_columns=[
                    selected_time,
                    selected_measure or numeric_columns[0],
                ],
                business_value="Identify trends, peaks and declines over time.",
            )
        )

    # Recommend segment comparison when supported by the dataset.
    if (
        selected_dimension
        and selected_measure
        and (
            asks_about_segments
            or not asks_about_trends
        )
    ):
        analyses.append(
            RecommendedAnalysis(
                name="Segment Comparison",
                description="Compare a numeric measure across categories.",
                analysis_method="Group-by aggregation",
                required_columns=[
                    selected_dimension,
                    selected_measure,
                ],
                business_value=(
                    "Identify the categories contributing most to the measure."
                ),
            )
        )

    # Include a trend analysis when time columns exist and trends were
    # not explicitly requested.
    if numeric_columns and time_columns and not asks_about_trends:
        analyses.append(
            RecommendedAnalysis(
                name="Trend Analysis",
                description="Examine how numeric measures change over time.",
                analysis_method="Time-based aggregation",
                required_columns=[
                    selected_time or time_columns[0],
                    selected_measure or numeric_columns[0],
                ],
                business_value="Identify trends, peaks and declines over time.",
            )
        )

    # Recommend relationships between numeric measures.
    if len(numeric_columns) >= 2:
        first_measure = selected_measure or numeric_columns[0]

        second_measure = next(
            (
                column
                for column in numeric_columns
                if column != first_measure
            ),
            None,
        )

        if second_measure:
            analyses.append(
                RecommendedAnalysis(
                    name="Measure Relationship",
                    description=(
                        "Explore the relationship between numeric measures."
                    ),
                    analysis_method="Correlation analysis",
                    required_columns=[
                        first_measure,
                        second_measure,
                    ],
                    business_value=(
                        "Identify potential associations between measures."
                    ),
                )
            )

    # Provide a fallback when no other analysis is possible.
    if not analyses and numeric_columns:
        analyses.append(
            RecommendedAnalysis(
                name="Descriptive Analysis",
                description=(
                    "Summarize the distribution of a numeric measure."
                ),
                analysis_method="Descriptive statistics",
                required_columns=[numeric_columns[0]],
                business_value=(
                    "Understand the scale and distribution of the measure."
                ),
            )
        )

    # Remove duplicate recommendations while preserving their priority.
    unique_analyses: list[RecommendedAnalysis] = []
    seen: set[tuple[str, tuple[str, ...]]] = set()

    for analysis in analyses:
        key = (
            analysis.name,
            tuple(analysis.required_columns),
        )

        if key in seen:
            continue

        seen.add(key)
        unique_analyses.append(analysis)

    return unique_analyses


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
        business_questions=questions,
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

    missing_recommended_columns = sorted(
        column
        for column in required_columns
        if column not in columns
    )

    objective_missing_columns = _objective_requirements(
        columns=columns,
        objective=objective,
        questions=questions,
    )

    missing_required_columns = sorted(
        set(missing_recommended_columns)
        | set(objective_missing_columns)
    )

    if not columns or len(df) == 0:
        feasibility_status = "not_feasible"
        feasibility_reason = (
            "The dataset contains no usable rows or columns."
        )

    elif not recommended_kpis and not recommended_analyses:
        feasibility_status = "not_feasible"
        feasibility_reason = (
            "No suitable numeric measures were identified "
            "for the current analysis rules."
        )

    elif objective_missing_columns:
        feasibility_status = "partially_feasible"

        missing_description = ", ".join(
            objective_missing_columns
        )

        feasibility_reason = (
            "The dataset supports some general analysis, but "
            "the requested business objective requires "
            f"additional column(s): {missing_description}."
        )

    else:
        feasibility_status = "feasible"
        feasibility_reason = (
            "The dataset contains columns suitable for the "
            "requested objective and recommended analyses."
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