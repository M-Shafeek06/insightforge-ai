export type ExecutionAggregation = "sum" | "average" | "count";

export type TrendInterval = "day" | "week" | "month" | "year";

// -----------------------------------------------------------------------------
// Request Types
// -----------------------------------------------------------------------------

export type DescriptiveAnalyticsRequest = {
  operation: "descriptive";
  column: string;
};

export type TrendAnalyticsRequest = {
  operation: "trend";
  column: string;
  aggregation: ExecutionAggregation;
  date_column: string;
  interval: TrendInterval;
};

export type SegmentComparisonRequest = {
  operation: "segment_comparison";
  column: string;
  aggregation: ExecutionAggregation;
  group_by: string;
};

export type CorrelationAnalyticsRequest = {
  operation: "correlation";
  column: string;
  second_column: string;
};

export type AnalyticsExecutionRequest =
  | {
      operation: "kpi";
      column: string;
      aggregation: ExecutionAggregation;
      group_by?: string | null;
    }
  | DescriptiveAnalyticsRequest
  | TrendAnalyticsRequest
  | SegmentComparisonRequest
  | CorrelationAnalyticsRequest;

// -----------------------------------------------------------------------------
// Shared Result Types
// -----------------------------------------------------------------------------

export type AnalyticsExecutionGroup = {
  group: string | number | boolean | null;
  value: number | null;
  row_count: number;
  valid_value_count: number;
  null_count: number;
};

// -----------------------------------------------------------------------------
// KPI Analysis Response
// -----------------------------------------------------------------------------

export type AnalyticsExecutionResponse = {
  dataset_id: string;
  operation: "kpi";
  column: string;
  aggregation: ExecutionAggregation;
  value: number;
  row_count: number;
  valid_value_count: number;
  null_count: number;
};

export type GroupedAnalyticsExecutionResponse = {
  dataset_id: string;
  operation: "kpi";
  column: string;
  aggregation: ExecutionAggregation;
  group_by: string;
  groups: AnalyticsExecutionGroup[];
};

// -----------------------------------------------------------------------------
// Descriptive Statistics Response
// -----------------------------------------------------------------------------

export type DescriptiveAnalyticsResponse = {
  dataset_id: string;
  operation: "descriptive";
  column: string;
  row_count: number;
  valid_value_count: number;
  null_count: number;
  statistics: {
    mean: number;
    median: number;
    minimum: number;
    maximum: number;
    standard_deviation: number | null;
  };
};

// -----------------------------------------------------------------------------
// Trend Analysis Response
// -----------------------------------------------------------------------------

export type TrendDataPoint = {
  period: string;
  value: number | null;
  row_count: number;
  valid_value_count: number;
  null_count: number;
};

export type TrendAnalyticsResponse = {
  dataset_id: string;
  operation: "trend";
  column: string;
  date_column: string;
  aggregation: ExecutionAggregation;
  interval: TrendInterval;
  points: TrendDataPoint[];
};

// -----------------------------------------------------------------------------
// Segment Comparison Response
// -----------------------------------------------------------------------------

export type SegmentComparisonResponse = {
  dataset_id: string;
  operation: "segment_comparison";
  column: string;
  aggregation: ExecutionAggregation;
  segment_by: string;
  segments: AnalyticsExecutionGroup[];
};

// -----------------------------------------------------------------------------
// Measure Relationship / Correlation Response
// -----------------------------------------------------------------------------

export type CorrelationDataPoint = {
  x: number;
  y: number;
};

export type CorrelationAnalyticsResponse = {
  dataset_id: string;
  operation: "correlation";
  column: string;
  second_column: string;
  correlation: number;
  observation_count: number;
  strength: string;
  direction: string;
  points: CorrelationDataPoint[];
  sampled: boolean;
};

// -----------------------------------------------------------------------------
// Unified Analytics Result
// -----------------------------------------------------------------------------

export type AnalyticsExecutionResult =
  | AnalyticsExecutionResponse
  | GroupedAnalyticsExecutionResponse
  | DescriptiveAnalyticsResponse
  | TrendAnalyticsResponse
  | SegmentComparisonResponse
  | CorrelationAnalyticsResponse;

// -----------------------------------------------------------------------------
// Execute Dataset Analytics
// -----------------------------------------------------------------------------

export async function executeDatasetAnalytics(
  datasetId: string,
  request: AnalyticsExecutionRequest
): Promise<AnalyticsExecutionResult> {
  const response = await fetch(
    `/api/datasets/${encodeURIComponent(datasetId)}/execute`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    let message = "Unable to execute the requested analysis.";

    try {
      const error: { detail?: unknown } = await response.json();

      if (typeof error.detail === "string") {
        message = error.detail;
      } else if (Array.isArray(error.detail)) {
        message = error.detail
          .map((item: { msg?: string }) => item.msg ?? "Invalid request")
          .join("; ");
      }
    } catch {
      // Preserve the default error message for invalid response bodies.
    }

    throw new Error(message);
  }

  return response.json() as Promise<AnalyticsExecutionResult>;
}