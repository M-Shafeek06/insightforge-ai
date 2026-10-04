from typing import Any

from pydantic import BaseModel, Field


class ColumnProfile(BaseModel):
    name: str
    dtype: str
    null_count: int = Field(ge=0)
    unique_count: int = Field(ge=0)
    min_value: Any | None = None
    max_value: Any | None = None
    semantic_role: str


class DatasetUploadResponse(BaseModel):
    dataset_id: str
    filename: str


class DatasetProfileResponse(BaseModel):
    dataset_id: str
    filename: str
    rows: int = Field(ge=0)
    columns: int = Field(ge=0)
    missing_values: int = Field(ge=0)
    duplicate_rows: int = Field(ge=0)
    columns_profile: list[ColumnProfile]
