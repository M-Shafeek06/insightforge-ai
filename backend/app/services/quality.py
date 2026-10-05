from __future__ import annotations

from pathlib import Path
from typing import Any

import pandas as pd

from app.data.loaders.tabular import load_tabular_file
from app.services.profiler import _semantic_role


def _severity_from_percentage(percentage: float) -> str:
    if percentage >= 50:
        return "critical"
    if percentage >= 20:
        return "high"
    if percentage >= 5:
        return "medium"
    return "low"


def _quality_status(score: int) -> str:
    if score < 40:
        return "Critical"
    if score < 60:
        return "Poor"
    if score < 80:
        return "Fair"
    if score < 95:
        return "Good"
    return "Excellent"


def assess_dataset_quality(
    path: Path,
    dataset_id: str,
) -> dict[str, Any]:
    df = load_tabular_file(path)

    issues: list[dict[str, Any]] = []
    total_rows = len(df)

    # ---------------------------------------------------------
    # 1. Missing values
    # ---------------------------------------------------------
    if total_rows > 0:
        for column in df.columns:
            null_count = int(df[column].isna().sum())

            if null_count == 0:
                continue

            percentage = (null_count / total_rows) * 100

            issues.append(
                {
                    "issue_type": "missing_values",
                    "severity": _severity_from_percentage(percentage),
                    "column": str(column),
                    "message": (
                        f"Column '{column}' contains {null_count} "
                        f"missing value(s) ({percentage:.1f}%)."
                    ),
                    "affected_rows": null_count,
                    "affected_percentage": round(percentage, 2),
                    "recommendation": (
                        "Review the missing records and determine whether "
                        "to impute, replace, or retain them as missing."
                    ),
                }
            )

    # ---------------------------------------------------------
    # 2. Duplicate rows
    # ---------------------------------------------------------
    duplicate_count = int(df.duplicated().sum())

    if duplicate_count > 0 and total_rows > 0:
        percentage = (duplicate_count / total_rows) * 100

        issues.append(
            {
                "issue_type": "duplicate_rows",
                "severity": _severity_from_percentage(percentage),
                "column": None,
                "message": (
                    f"Dataset contains {duplicate_count} duplicate row(s) "
                    f"({percentage:.1f}%)."
                ),
                "affected_rows": duplicate_count,
                "affected_percentage": round(percentage, 2),
                "recommendation": (
                    "Review duplicate records and remove them only if they "
                    "represent accidental duplication."
                ),
            }
        )

    # ---------------------------------------------------------
    # 3. Empty columns
    # ---------------------------------------------------------
    for column in df.columns:
        if total_rows == 0:
            continue

        null_count = int(df[column].isna().sum())

        if null_count == total_rows:
            issues.append(
                {
                    "issue_type": "empty_column",
                    "severity": "critical",
                    "column": str(column),
                    "message": f"Column '{column}' contains no usable values.",
                    "affected_rows": total_rows,
                    "affected_percentage": 100.0,
                    "recommendation": (
                        "Remove the column unless it is intentionally "
                        "reserved for future data."
                    ),
                }
            )

    # ---------------------------------------------------------
    # 4. Constant columns
    # ---------------------------------------------------------
    for column in df.columns:
        unique_count = int(df[column].nunique(dropna=True))

        if unique_count == 1:
            issues.append(
                {
                    "issue_type": "constant_column",
                    "severity": "low",
                    "column": str(column),
                    "message": (
                        f"Column '{column}' contains only one distinct value."
                    ),
                    "affected_rows": total_rows,
                    "affected_percentage": 100.0,
                    "recommendation": (
                        "Consider removing the column if it provides no "
                        "analytical value."
                    ),
                }
            )

    # ---------------------------------------------------------
    # 5. Date-like columns stored as object/text
    # ---------------------------------------------------------
    for column in df.columns:
        series = df[column]

        if series.dtype != "object":
            continue

        role = _semantic_role(series)

        if role == "time":
            non_null = series.dropna()

            if non_null.empty:
                continue

            parsed = pd.to_datetime(non_null, errors="coerce")
            invalid_count = int(parsed.isna().sum())

            if invalid_count > 0:
                percentage = (invalid_count / len(non_null)) * 100

                issues.append(
                    {
                        "issue_type": "invalid_date_values",
                        "severity": _severity_from_percentage(percentage),
                        "column": str(column),
                        "message": (
                            f"Column '{column}' appears to be date/time data "
                            f"but contains {invalid_count} value(s) that "
                            "cannot be parsed as dates."
                        ),
                        "affected_rows": invalid_count,
                        "affected_percentage": round(percentage, 2),
                        "recommendation": (
                            "Standardize the date format and review invalid "
                            "date values before analysis."
                        ),
                    }
                )
            else:
                issues.append(
                    {
                        "issue_type": "date_as_text",
                        "severity": "low",
                        "column": str(column),
                        "message": (
                            f"Column '{column}' appears to contain date/time "
                            "values stored as text."
                        ),
                        "affected_rows": len(non_null),
                        "affected_percentage": 100.0,
                        "recommendation": (
                            "Convert the column to a proper datetime type "
                            "during data cleaning."
                        ),
                    }
                )

    # ---------------------------------------------------------
    # 6. High-cardinality columns
    # ---------------------------------------------------------
    for column in df.columns:
        if total_rows == 0:
            continue

        unique_count = int(df[column].nunique(dropna=True))
        cardinality_ratio = unique_count / total_rows

        if total_rows >= 20 and cardinality_ratio >= 0.9:
            issues.append(
                {
                    "issue_type": "high_cardinality",
                    "severity": "low",
                    "column": str(column),
                    "message": (
                        f"Column '{column}' has very high cardinality "
                        f"({unique_count:,} unique values across "
                        f"{total_rows:,} rows)."
                    ),
                    "affected_rows": unique_count,
                    "affected_percentage": round(cardinality_ratio * 100, 2),
                    "recommendation": (
                        "Review whether the column is an identifier or "
                        "whether it should be used as a categorical dimension."
                    ),
                }
            )

    # ---------------------------------------------------------
    # 7. Duplicate column names
    # ---------------------------------------------------------
    column_names = [str(column) for column in df.columns]
    duplicate_columns = {
        column
        for column in column_names
        if column_names.count(column) > 1
    }

    for column in sorted(duplicate_columns):
        issues.append(
            {
                "issue_type": "duplicate_column_name",
                "severity": "high",
                "column": column,
                "message": (
                    f"Column name '{column}' appears more than once."
                ),
                "affected_rows": total_rows,
                "affected_percentage": 100.0 if total_rows else 0.0,
                "recommendation": (
                    "Rename duplicate columns so every column has a unique "
                    "and meaningful name."
                ),
            }
        )

    # ---------------------------------------------------------
    # Quality score
    # ---------------------------------------------------------
    score = 100

    severity_penalties = {
        "critical": 25,
        "high": 15,
        "medium": 8,
        "low": 3,
    }

    for issue in issues:
        score -= severity_penalties.get(issue["severity"], 0)

    score = max(0, min(100, score))

    summary = {
        "total_issues": len(issues),
        "critical": sum(
            issue["severity"] == "critical" for issue in issues
        ),
        "high": sum(
            issue["severity"] == "high" for issue in issues
        ),
        "medium": sum(
            issue["severity"] == "medium" for issue in issues
        ),
        "low": sum(
            issue["severity"] == "low" for issue in issues
        ),
    }

    return {
        "dataset_id": dataset_id,
        "overall_score": score,
        "quality_status": _quality_status(score),
        "issues": issues,
        "summary": summary,
    }