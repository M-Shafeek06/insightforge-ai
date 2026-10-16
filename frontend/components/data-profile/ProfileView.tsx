"use client";

import { useEffect, useState, type FormEvent } from "react";
import ThemeToggle from "@/components/theme/ThemeToggle";
import AnalyticsExecutionPanel from "@/components/analytics/AnalyticsExecutionPanel";
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
import {
  createAnalysisPlan,
  type AnalysisPlan,
  type AnalysisQualityWarning,
} from "@/lib/api/analysis";

const ACTIVE_DATASET_KEY = "insightforge-active-dataset";

function getStatusStyle(status: string): string {
  switch (status.toLowerCase()) {
    case "excellent":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    case "good":
      return "border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-300";
    case "fair":
      return "border-yellow-500/40 bg-yellow-500/10 text-yellow-800 dark:text-yellow-300";
    case "poor":
      return "border-orange-500/40 bg-orange-500/10 text-orange-800 dark:text-orange-300";
    case "critical":
      return "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300";
    default:
      return "border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--foreground)]";
  }
}

function getSeverityStyle(severity: string): string {
  switch (severity.toLowerCase()) {
    case "critical":
      return "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300";
    case "high":
      return "border-orange-500/40 bg-orange-500/10 text-orange-800 dark:text-orange-300";
    case "medium":
      return "border-yellow-500/40 bg-yellow-500/10 text-yellow-800 dark:text-yellow-300";
    case "low":
      return "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300";
    default:
      return "border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--foreground)]";
  }
}

function QualityIssueCard({ issue }: { issue: QualityIssue }) {
  return (
    <article className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-5 transition-colors duration-200">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase ${getSeverityStyle(issue.severity)}`}
            >
              {issue.severity}
            </span>

            <span className="text-xs text-[var(--foreground-secondary)]">
              {issue.issue_type.replaceAll("_", " ")}
            </span>
          </div>

          <h4 className="mt-3 text-base font-semibold text-[var(--foreground)]">
            {issue.column ?? "Dataset"}
          </h4>

          <p className="mt-2 text-sm leading-6 text-[var(--foreground-secondary)]">
            {issue.message}
          </p>
        </div>

        <div className="shrink-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 sm:text-right">
          <p className="text-lg font-semibold text-[var(--foreground)]">
            {issue.affected_rows.toLocaleString()}
          </p>

          <p className="text-xs text-[var(--foreground-secondary)]">
            Affected rows
          </p>

          <p className="mt-1 text-xs text-[var(--foreground-secondary)]">
            {issue.affected_percentage.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            })}
            %
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-cyan-700 dark:text-cyan-400">
          Recommended action
        </p>

        <p className="mt-2 text-sm leading-6 text-[var(--foreground)]">
          {issue.recommendation}
        </p>
      </div>
    </article>
  );
}

