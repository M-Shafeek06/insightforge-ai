export type ExecutionAggregation = "sum" | "average" | "count";

export type AnalyticsExecutionRequest = {
  operation: "kpi";
  column: string;
  aggregation: ExecutionAggregation;
  group_by?: string | null;
};

export type AnalyticsExecutionGroup = {
  group: string | number | boolean | null;
  value: number | null;
  row_count: number;
  valid_value_count: number;
  null_count: number;
};

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

export type AnalyticsExecutionResult =
  | AnalyticsExecutionResponse
  | GroupedAnalyticsExecutionResponse;

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
      // Keep the default error message if the response is not valid JSON.
    }

    throw new Error(message);
  }

  return response.json() as Promise<AnalyticsExecutionResult>;
}
