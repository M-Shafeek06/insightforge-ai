export type AnalysisPlanningRequest = {
  business_objective: string;
  business_questions: string[];
};

export type RecommendedKPI = {
  name: string;
  description: string;
  required_columns: string[];
  calculation: string;
};

export type RecommendedAnalysis = {
  name: string;
  description: string;
  analysis_method: string;
  operation: "descriptive" | "trend" | "segment_comparison" | "correlation";
  required_columns: string[];
  business_value: string;
};

export type AnalysisQualityWarning = {
  issue_type: string;
  severity: string;
  column: string | null;
  message: string;
  recommendation: string;
};

export type AnalysisPlan = {
  dataset_id: string;
  business_objective: string;
  feasibility_status: string;
  feasibility_reason: string;
  recommended_kpis: RecommendedKPI[];
  recommended_analyses: RecommendedAnalysis[];
  available_columns: string[];
  missing_required_columns: string[];
  quality_warnings: AnalysisQualityWarning[];
};

export async function createAnalysisPlan(
  datasetId: string,
  request: AnalysisPlanningRequest
): Promise<AnalysisPlan> {
  const response = await fetch(
    `/api/datasets/${encodeURIComponent(datasetId)}/analysis-plan`,
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
    let message = "Unable to generate the analysis plan.";

    try {
      const error = await response.json();

      if (typeof error.detail === "string") {
        message = error.detail;
      } else if (Array.isArray(error.detail)) {
        message = error.detail
          .map((item: { msg?: string }) => item.msg ?? "Invalid request")
          .join("; ");
      }
    } catch {
      // Retain the default message if the response is not valid JSON.
    }

    throw new Error(message);
  }

  return response.json();
}