function AnalysisQualityWarningCard({
  warning,
}: {
  warning: AnalysisQualityWarning;
}) {
  return (
    <article className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase ${getSeverityStyle(warning.severity)}`}
        >
          {warning.severity}
        </span>

        <span className="text-xs text-[var(--foreground-secondary)]">
          {warning.issue_type.replaceAll("_", " ")}
        </span>
      </div>

      <h4 className="mt-3 font-semibold">
        {warning.column ?? "Dataset"}
      </h4>

      <p className="mt-2 text-sm leading-6 text-[var(--foreground-secondary)]">
        {warning.message}
      </p>

      <div className="mt-3 rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-cyan-700 dark:text-cyan-400">
          Recommendation
        </p>

        <p className="mt-1 text-sm leading-6">
          {warning.recommendation}
        </p>
      </div>
    </article>
  );
}

function AnalysisPlanResults({ plan }: { plan: AnalysisPlan }) {
  const feasibilityLabel = plan.feasibility_status.replaceAll("_", " ");

  return (
    <div className="mt-6 space-y-6">
      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--foreground-secondary)]">
              Feasibility assessment
            </p>

            <h4 className="mt-2 text-xl font-semibold capitalize">
              {feasibilityLabel}
            </h4>

            <p className="mt-2 text-sm leading-6 text-[var(--foreground-secondary)]">
              {plan.feasibility_reason}
            </p>
          </div>

          <span
            className={`inline-flex w-fit rounded-full border px-3 py-1.5 text-xs font-semibold uppercase ${getStatusStyle(
              plan.feasibility_status === "feasible"
                ? "good"
                : plan.feasibility_status === "partially_feasible"
                  ? "fair"
                  : "poor"
            )}`}
          >
            {feasibilityLabel}
          </span>
        </div>
      </section>

      <section>
        <div className="mb-4">
          <h4 className="text-lg font-semibold">Recommended KPIs</h4>
          <p className="mt-1 text-sm text-[var(--foreground-secondary)]">
            Suggested business metrics based on the available dataset columns.
          </p>
        </div>

        {plan.recommended_kpis.length === 0 ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-5 text-sm text-[var(--foreground-secondary)]">
            No suitable KPI recommendations were identified for this dataset.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {plan.recommended_kpis.map((kpi, index) => (
              <article
                key={`${kpi.name}-${index}`}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"
              >
                <h5 className="font-semibold">{kpi.name}</h5>

                <p className="mt-2 text-sm leading-6 text-[var(--foreground-secondary)]">
                  {kpi.description}
                </p>

                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--foreground-secondary)]">
                    Calculation definition
                  </p>

                  <code className="mt-2 block break-all rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] p-3 text-sm">
                    {kpi.calculation}
                  </code>
                </div>

                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--foreground-secondary)]">
                    Required columns
                  </p>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {kpi.required_columns.map((column) => (
                      <span
                        key={column}
                        className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs"
                      >
                        {column}
                      </span>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-4">
          <h4 className="text-lg font-semibold">Recommended Analyses</h4>
          <p className="mt-1 text-sm text-[var(--foreground-secondary)]">
            Proposed analytical methods. These analyses have not been executed.
          </p>
        </div>

        {plan.recommended_analyses.length === 0 ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-5 text-sm text-[var(--foreground-secondary)]">
            No suitable analysis methods were identified.
          </div>
        ) : (
          <div className="space-y-4">
            {plan.recommended_analyses.map((analysis, index) => (
              <article
                key={`${analysis.name}-${index}`}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"
              >
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div>
                    <h5 className="font-semibold">{analysis.name}</h5>

                    <p className="mt-2 text-sm leading-6 text-[var(--foreground-secondary)]">
                      {analysis.description}
                    </p>
                  </div>

                  <span className="inline-flex w-fit rounded-full border border-cyan-500/30 bg-cyan-500/5 px-3 py-1 text-xs font-medium text-cyan-700 dark:text-cyan-300">
                    {analysis.analysis_method}
                  </span>
                </div>

                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--foreground-secondary)]">
                    Required columns
                  </p>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {analysis.required_columns.map((column) => (
                      <span
                        key={column}
                        className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs"
                      >
                        {column}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--foreground-secondary)]">
                    Business value
                  </p>

                  <p className="mt-2 text-sm leading-6">
                    {analysis.business_value}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-4">
          <h4 className="text-lg font-semibold">Available Columns</h4>
          <p className="mt-1 text-sm text-[var(--foreground-secondary)]">
            Columns detected by the analysis planner.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {plan.available_columns.map((column) => (
            <span
              key={column}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-2 text-sm"
            >
              {column}
            </span>
          ))}
        </div>
      </section>

      {plan.missing_required_columns.length > 0 && (
        <section className="rounded-xl border border-orange-500/40 bg-orange-500/5 p-5">
          <h4 className="font-semibold">Missing Required Columns</h4>

          <p className="mt-2 text-sm text-[var(--foreground-secondary)]">
            Some recommended analyses require columns that are not available.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {plan.missing_required_columns.map((column) => (
              <span
                key={column}
                className="rounded-full border border-orange-500/40 px-3 py-1 text-xs"
              >
                {column}
              </span>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-4">
          <h4 className="text-lg font-semibold">Analysis Quality Warnings</h4>

          <p className="mt-1 text-sm text-[var(--foreground-secondary)]">
            Existing data-quality findings that should be considered before
            executing the recommended analyses.
          </p>
        </div>

        {plan.quality_warnings.length === 0 ? (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-5 text-sm text-[var(--foreground-secondary)]">
            No quality warnings were returned by the current quality checks.
          </div>
        ) : (
          <div className="space-y-4">
            {plan.quality_warnings.map((warning, index) => (
              <AnalysisQualityWarningCard
                key={`${warning.issue_type}-${warning.column ?? "dataset"}-${index}`}
                warning={warning}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default function ProfileView() {
  const [profile, setProfile] = useState<DatasetProfile | null>(null);
  const [quality, setQuality] = useState<DatasetQuality | null>(null);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qualityError, setQualityError] = useState<string | null>(null);

  const [businessObjective, setBusinessObjective] = useState("");
  const [businessQuestions, setBusinessQuestions] = useState<string[]>([""]);
  const [analysisPlan, setAnalysisPlan] = useState<AnalysisPlan | null>(null);
  const [planning, setPlanning] = useState(false);
  const [planningError, setPlanningError] = useState<string | null>(null);

  async function loadDataset(datasetId: string) {
    setLoading(true);
    setError(null);
    setQualityError(null);
    setPlanningError(null);
    setProfile(null);
    setQuality(null);
    setAnalysisPlan(null);
    setBusinessObjective("");
    setBusinessQuestions([""]);

    try {
      const result = await getDatasetProfile(datasetId);
      setProfile(result);

      try {
        const qualityResult = await getDatasetQuality(datasetId);
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
        err instanceof Error
          ? err.message
          : "Unable to restore the saved dataset."
      );

      window.sessionStorage.removeItem(ACTIVE_DATASET_KEY);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function restoreDataset() {
      try {
        const savedDatasetId = window.sessionStorage.getItem(
          ACTIVE_DATASET_KEY
        );

        if (!savedDatasetId || cancelled) {
          return;
        }

        await loadDataset(savedDatasetId);
      } finally {
        if (!cancelled) {
          setRestoring(false);
        }
      }
    }

    void restoreDataset();

    return () => {
      cancelled = true;
    };
  }, []);


  async function handleFile(file: File | undefined) {
    if (!file) return;

    setLoading(true);
    setError(null);
    setQualityError(null);
    setPlanningError(null);
    setProfile(null);
    setQuality(null);
    setAnalysisPlan(null);
    setBusinessObjective("");
    setBusinessQuestions([""]);

    try {
      const uploaded = await uploadDataset(file);

      window.sessionStorage.setItem(
        ACTIVE_DATASET_KEY,
        uploaded.dataset_id
      );

      const result = await getDatasetProfile(uploaded.dataset_id);
      setProfile(result);

      try {
        const qualityResult = await getDatasetQuality(
          uploaded.dataset_id
        );
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
        err instanceof Error
          ? err.message
          : "Something went wrong while processing the dataset."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateAnalysisPlan(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!profile) return;

    const objective = businessObjective.trim();

    if (objective.length < 5) {
      setPlanningError(
        "Enter a business objective containing at least 5 characters."
      );
      return;
    }

    if (objective.length > 1000) {
      setPlanningError(
        "The business objective cannot exceed 1,000 characters."
      );
      return;
    }

    const questions = businessQuestions
      .map((question) => question.trim())
      .filter(Boolean);

    if (questions.length > 20) {
      setPlanningError("You can submit a maximum of 20 business questions.");
      return;
    }

    setPlanning(true);
    setPlanningError(null);
    setAnalysisPlan(null);

    try {
      const result = await createAnalysisPlan(profile.dataset_id, {
        business_objective: objective,
        business_questions: questions,
      });

      setAnalysisPlan(result);
    } catch (err) {
      setPlanningError(
        err instanceof Error
          ? err.message
          : "Unable to generate the analysis plan."
      );
    } finally {
      setPlanning(false);
    }
  }

  function updateBusinessQuestion(index: number, value: string) {
    setBusinessQuestions((current) =>
      current.map((question, currentIndex) =>
        currentIndex === index ? value : question
      )
    );
  }

  function addBusinessQuestion() {
    setBusinessQuestions((current) => {
      if (current.length >= 20) {
        return current;
      }

      return [...current, ""];
    });
  }

  function removeBusinessQuestion(index: number) {
    setBusinessQuestions((current) => {
      const updated = current.filter(
        (_, currentIndex) => currentIndex !== index
      );

      return updated.length > 0 ? updated : [""];
    });
  }

  const isInitializing = restoring && !profile && !error;

  return (
    <main className="min-h-screen bg-[var(--background)] px-6 py-12 text-[var(--foreground)] transition-colors duration-200 md:px-12">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
            <div>
              <p className="mb-2 text-sm font-semibold uppercase tracking-[0.25em] text-cyan-700 dark:text-cyan-400">
                InsightForge AI
              </p>

              <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
                Data Intelligence
              </h1>

              <p className="mt-3 max-w-2xl text-[var(--foreground-secondary)]">
                Understand your business data through dataset profiling,
                deterministic quality assessment, and actionable
                recommendations.
              </p>
            </div>

            <ThemeToggle />
          </div>
        </header>

        {isInitializing && (
          <div
            role="status"
            className="mb-6 rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-4 text-sm text-[var(--foreground-secondary)]"
          >
            Checking for your current session dataset...
          </div>
        )}

        <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-secondary)] px-6 py-16 text-center transition-colors hover:border-cyan-500">
          <span className="text-lg font-semibold">
            Upload your business dataset
          </span>

          <span className="mt-2 text-sm text-[var(--foreground-secondary)]">
            CSV or XLSX — up to 50 MB
          </span>

          <span className="mt-6 rounded-lg bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-slate-950">
            Choose file
          </span>

          <input
            className="hidden"
            type="file"
            accept=".csv,.xlsx"
            disabled={loading || restoring}
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
            className="mt-6 rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-4 text-sm text-cyan-700 dark:text-cyan-300"
          >
            {profile
              ? "Refreshing dataset quality assessment..."
              : "Uploading or restoring dataset, generating its profile, and assessing data quality..."}
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mt-6 rounded-lg border border-red-500/40 bg-red-500/5 p-4 text-sm text-red-700 dark:text-red-300"
          >
            <p className="font-semibold">Dataset unavailable</p>
            <p className="mt-1">{error}</p>
            <p className="mt-2 text-sm">
              Upload the dataset again to start a new analysis.
            </p>
          </div>
        )}

        {profile && (
          <section className="mt-10 space-y-8">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
              <div>
                <p className="text-sm text-[var(--foreground-secondary)]">
                  Analyzed dataset
                </p>

                <h2 className="mt-1 text-2xl font-semibold">
                  {profile.filename}
                </h2>
              </div>

              <p className="break-all font-mono text-xs text-[var(--foreground-secondary)]">
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
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 transition-colors duration-200"
                  >
                    <p className="text-sm text-[var(--foreground-secondary)]">
                      {label}
                    </p>
                    <p className="mt-2 text-2xl font-bold">{value}</p>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <div className="mb-4">
                <h3 className="text-xl font-semibold">Data Quality</h3>
                <p className="mt-1 text-sm text-[var(--foreground-secondary)]">
                  Deterministic quality checks and explainable findings.
                </p>
              </div>

              {qualityError && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-500/40 bg-red-500/5 p-5"
                >
                  <p className="font-medium text-red-700 dark:text-red-300">
                    Quality assessment unavailable
                  </p>
                  <p className="mt-2 text-sm text-[var(--foreground-secondary)]">
                    {qualityError}
                  </p>
                  <p className="mt-2 text-xs text-[var(--foreground-secondary)]">
                    Dataset profiling succeeded. You can continue reviewing
                    the profile while investigating the quality API error.
                  </p>
                </div>
              )}

              {quality && (
                <div className="space-y-5">
                  <div className="grid gap-5 lg:grid-cols-[1fr_2fr]">
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 transition-colors duration-200">
                      <p className="text-sm text-[var(--foreground-secondary)]">
                        Overall quality score
                      </p>

                      <div className="mt-4 flex items-end gap-2">
                        <span className="text-5xl font-bold tracking-tight">
                          {quality.overall_score}
                        </span>
                        <span className="pb-1 text-lg text-[var(--foreground-secondary)]">
                          / 100
                        </span>
                      </div>

                      <div
                        className="mt-5 h-2.5 overflow-hidden rounded-full bg-[var(--border)]"
                        role="progressbar"
                        aria-label="Data quality score"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={quality.overall_score}
                      >
                        <div
                          className="h-full rounded-full bg-cyan-500 transition-all dark:bg-cyan-400"
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

                      <p className="mt-4 text-sm leading-6 text-[var(--foreground-secondary)]">
                        This score reflects the issues detected by the
                        current deterministic quality rules. It does not
                        modify your original dataset.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 transition-colors duration-200">
                      <h4 className="font-semibold">Issue Breakdown</h4>

                      <p className="mt-1 text-sm text-[var(--foreground-secondary)]">
                        {quality.summary.total_issues} detected issue(s)
                      </p>

                      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {[
                          {
                            label: "Critical",
                            count: quality.summary.critical,
                            style:
                              "border-red-500/40 text-red-700 dark:text-red-300",
                          },
                          {
                            label: "High",
                            count: quality.summary.high,
                            style:
                              "border-orange-500/40 text-orange-800 dark:text-orange-300",
                          },
                          {
                            label: "Medium",
                            count: quality.summary.medium,
                            style:
                              "border-yellow-500/40 text-yellow-800 dark:text-yellow-300",
                          },
                          {
                            label: "Low",
                            count: quality.summary.low,
                            style:
                              "border-blue-500/40 text-blue-700 dark:text-blue-300",
                          },
                        ].map((item) => (
                          <div
                            key={item.label}
                            className={`rounded-xl border bg-[var(--surface-secondary)] p-4 ${item.style}`}
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

                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 transition-colors duration-200 sm:p-6">
                    <div className="mb-5">
                      <h4 className="text-lg font-semibold">
                        Quality Issues & Recommended Actions
                      </h4>
                      <p className="mt-1 text-sm text-[var(--foreground-secondary)]">
                        Review each finding before deciding whether any
                        cleaning is appropriate.
                      </p>
                    </div>

                    {quality.issues.length === 0 ? (
                      <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-6">
                        <p className="font-medium text-emerald-700 dark:text-emerald-300">
                          No issues detected
                        </p>
                        <p className="mt-2 text-sm text-[var(--foreground-secondary)]">
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

            <section
              aria-labelledby="analysis-planner-heading"
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-7"
            >
            <AnalyticsExecutionPanel profile={profile} />
              <div className="mb-6">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-400">
                  Stage 9 · Analysis Planning
                </p>

                <h3
                  id="analysis-planner-heading"
                  className="mt-2 text-2xl font-semibold"
                >
                  Business Analysis Planner
                </h3>

                <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--foreground-secondary)]">
                  Describe the business outcome you want to investigate.
                  InsightForge AI will inspect the available columns and
                  recommend relevant KPIs and analytical methods.
                </p>
              </div>

              <form
                onSubmit={handleCreateAnalysisPlan}
                className="space-y-6"
              >
                <div>
                  <label
                    htmlFor="business-objective"
                    className="mb-2 block text-sm font-semibold"
                  >
                    Business objective
                    <span className="ml-1 text-red-500">*</span>
                  </label>

                  <textarea
                    id="business-objective"
                    value={businessObjective}
                    onChange={(event) =>
                      setBusinessObjective(event.target.value)
                    }
                    minLength={5}
                    maxLength={1000}
                    required
                    rows={3}
                    placeholder="Example: Analyze monthly sales and profit performance."
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] px-4 py-3 text-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                  />

                  <p className="mt-2 text-xs text-[var(--foreground-secondary)]">
                    {businessObjective.length}/1000 characters. Minimum 5.
                  </p>
                </div>

                <div>
                  <div className="mb-3 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                    <div>
                      <h4 className="text-sm font-semibold">
                        Business questions
                      </h4>

                      <p className="mt-1 text-xs text-[var(--foreground-secondary)]">
                        Optional. Add up to 20 questions you want to investigate.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={addBusinessQuestion}
                      disabled={planning || businessQuestions.length >= 20}
                      className="w-fit rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium transition hover:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      + Add question
                    </button>
                  </div>

                  <div className="space-y-3">
                    {businessQuestions.map((question, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-2"
                      >
                        <label
                          htmlFor={`business-question-${index}`}
                          className="sr-only"
                        >
                          Business question {index + 1}
                        </label>

                        <input
                          id={`business-question-${index}`}
                          type="text"
                          maxLength={1000}
                          value={question}
                          onChange={(event) =>
                            updateBusinessQuestion(index, event.target.value)
                          }
                          disabled={planning}
                          placeholder={`Question ${index + 1}, e.g. Which region generates the most sales?`}
                          className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-2.5 text-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                        />

                        {businessQuestions.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeBusinessQuestion(index)}
                            disabled={planning}
                            aria-label={`Remove business question ${index + 1}`}
                            className="rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm transition hover:border-red-500 hover:text-red-600 disabled:opacity-50"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {planningError && (
                  <div
                    role="alert"
                    className="rounded-xl border border-red-500/40 bg-red-500/5 p-4 text-sm text-red-700 dark:text-red-300"
                  >
                    <p className="font-semibold">
                      Unable to generate analysis plan
                    </p>
                    <p className="mt-1">{planningError}</p>
                  </div>
                )}

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="max-w-xl text-xs leading-5 text-[var(--foreground-secondary)]">
                    Planning is deterministic. Recommendations are not
                    executed calculations, and your original dataset will
                    not be modified.
                  </p>

                  <button
                    type="submit"
                    disabled={planning || loading || !businessObjective.trim()}
                    className="inline-flex shrink-0 items-center justify-center rounded-lg bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {planning
                      ? "Generating plan..."
                      : "Generate Analysis Plan"}
                  </button>
                </div>
              </form>

              {planning && (
                <div
                  role="status"
                  className="mt-6 rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-4 text-sm text-[var(--foreground-secondary)]"
                >
                  Inspecting dataset columns and generating deterministic
                  recommendations...
                </div>
              )}

              {analysisPlan && (
                <div className="mt-8 border-t border-[var(--border)] pt-8">
                  <div className="mb-6">
                    <h4 className="text-xl font-semibold">
                      Analysis Plan Results
                    </h4>

                    <p className="mt-2 text-sm text-[var(--foreground-secondary)]">
                      Recommendations for: {analysisPlan.business_objective}
                    </p>
                  </div>

                  <AnalysisPlanResults plan={analysisPlan} />
                </div>
              )}
            </section>

            <section>
              <div className="mb-4">
                <h3 className="text-xl font-semibold">
                  Column Intelligence
                </h3>
                <p className="mt-1 text-sm text-[var(--foreground-secondary)]">
                  Column types, semantic roles, missing values, uniqueness,
                  and value ranges.
                </p>
              </div>

              <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[800px] text-left text-sm">
                    <thead className="bg-[var(--surface-secondary)] text-[var(--foreground-secondary)]">
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
                          className="border-t border-[var(--border)]"
                        >
                          <td className="px-5 py-4 font-medium">
                            {column.name}
                          </td>

                          <td className="px-5 py-4 font-mono text-xs text-[var(--foreground-secondary)]">
                            {column.dtype}
                          </td>

                          <td className="px-5 py-4">
                            <span className="rounded-full bg-cyan-500/10 px-2.5 py-1 text-xs font-medium text-cyan-700 dark:text-cyan-300">
                              {column.semantic_role}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            {column.null_count.toLocaleString()}
                          </td>

                          <td className="px-5 py-4">
                            {column.unique_count.toLocaleString()}
                          </td>

                          <td className="px-5 py-4 text-[var(--foreground-secondary)]">
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