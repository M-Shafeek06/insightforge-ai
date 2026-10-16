from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


class Aggregation(str, Enum):
    SUM = "sum"
    AVERAGE = "average"
    COUNT = "count"


class ExecutionOperation(str, Enum):
    KPI = "kpi"


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
    aggregation: Aggregation = Field(
        description="The aggregation to execute.",
    )


class AnalyticsExecutionResponse(BaseModel):
    dataset_id: str
    operation: ExecutionOperation
    column: str
    aggregation: Aggregation
    value: float
    row_count: int
    valid_value_count: int
    null_count: int