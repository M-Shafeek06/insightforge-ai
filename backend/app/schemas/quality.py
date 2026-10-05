from pydantic import BaseModel, Field


class QualityIssue(BaseModel):
    issue_type: str
    severity: str
    column: str | None = None
    message: str
    affected_rows: int = Field(ge=0)
    affected_percentage: float = Field(ge=0, le=100)
    recommendation: str


class QualitySummary(BaseModel):
    total_issues: int = Field(ge=0)
    critical: int = Field(ge=0)
    high: int = Field(ge=0)
    medium: int = Field(ge=0)
    low: int = Field(ge=0)


class DatasetQualityResponse(BaseModel):
    dataset_id: str
    overall_score: int = Field(ge=0, le=100)
    quality_status: str
    issues: list[QualityIssue]
    summary: QualitySummary