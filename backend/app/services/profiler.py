from __future__ import annotations

from pathlib import Path
from typing import Any

import pandas as pd

from app.data.loaders.tabular import load_tabular_file


def _semantic_role(series: pd.Series) -> str:
    name = str(series.name).strip().lower()
    dtype = series.dtype

    if pd.api.types.is_datetime64_any_dtype(dtype) or any(
        token in name for token in ("date", "time", "month", "year")
    ):
        return "time"
    if pd.api.types.is_numeric_dtype(dtype):
        if any(token in name for token in ("id", "code", "key")):
            return "identifier"
        return "measure"
    if series.nunique(dropna=True) <= max(20, int(len(series) * 0.05)):
        return "dimension"
    if any(token in name for token in ("id", "code", "key")):
        return "identifier"
    return "attribute"


def _json_value(value: Any) -> Any:
    if pd.isna(value):
        return None
    if hasattr(value, "item"):
        return value.item()
    return value


def profile_dataset(path: Path, dataset_id: str, filename: str) -> dict[str, Any]:
    df = load_tabular_file(path)
    column_profiles: list[dict[str, Any]] = []

    for column in df.columns:
        series = df[column]
        non_null = series.dropna()
        min_value = None
        max_value = None
        if pd.api.types.is_numeric_dtype(series) and not non_null.empty:
            min_value = _json_value(non_null.min())
            max_value = _json_value(non_null.max())
        elif pd.api.types.is_datetime64_any_dtype(series) and not non_null.empty:
            min_value = non_null.min().isoformat()
            max_value = non_null.max().isoformat()

        column_profiles.append(
            {
                "name": str(column),
                "dtype": str(series.dtype),
                "null_count": int(series.isna().sum()),
                "unique_count": int(series.nunique(dropna=True)),
                "min_value": min_value,
                "max_value": max_value,
                "semantic_role": _semantic_role(series),
            }
        )

    return {
        "dataset_id": dataset_id,
        "filename": filename,
        "rows": int(len(df)),
        "columns": int(len(df.columns)),
        "missing_values": int(df.isna().sum().sum()),
        "duplicate_rows": int(df.duplicated().sum()),
        "columns_profile": column_profiles,
    }
