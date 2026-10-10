"use client";

import { useState } from "react";
import {
getDatasetProfile,
uploadDataset,
type DatasetProfile,
} from "@/lib/api/datasets";
import {
getDatasetQuality,
type DatasetQuality,
type QualityIssue,
} from "@/lib/api/quality";

function getStatusStyle(status: string) {
switch (status.toLowerCase()) {
case "excellent":
return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
case "good":
return "border-green-500/30 bg-green-500/10 text-green-300";
case "fair":
return "border-yellow-500/30 bg-yellow-500/10 text-yellow-300";
case "poor":
return "border-orange-500/30 bg-orange-500/10 text-orange-300";
case "critical":
return "border-red-500/30 bg-red-500/10 text-red-300";
default:
return "border-slate-700 bg-slate-800 text-slate-300";
}
}

function getSeverityStyle(severity: string) {
switch (severity.toLowerCase()) {
case "critical":
return "bg-red-500/10 text-red-300 border-red-500/30";
case "high":
return "bg-orange-500/10 text-orange-300 border-orange-500/30";
case "medium":
return "bg-yellow-500/10 text-yellow-300 border-yellow-500/30";
case "low":
return "bg-blue-500/10 text-blue-300 border-blue-500/30";
default:
return "bg-slate-800 text-slate-300 border-slate-700";
}
}

