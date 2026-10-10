export type QualityIssue = {
  issue_type: string;
  severity: string;
  column: string | null;
  message: string;
  affected_rows: number;
  affected_percentage: number;
  recommendation: string;
};

export type QualitySummary = {
  total_issues: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
};

export type DatasetQuality = {
  dataset_id: string;
  overall_score: number;
  quality_status: string;
  issues: QualityIssue[];
  summary: QualitySummary;
};

export async function getDatasetQuality(
  datasetId: string
): Promise<DatasetQuality> {
  const response = await fetch(
    `/api/datasets/${datasetId}/quality`,
    { cache: "no-store" }
  );

  if (!response.ok) {
    throw new Error(
      (await response.json()).detail ?? "Quality assessment failed"
    );
  }

  return response.json();
}