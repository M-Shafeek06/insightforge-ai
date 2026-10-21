from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


class Aggregation(str, Enum):
    SUM = "sum"
    AVERAGE = "average"
    COUNT = "count"


class ExecutionOperation(str, Enum):
    KPI = "kpi"
    DESCRIPTIVE = "descriptive"
    TREND = "trend"
    SEGMENT_COMPARISON = "segment_comparison"
    CORRELATION = "correlation"


class TrendInterval(str, Enum):
    DAY = "day"
    WEEK = "week"
    MONTH = "month"
    YEAR = "year"


class AnalyticsExecutionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    operation: ExecutionOperation = Field(
        description="The supported analytical operation.",
    )

    column: str = Field(
        min_length=1,
        max_length=255,
        description="The exact primary column name to analyze.",
    )

    second_column: str | None = Field(
        default=None,
        min_length=1,
        max_length=255,
        description="The second numeric column for correlation analysis.",
    )

    aggregation: Aggregation | None = Field(
        default=None,
        description="The aggregation used for KPI, trend, or segment comparison.",
    )

    group_by: str | None = Field(
        default=None,
        min_length=1,
        max_length=255,
        description="Optional grouping or segment column.",
    )

    date_column: str | None = Field(
        default=None,
        min_length=1,
        max_length=255,
        description="The column containing dates for trend analysis.",
    )

    interval: TrendInterval | None = Field(
        default=None,
        description="The time interval used to aggregate trend values.",
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


class SegmentComparisonResponse(BaseModel):
    dataset_id: str
    operation: ExecutionOperation
    column: str
    aggregation: Aggregation
    segment_by: str
    segments: list[AnalyticsExecutionGroup]


class TrendDataPoint(BaseModel):
    period: str
    value: float | None
    row_count: int
    valid_value_count: int
    null_count: int


class TrendAnalyticsResponse(BaseModel):
    dataset_id: str
    operation: ExecutionOperation
    column: str
    date_column: str
    aggregation: Aggregation
    interval: TrendInterval
    points: list[TrendDataPoint]


class CorrelationDataPoint(BaseModel):
    x: float
    y: float


class CorrelationAnalyticsResponse(BaseModel):
    dataset_id: str
    operation: ExecutionOperation
    column: str
    second_column: str
    correlation: float = Field(ge=-1.0, le=1.0)
    observation_count: int = Field(ge=2)
    strength: str
    direction: str
    points: list[CorrelationDataPoint]
    sampled: bool = False
