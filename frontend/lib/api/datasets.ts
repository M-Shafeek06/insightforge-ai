const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type ColumnProfile = {
  name: string;
  dtype: string;
  null_count: number;
  unique_count: number;
  min_value: string | number | null;
  max_value: string | number | null;
  semantic_role: string;
};

export type DatasetProfile = {
  dataset_id: string;
  filename: string;
  rows: number;
  columns: number;
  missing_values: number;
  duplicate_rows: number;
  columns_profile: ColumnProfile[];
};

export async function uploadDataset(file: File): Promise<{ dataset_id: string; filename: string }> {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(`${API_URL}/api/datasets/upload`, { method: "POST", body: form });
  if (!response.ok) throw new Error((await response.json()).detail ?? "Upload failed");
  return response.json();
}

export async function getDatasetProfile(datasetId: string): Promise<DatasetProfile> {
  const response = await fetch(`${API_URL}/api/datasets/${datasetId}/profile`, { cache: "no-store" });
  if (!response.ok) throw new Error((await response.json()).detail ?? "Profiling failed");
  return response.json();
}
