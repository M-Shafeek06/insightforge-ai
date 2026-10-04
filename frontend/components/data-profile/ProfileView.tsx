"use client";

import { useState } from "react";
import { getDatasetProfile, uploadDataset, type DatasetProfile } from "@/lib/api/datasets";

export default function ProfileView() {
  const [profile, setProfile] = useState<DatasetProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const uploaded = await uploadDataset(file);
      const result = await getDatasetProfile(uploaded.dataset_id);
      setProfile(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#080b12] px-6 py-12 text-white md:px-12">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10">
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.25em] text-cyan-400">InsightForge AI</p>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">Data Intelligence</h1>
          <p className="mt-3 max-w-2xl text-slate-400">Upload a CSV or XLSX file and let the analytics engine profile its structure, quality, and semantic roles.</p>
        </div>

        <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-900/60 px-6 py-16 text-center transition hover:border-cyan-500 hover:bg-slate-900">
          <span className="text-lg font-semibold">Drop your business dataset here</span>
          <span className="mt-2 text-sm text-slate-500">CSV or XLSX · up to 50 MB</span>
          <span className="mt-6 rounded-lg bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-slate-950">Choose file</span>
          <input className="hidden" type="file" accept=".csv,.xlsx" onChange={(event) => handleFile(event.target.files?.[0])} />
        </label>

        {loading && <p className="mt-6 text-sm text-cyan-300">Uploading and profiling dataset…</p>}
        {error && <p className="mt-6 rounded-lg border border-red-900 bg-red-950/30 p-4 text-sm text-red-300">{error}</p>}

        {profile && (
          <section className="mt-10 space-y-6">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
              <div>
                <p className="text-sm text-slate-500">Profiled dataset</p>
                <h2 className="text-2xl font-semibold">{profile.filename}</h2>
              </div>
              <p className="font-mono text-xs text-slate-600">{profile.dataset_id}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Rows", profile.rows.toLocaleString()],
                ["Columns", profile.columns.toLocaleString()],
                ["Missing values", profile.missing_values.toLocaleString()],
                ["Duplicate rows", profile.duplicate_rows.toLocaleString()],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-slate-800 bg-slate-900 p-5">
                  <p className="text-sm text-slate-500">{label}</p>
                  <p className="mt-2 text-2xl font-bold">{value}</p>
                </div>
              ))}
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
              <div className="border-b border-slate-800 px-5 py-4 font-semibold">Column intelligence</div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] text-left text-sm">
                  <thead className="bg-slate-950/60 text-slate-400">
                    <tr>
                      <th className="px-5 py-3">Column</th><th className="px-5 py-3">Type</th><th className="px-5 py-3">Semantic role</th><th className="px-5 py-3">Nulls</th><th className="px-5 py-3">Unique</th><th className="px-5 py-3">Range</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profile.columns_profile.map((column) => (
                      <tr key={column.name} className="border-t border-slate-800">
                        <td className="px-5 py-4 font-medium">{column.name}</td>
                        <td className="px-5 py-4 font-mono text-xs text-slate-400">{column.dtype}</td>
                        <td className="px-5 py-4"><span className="rounded-full bg-cyan-400/10 px-2.5 py-1 text-xs font-medium text-cyan-300">{column.semantic_role}</span></td>
                        <td className="px-5 py-4">{column.null_count.toLocaleString()}</td>
                        <td className="px-5 py-4">{column.unique_count.toLocaleString()}</td>
                        <td className="px-5 py-4 text-slate-400">{column.min_value ?? "—"} → {column.max_value ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
