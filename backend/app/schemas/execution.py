from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


class Aggregation(str, Enum):
    SUM = "sum"
    AVERAGE = "average"
    COUNT = "count"


class ExecutionOperation(str, Enum):
    KPI = "kpi"
    DESCRIPTIVE = "descriptive"


class AnalyticsExecutionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    operation: ExecutionOperation = Field(
        description="The supported analytical operation.",
    )
    column: str = Field(
        min_length=1,
        max_length=255,
        description="The exact column name to analyze.",
    )
    aggregation: Aggregation | None = Field(
        default=None,
        description="The aggregation to execute for KPI operations.",
    )
    group_by: str | None = Field(
        default=None,
        min_length=1,
        max_length=255,
        description="Optional column used to group KPI results.",
    )


class DescriptiveStatistics(BaseModel):
    mean: float
    median: float
    minimum: float
    maximum: float
    standard_deviation: float | None


class AnalyticsExecutionResponse(BaseModel):
    dataset_id: str
    operation: ExecutionOperation
    column: str
    aggregation: Aggregation
    value: float
    row_count: int
    valid_value_count: int
    null_count: int


class DescriptiveAnalyticsResponse(BaseModel):
    dataset_id: str
    operation: ExecutionOperation
    column: str
    row_count: int
    valid_value_count: int
    null_count: int
    statistics: DescriptiveStatistics


class AnalyticsExecutionGroup(BaseModel):
    group: str | int | float | bool | None
    value: float | None
    row_count: int
    valid_value_count: int
    null_count: int


class GroupedAnalyticsExecutionResponse(BaseModel):
    dataset_id: str
    operation: ExecutionOperation
    column: str
    aggregation: Aggregation
    group_by: str
    groups: list[AnalyticsExecutionGroup]
