"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import ThemeToggle from "@/components/theme/ThemeToggle";
import AnalyticsExecutionPanel, {
  type AnalysisConfigurationRequest,
} from "@/components/analytics/AnalyticsExecutionPanel";
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
const PENDING_BROWSER_REFRESH_KEY = "insightforge-pending-browser-refresh";

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

function AnalysisPlanResults({
  plan,
  onConfigureAnalysis,
}: {
  plan: AnalysisPlan;
  onConfigureAnalysis: (
    analysis: AnalysisPlan["recommended_analyses"][number]
  ) => void;
}) {
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

                <div className="mt-5">
                  <button
                    type="button"
                    onClick={() => onConfigureAnalysis(analysis)}
                    className="inline-flex items-center justify-center rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                  >
                    Configure Analysis
                  </button>
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
  const [requestedAnalysis, setRequestedAnalysis] =
    useState<AnalysisConfigurationRequest | null>(null);

  // Refresh confirmation state.
  const [refreshDialogOpen, setRefreshDialogOpen] = useState(false);
  const [refreshingWorkspace, setRefreshingWorkspace] = useState(false);
  const refreshCancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!refreshDialogOpen) return;

    refreshCancelButtonRef.current?.focus();

    function handleDialogKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !refreshingWorkspace) {
        event.preventDefault();
        setRefreshDialogOpen(false);
      }
    }

    window.addEventListener("keydown", handleDialogKeyDown);

    return () => {
      window.removeEventListener("keydown", handleDialogKeyDown);
    };
  }, [refreshDialogOpen, refreshingWorkspace]);

  // Ask the browser to confirm document unloads (toolbar refresh, tab close,
  // or navigation away). Browsers do not expose which unload action was used,
  // nor whether the native prompt was accepted, so this marker is best-effort.
  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      try {
        window.sessionStorage.setItem(PENDING_BROWSER_REFRESH_KEY, "1");
      } catch {
        // If storage is unavailable, the browser prompt can still be shown.
      }

      event.preventDefault();
      event.returnValue = "";
    }

    // If the user cancels the native prompt, the document stays alive. Clear
    // the marker shortly afterward so a later unrelated navigation is not
    // mistaken for the canceled unload.
    function clearCanceledUnloadMarker() {
      window.setTimeout(() => {
        if (document.visibilityState === "visible") {
          try {
            window.sessionStorage.removeItem(PENDING_BROWSER_REFRESH_KEY);
          } catch {
            // Ignore storage restrictions.
          }
        }
      }, 100);
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("focus", clearCanceledUnloadMarker);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("focus", clearCanceledUnloadMarker);
    };
  }, []);

  // Intercept common browser refresh shortcuts while this application is focused.
  useEffect(() => {
    function handleRefreshShortcut(event: KeyboardEvent) {
      const key = event.key.toLowerCase();

      const isRefreshShortcut =
        event.key === "F5" ||
        ((event.ctrlKey || event.metaKey) &&
          key === "r");

      if (!isRefreshShortcut || event.altKey) return;

      event.preventDefault();
      event.stopPropagation();
      setRefreshDialogOpen(true);
    }

    window.addEventListener("keydown", handleRefreshShortcut, true);

    return () => {
      window.removeEventListener("keydown", handleRefreshShortcut, true);
    };
  }, []);

  function cancelWorkspaceRefresh() {
    if (refreshingWorkspace) return;
    setRefreshDialogOpen(false);
  }

  function confirmWorkspaceRefresh() {
    if (refreshingWorkspace) return;

    setRefreshingWorkspace(true);

    try {
      // Remove only the active dataset reference.
      // The backend dataset itself is not deleted.
      window.sessionStorage.removeItem(ACTIVE_DATASET_KEY);

      // The initial restoration effect will find no saved dataset,
      // so the application opens with an empty workspace.
      window.location.reload();
    } catch {
      setRefreshingWorkspace(false);
      setRefreshDialogOpen(false);
      setError(
        "Unable to reset the workspace. Please try refreshing again."
      );
    }
  }

  function handleConfigureAnalysis(
    analysis: AnalysisPlan["recommended_analyses"][number]
  ) {
    if (!profile) return;

    const validOperations = [
      "descriptive",
      "trend",
      "segment_comparison",
      "correlation",
    ] as const;

    if (!validOperations.includes(analysis.operation)) {
      setPlanningError(
        "This recommendation uses an unsupported analysis operation."
      );
      return;
    }

    const requiredColumnCount =
      analysis.operation === "descriptive" ? 1 : 2;

    const availableColumns = new Set(
      profile.columns_profile.map((column) => column.name)
    );

    if (
      analysis.required_columns.length !== requiredColumnCount ||
      new Set(analysis.required_columns).size !== requiredColumnCount ||
      analysis.required_columns.some(
        (column) => !availableColumns.has(column)
      )
    ) {
      setPlanningError(
        "This recommendation cannot be configured because its required columns are unavailable or invalid."
      );
      return;
    }

    setPlanningError(null);

    setRequestedAnalysis((previous) => ({
      id: (previous?.id ?? 0) + 1,
      dataset_id: profile.dataset_id,
      operation: analysis.operation,
      columns: [...analysis.required_columns],
    }));

    window.setTimeout(() => {
      document
        .getElementById("analytics-execution-panel")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  async function loadDataset(datasetId: string) {
    setLoading(true);
    setError(null);
    setQualityError(null);
    setPlanningError(null);
    setProfile(null);
    setQuality(null);
    setAnalysisPlan(null);
    setRequestedAnalysis(null);
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
        const pendingBrowserUnload = window.sessionStorage.getItem(
          PENDING_BROWSER_REFRESH_KEY
        );

        if (pendingBrowserUnload === "1") {
          // Best-effort reset after an accepted native browser unload prompt.
          // The browser API cannot guarantee this was specifically a refresh.
          window.sessionStorage.removeItem(PENDING_BROWSER_REFRESH_KEY);
          window.sessionStorage.removeItem(ACTIVE_DATASET_KEY);
          return;
        }

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
    setRequestedAnalysis(null);
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

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [activeNav, setActiveNav] = useState("workspace");

  useEffect(() => {
    if (!profile) {
      setActiveNav("workspace");
      return;
    }

    const sectionMap: Record<string, string> = {
      "dataset-overview": "overview",
      "data-quality": "quality",
      "analysis-planner-heading": "analysis",
      "column-intelligence": "columns",
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleSections = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) =>
              a.boundingClientRect.top - b.boundingClientRect.top
          );

        if (visibleSections.length > 0) {
          const sectionId = visibleSections[0].target.id;
          const navId = sectionMap[sectionId];

          if (navId) {
            setActiveNav(navId);
          }
        }
      },
      {
        rootMargin: "-15% 0px -70% 0px",
        threshold: 0,
      }
    );

    Object.keys(sectionMap).forEach((sectionId) => {
      const section = document.getElementById(sectionId);

      if (section) {
        observer.observe(section);
      }
    });

    return () => observer.disconnect();
  }, [profile]);

  const navigateToSection = (sectionId: string, navId: string) => {
    setActiveNav(navId);
    setMobileNavOpen(false);

    if (sectionId === "workspace") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    document.getElementById(sectionId)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const isInitializing = restoring && !profile && !error;

  return (
    <main className="app-pattern min-h-screen bg-[var(--background)] px-4 py-6 text-[var(--foreground)] transition-colors duration-200 sm:px-6 lg:px-8">
      <nav
        id="insightforge-navbar"
        aria-label="Main navigation"
        className="insightforge-navbar sticky top-0 z-50 -mx-4 -mt-6 mb-8 px-4 py-4 sm:-mx-6 sm:px-6 sm:py-4 lg:-mx-8 lg:px-8"
      >
        <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => navigateToSection("workspace", "workspace")}
            className="group flex min-w-0 items-center gap-3 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
            aria-label="InsightForge AI workspace home"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-base font-black tracking-tight text-white shadow-lg shadow-cyan-500/20">
              IF
            </span>

            <span className="min-w-0">
              <span className="block truncate text-base font-extrabold tracking-tight text-[var(--foreground)] sm:text-lg">
                InsightForge{" "}
                <span className="text-cyan-600 dark:text-cyan-400">
                  AI
                </span>
              </span>

              <span className="hidden text-[11px] font-medium tracking-wide text-[var(--foreground-secondary)] sm:block">
                BUSINESS INTELLIGENCE
              </span>
            </span>
          </button>

          <div className="hidden items-center gap-1 lg:flex">
            {[
              { id: "workspace", label: "Workspace", target: "workspace" },
              { id: "overview", label: "Overview", target: "dataset-overview" },
              { id: "quality", label: "Data quality", target: "data-quality" },
              {
                id: "analysis",
                label: "Analysis",
                target: "analysis-planner-heading",
              },
              {
                id: "columns",
                label: "Columns",
                target: "column-intelligence",
              },
            ].map((item) => {
              const disabled = !profile && item.id !== "workspace";
              const active = activeNav === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => navigateToSection(item.target, item.id)}
                  className={`navbar-link relative rounded-lg px-4 py-3 text-sm font-bold transition-colors ${
                    active
                      ? "is-active text-cyan-700 dark:text-cyan-300"
                      : "text-[var(--foreground-secondary)] hover:text-[var(--foreground)]"
                  } disabled:cursor-not-allowed disabled:opacity-40`}
                >
                  {item.label}

                  {active && (
                    <span className="absolute inset-x-3 -bottom-1 h-1 rounded-full bg-cyan-500" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-[var(--foreground-secondary)] xl:inline-flex">
              <span
                className={`h-2 w-2 rounded-full ${
                  profile
                    ? "bg-emerald-500"
                    : "bg-[var(--foreground-secondary)]/40"
                }`}
              />
              {profile ? "Dataset loaded" : "Workspace ready"}
            </span>

            {/* Application-controlled refresh button */}
            <button
              type="button"
              onClick={() => setRefreshDialogOpen(true)}
              aria-label="Refresh workspace and clear the active dataset"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-semibold text-[var(--foreground)] transition-colors hover:border-cyan-500/50 hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path
                  d="M20 7v5h-5M4 17v-5h5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M5.6 9A7 7 0 0 1 17.4 6L20 12M4 12l2.6 6A7 7 0 0 0 18.4 15"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>

              <span className="hidden sm:inline">Refresh</span>
            </button>

            <span className="theme-toggle-icon-only">
              <ThemeToggle />
            </span>

            <button
              type="button"
              onClick={() => setMobileNavOpen((open) => !open)}
              aria-label={
                mobileNavOpen
                  ? "Close navigation menu"
                  : "Open navigation menu"
              }
              aria-expanded={mobileNavOpen}
              aria-controls="insightforge-mobile-navigation"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--foreground)] transition-colors hover:bg-[var(--surface-muted)] lg:hidden"
            >
              {mobileNavOpen ? (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="h-5 w-5"
                  aria-hidden="true"
                >
                  <path
                    d="m6 6 12 12M18 6 6 18"
                    strokeLinecap="round"
                  />
                </svg>
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="h-5 w-5"
                  aria-hidden="true"
                >
                  <path
                    d="M4 7h16M4 12h16M4 17h16"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>

        {mobileNavOpen && (
          <div
            id="insightforge-mobile-navigation"
            className="mx-auto mt-3 grid max-w-[1600px] grid-cols-2 gap-2 border-t border-[var(--border)] pt-3 sm:grid-cols-3 lg:hidden"
          >
            {[
              { id: "workspace", label: "Workspace", target: "workspace" },
              { id: "overview", label: "Overview", target: "dataset-overview" },
              { id: "quality", label: "Data quality", target: "data-quality" },
              {
                id: "analysis",
                label: "Analysis",
                target: "analysis-planner-heading",
              },
              {
                id: "columns",
                label: "Columns",
                target: "column-intelligence",
              },
            ].map((item) => {
              const disabled = !profile && item.id !== "workspace";
              const active = activeNav === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => navigateToSection(item.target, item.id)}
                  className={`rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                    active
                      ? "border-cyan-500/30 text-cyan-700 dark:text-cyan-300"
                      : "border-[var(--border)] text-[var(--foreground-secondary)]"
                  } disabled:cursor-not-allowed disabled:opacity-40`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        )}
      </nav>

      <div id="workspace" className="mx-auto w-full max-w-[1600px] space-y-6">
        <section
          className="workspace-upload-panel"
          aria-label="Dataset workspace and upload"
        >
          <header className="workspace-intro">
            <div className="workspace-eyebrow">
              <span className="workspace-eyebrow-dot" />
              YOUR DATA WORKSPACE
            </div>

            <h1>
              Turn raw data into <span>clear decisions.</span>
            </h1>

            <p className="workspace-description">
              Profile datasets, identify data-quality issues, and uncover
              useful business signals in one focused workspace.
            </p>

            <div
              className="workspace-capabilities"
              aria-label="Workspace capabilities"
            >
              <span>
                <i aria-hidden="true">01</i> Profile
              </span>
              <span>
                <i aria-hidden="true">02</i> Validate
              </span>
              <span>
                <i aria-hidden="true">03</i> Analyze
              </span>
            </div>
          </header>

          <label
            className="workspace-upload glass-panel-interactive"
            htmlFor="dataset-file-input"
          >
            <span className="upload-icon-wrap" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                className="h-7 w-7"
              >
                <path
                  d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M5 14.5v3A2.5 2.5 0 0 0 7.5 20h9a2.5 2.5 0 0 0 2.5-2.5v-3"
                  strokeLinecap="round"
                />
              </svg>
            </span>

            <span className="upload-title">Upload your dataset</span>

            <span className="upload-description">
              Drop your file here or choose a file from your device.
            </span>

            <span className="upload-formats">
              <b>CSV</b>
              <b>XLSX</b>
              <span>Up to 50 MB</span>
            </span>

            <input
              id="dataset-file-input"
              className="sr-only"
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
        </section>

        {isInitializing && (
          <div
            role="status"
            className="mb-6 rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-4 text-sm text-[var(--foreground-secondary)]"
          >
            Checking for your current session dataset...
          </div>
        )}

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

            <section id="dataset-overview" className="scroll-mt-28">
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
                    className="glass-panel-interactive rounded-xl border border-[var(--border)] p-5 transition-colors duration-200"
                  >
                    <p className="text-sm text-[var(--foreground-secondary)]">
                      {label}
                    </p>
                    <p className="mt-2 text-2xl font-bold">{value}</p>
                  </div>
                ))}
              </div>
            </section>

            <section id="data-quality" className="scroll-mt-28">
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
                    <div className="glass-panel rounded-2xl border border-[var(--border)] p-6 transition-colors duration-200">
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

                    <div className="glass-panel rounded-2xl border border-[var(--border)] p-6 transition-colors duration-200">
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
              id="analysis-planner"
              aria-labelledby="analysis-planner-heading"
              className="glass-panel-elevated rounded-2xl border border-[var(--border)] p-5 sm:p-7"
            >
              <div
                id="analytics-execution-panel"
                className="scroll-mt-28"
              >
                <AnalyticsExecutionPanel
                  profile={profile}
                  requestedAnalysis={requestedAnalysis}
                />
              </div>

              <div className="mb-6">
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
                    disabled={
                      planning || loading || !businessObjective.trim()
                    }
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

                  <AnalysisPlanResults
                    plan={analysisPlan}
                    onConfigureAnalysis={handleConfigureAnalysis}
                  />
                </div>
              )}
            </section>

            <section id="column-intelligence" className="scroll-mt-28">
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
                            {column.min_value ?? "-"} -{" "}
                            {column.max_value ?? "-"}
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

      {/* Refresh confirmation dialog */}
      {refreshDialogOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !refreshingWorkspace
            ) {
              cancelWorkspaceRefresh();
            }
          }}
        >
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="refresh-dialog-title"
            aria-describedby="refresh-dialog-description"
            className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-[var(--foreground)] shadow-2xl sm:p-7"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-6 w-6"
                aria-hidden="true"
              >
                <path
                  d="M20 7v5h-5M4 17v-5h5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M5.6 9A7 7 0 0 1 17.4 6L20 12M4 12l2.6 6A7 7 0 0 0 18.4 15"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <h2
              id="refresh-dialog-title"
              className="mt-5 text-xl font-bold tracking-tight"
            >
              Refresh InsightForge AI?
            </h2>

            <p
              id="refresh-dialog-description"
              className="mt-3 text-sm leading-6 text-[var(--foreground-secondary)]"
            >
              This will clear the currently active dataset session and reset
              the workspace. Your uploaded dataset file will not be deleted
              from your computer, and the backend dataset will not be deleted.
              You will need to upload the dataset again to continue your
              analysis.
            </p>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                ref={refreshCancelButtonRef}
                type="button"
                onClick={cancelWorkspaceRefresh}
                disabled={refreshingWorkspace}
                className="inline-flex items-center justify-center rounded-xl border border-[var(--border)] px-4 py-3 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmWorkspaceRefresh}
                disabled={refreshingWorkspace}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {refreshingWorkspace && (
                  <svg
                    className="h-4 w-4 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="9"
                      stroke="currentColor"
                      strokeWidth="3"
                      className="opacity-25"
                    />
                    <path
                      d="M21 12a9 9 0 0 0-9-9"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      className="opacity-90"
                    />
                  </svg>
                )}

                {refreshingWorkspace
                  ? "Resetting workspace..."
                  : "Refresh & Clear Data"}
              </button>
            </div>

            <p className="mt-4 text-xs text-[var(--foreground-secondary)]">
              Press Escape or select Cancel to keep your current dataset.
            </p>
          </section>
        </div>
      )}
    </main>
  );
}