function QualityIssueCard({ issue }: { issue: QualityIssue }) {
return ( <article className="rounded-xl border border-slate-800 bg-slate-950/50 p-5"> <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"> <div> <div className="flex flex-wrap items-center gap-2">
<span
className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase ${getSeverityStyle(issue.severity)}`}
>
{issue.severity} </span>


        <span className="text-xs text-slate-500">
          {issue.issue_type.replaceAll("_", " ")}
        </span>
      </div>

      <h4 className="mt-3 text-base font-semibold text-white">
        {issue.column ?? "Dataset"}
      </h4>

      <p className="mt-2 text-sm leading-6 text-slate-400">
        {issue.message}
      </p>
    </div>

    <div className="shrink-0 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 sm:text-right">
      <p className="text-lg font-semibold text-white">
        {issue.affected_rows.toLocaleString()}
      </p>
      <p className="text-xs text-slate-500">Affected rows</p>
      <p className="mt-1 text-xs text-slate-400">
        {issue.affected_percentage.toLocaleString(undefined, {
          maximumFractionDigits: 2,
        })}
        %
      </p>
    </div>
  </div>

  <div className="mt-4 rounded-lg border border-cyan-900/50 bg-cyan-950/20 p-4">
    <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
      Recommended action
    </p>
    <p className="mt-2 text-sm leading-6 text-slate-300">
      {issue.recommendation}
    </p>
  </div>
</article>

);
}

export default function ProfileView() {
const [profile, setProfile] = useState<DatasetProfile | null>(null);
const [quality, setQuality] = useState<DatasetQuality | null>(null);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
const [qualityError, setQualityError] = useState<string | null>(null);

async function handleFile(file: File | undefined) {
if (!file) return;

setLoading(true);
setError(null);
setQualityError(null);
setProfile(null);
setQuality(null);

try {
  const uploaded = await uploadDataset(file);
  const result = await getDatasetProfile(uploaded.dataset_id);

  setProfile(result);

  try {
    const qualityResult = await getDatasetQuality(uploaded.dataset_id);
    setQuality(qualityResult);
  } catch (err) {
    setQualityError(
      err instanceof Error
        ? err.message
        : "Unable to assess dataset quality."
    );
  }
} catch (err) {
  setError(
    err instanceof Error ? err.message : "Something went wrong."
  );
} finally {
  setLoading(false);
}
}

return ( <main className="min-h-screen bg-[#080b12] px-6 py-12 text-white md:px-12"> <div className="mx-auto max-w-6xl"> <header className="mb-10"> <p className="mb-2 text-sm font-semibold uppercase tracking-[0.25em] text-cyan-400">
InsightForge AI </p>
      <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
        Data Intelligence
      </h1>

      <p className="mt-3 max-w-2xl text-slate-400">
        Understand your business data through dataset profiling,
        deterministic quality assessment, and actionable recommendations.
      </p>
    </header>

    <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-900/60 px-6 py-16 text-center transition hover:border-cyan-500 hover:bg-slate-900">
      <span className="text-lg font-semibold">
        Upload your business dataset
      </span>

      <span className="mt-2 text-sm text-slate-500">
        CSV or XLSX — up to 50 MB
      </span>

      <span className="mt-6 rounded-lg bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-slate-950">
        Choose file
      </span>

      <input
        className="hidden"
        type="file"
        accept=".csv,.xlsx"
        disabled={loading}
        onChange={(event) => {
          const file = event.target.files?.[0];
          void handleFile(file);
          event.currentTarget.value = "";
        }}
      />
    </label>

    {loading && (
      <div
        role="status"
        className="mt-6 rounded-lg border border-cyan-900 bg-cyan-950/20 p-4 text-sm text-cyan-300"
      >
        Uploading dataset, generating its profile, and assessing data
        quality...
      </div>
    )}

    {error && (
      <div
        role="alert"
        className="mt-6 rounded-lg border border-red-900 bg-red-950/30 p-4 text-sm text-red-300"
      >
        {error}
      </div>
    )}

    {profile && (
      <section className="mt-10 space-y-8">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <p className="text-sm text-slate-500">Analyzed dataset</p>
            <h2 className="mt-1 text-2xl font-semibold">
              {profile.filename}
            </h2>
          </div>

          <p className="break-all font-mono text-xs text-slate-600">
            Dataset ID: {profile.dataset_id}
          </p>
        </div>

        <section>
          <h3 className="mb-4 text-xl font-semibold">
            Dataset Overview
          </h3>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Rows", profile.rows.toLocaleString()],
              ["Columns", profile.columns.toLocaleString()],
              ["Missing values", profile.missing_values.toLocaleString()],
              ["Duplicate rows", profile.duplicate_rows.toLocaleString()],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-slate-800 bg-slate-900 p-5"
              >
                <p className="text-sm text-slate-500">{label}</p>
                <p className="mt-2 text-2xl font-bold">{value}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-4">
            <h3 className="text-xl font-semibold">Data Quality</h3>
            <p className="mt-1 text-sm text-slate-500">
              Deterministic quality checks and explainable findings.
            </p>
          </div>

          {qualityError && (
            <div
              role="alert"
              className="rounded-xl border border-red-900 bg-red-950/30 p-5"
            >
              <p className="font-medium text-red-300">
                Quality assessment unavailable
              </p>
              <p className="mt-2 text-sm text-slate-400">
                {qualityError}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Dataset profiling succeeded. You can continue reviewing
                the profile while investigating the quality API error.
              </p>
            </div>
          )}

          {quality && (
            <div className="space-y-5">
              <div className="grid gap-5 lg:grid-cols-[1fr_2fr]">
                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
                  <p className="text-sm text-slate-400">
                    Overall quality score
                  </p>

                  <div className="mt-4 flex items-end gap-2">
                    <span className="text-5xl font-bold tracking-tight">
                      {quality.overall_score}
                    </span>
                    <span className="pb-1 text-lg text-slate-500">
                      / 100
                    </span>
                  </div>

                  <div
                    className="mt-5 h-2.5 overflow-hidden rounded-full bg-slate-800"
                    role="progressbar"
                    aria-label="Data quality score"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={quality.overall_score}
                  >
                    <div
                      className="h-full rounded-full bg-cyan-400 transition-all"
                      style={{
                        width: `${quality.overall_score}%`,
                      }}
                    />
                  </div>

                  <span
                    className={`mt-4 inline-flex rounded-full border px-3 py-1.5 text-sm font-semibold ${getStatusStyle(quality.quality_status)}`}
                  >
                    {quality.quality_status}
                  </span>

                  <p className="mt-4 text-sm leading-6 text-slate-400">
                    This score reflects the issues detected by the current
                    deterministic quality rules. It does not modify your
                    original dataset.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
                  <h4 className="font-semibold">Issue Breakdown</h4>

                  <p className="mt-1 text-sm text-slate-500">
                    {quality.summary.total_issues} detected issue(s)
                  </p>

                  <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      {
                        label: "Critical",
                        count: quality.summary.critical,
                        style: "border-red-900/70 text-red-300",
                      },
                      {
                        label: "High",
                        count: quality.summary.high,
                        style: "border-orange-900/70 text-orange-300",
                      },
                      {
                        label: "Medium",
                        count: quality.summary.medium,
                        style: "border-yellow-900/70 text-yellow-300",
                      },
                      {
                        label: "Low",
                        count: quality.summary.low,
                        style: "border-blue-900/70 text-blue-300",
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className={`rounded-xl border bg-slate-950/50 p-4 ${item.style}`}
                      >
                        <p className="text-sm">{item.label}</p>
                        <p className="mt-2 text-2xl font-bold">
                          {item.count}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
                <div className="mb-5">
                  <h4 className="text-lg font-semibold">
                    Quality Issues & Recommended Actions
                  </h4>
                  <p className="mt-1 text-sm text-slate-500">
                    Review each finding before deciding whether any
                    cleaning is appropriate.
                  </p>
                </div>

                {quality.issues.length === 0 ? (
                  <div className="rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-6">
                    <p className="font-medium text-emerald-300">
                      No issues detected
                    </p>
                    <p className="mt-2 text-sm text-slate-400">
                      The current quality checks did not identify any
                      issues in this dataset.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {quality.issues.map((issue, index) => (
                      <QualityIssueCard
                        key={`${issue.issue_type}-${issue.column ?? "dataset"}-${index}`}
                        issue={issue}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        <section>
          <div className="mb-4">
            <h3 className="text-xl font-semibold">
              Column Intelligence
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Column types, semantic roles, missing values, uniqueness,
              and value ranges.
            </p>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead className="bg-slate-950/60 text-slate-400">
                  <tr>
                    <th className="px-5 py-3">Column</th>
                    <th className="px-5 py-3">Type</th>
                    <th className="px-5 py-3">Semantic role</th>
                    <th className="px-5 py-3">Nulls</th>
                    <th className="px-5 py-3">Unique</th>
                    <th className="px-5 py-3">Range</th>
                  </tr>
                </thead>

                <tbody>
                  {profile.columns_profile.map((column) => (
                    <tr
                      key={column.name}
                      className="border-t border-slate-800"
                    >
                      <td className="px-5 py-4 font-medium">
                        {column.name}
                      </td>

                      <td className="px-5 py-4 font-mono text-xs text-slate-400">
                        {column.dtype}
                      </td>

                      <td className="px-5 py-4">
                        <span className="rounded-full bg-cyan-400/10 px-2.5 py-1 text-xs font-medium text-cyan-300">
                          {column.semantic_role}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        {column.null_count.toLocaleString()}
                      </td>

                      <td className="px-5 py-4">
                        {column.unique_count.toLocaleString()}
                      </td>

                      <td className="px-5 py-4 text-slate-400">
                        {column.min_value ?? "—"} →{" "}
                        {column.max_value ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </section>
    )}
  </div>
</main>
);
}