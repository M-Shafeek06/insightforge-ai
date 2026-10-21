"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { DatasetProfile } from "@/lib/api/datasets";
import {
  executeDatasetAnalytics,
  type AnalyticsExecutionResult,
  type ExecutionAggregation,
  type TrendInterval,
} from "@/lib/api/execution";
import AnalyticsResultsChart from "@/components/analytics/AnalyticsResultsChart";
import AnalyticsBusinessInsights from "@/components/analytics/AnalyticsBusinessInsights";
import AnalyticsTrendChart from "@/components/analytics/AnalyticsTrendChart";
import AnalyticsSegmentComparisonChart from "@/components/analytics/AnalyticsSegmentComparisonChart";
import AnalyticsCorrelationChart from "@/components/analytics/AnalyticsCorrelationChart";

type AnalysisOperation =
  | "kpi"
  | "descriptive"
  | "trend"
  | "segment_comparison"
  | "correlation";

export type AnalysisConfigurationRequest = {
  id: number;
  dataset_id: string;
  operation: Exclude<AnalysisOperation, "kpi">;
  columns: string[];
};

type Props = {
  profile: DatasetProfile;
  requestedAnalysis?: AnalysisConfigurationRequest | null;
};

function isGroupedResult(
  result: AnalyticsExecutionResult
): result is Extract<AnalyticsExecutionResult, { groups: unknown[] }> {
  return "groups" in result;
}

function formatNumber(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "No valid values";
  }

  return value.toLocaleString(undefined, {
    maximumFractionDigits: 4,
  });
}

function formatGroup(value: string | number | boolean | null): string {
  if (value === null) {
    return "(Missing value)";
  }

  if (typeof value === "boolean") {
    return value ? "True" : "False";
  }

  return String(value);
}

function formatAggregation(aggregation: ExecutionAggregation): string {
  switch (aggregation) {
    case "sum":
      return "Sum";
    case "average":
      return "Average";
    case "count":
      return "Count";
  }
}

function getPreferredDateColumn(profile: DatasetProfile): string {
  const preferred = profile.columns_profile.find((column) =>
    /date|time|timestamp/i.test(`${column.name} ${column.dtype}`)
  );

  return preferred?.name ?? profile.columns_profile[0]?.name ?? "";
}

export default function AnalyticsExecutionPanel({ profile, requestedAnalysis }: Props) {
  const numericColumns = useMemo(
    () =>
      profile.columns_profile.filter(
        (column) => column.semantic_role === "measure"
      ),
    [profile.columns_profile]
  );

  const allColumns = profile.columns_profile;

  const [operation, setOperation] = useState<AnalysisOperation>("kpi");

  const [aggregation, setAggregation] = useState<ExecutionAggregation>(
    numericColumns.length > 0 ? "sum" : "count"
  );

  const [selectedColumn, setSelectedColumn] = useState(
    numericColumns[0]?.name ?? allColumns[0]?.name ?? ""
  );

  const [secondColumn, setSecondColumn] = useState(
    numericColumns[1]?.name ?? ""
  );

  const [groupBy, setGroupBy] = useState("");
  const [segmentBy, setSegmentBy] = useState("");

  const [dateColumn, setDateColumn] = useState(
    getPreferredDateColumn(profile)
  );

  const [trendInterval, setTrendInterval] =
    useState<TrendInterval>("month");

  const [result, setResult] =
    useState<AnalyticsExecutionResult | null>(null);

  const [executing, setExecuting] = useState(false);
  const [executionError, setExecutionError] = useState<string | null>(null);

  const availableMeasureColumns = useMemo(() => {
    let columns =
      operation === "correlation" ||
      operation === "descriptive" ||
      aggregation !== "count"
        ? numericColumns
        : allColumns;

    if (operation === "segment_comparison") {
      columns = columns.filter((column) => column.name !== segmentBy);
    }

    return columns;
  }, [
    operation,
    aggregation,
    numericColumns,
    allColumns,
    segmentBy,
  ]);

  useEffect(() => {
    const firstMeasure = profile.columns_profile.find(
      (column) => column.semantic_role === "measure"
    );

    const firstColumn = profile.columns_profile[0]?.name ?? "";
    const initialMeasure = firstMeasure?.name ?? firstColumn;

    const initialSegment =
      profile.columns_profile.find(
        (column) => column.name !== initialMeasure
      )?.name ?? "";

    setOperation("kpi");
    setAggregation(firstMeasure ? "sum" : "count");
    setSelectedColumn(initialMeasure);
    setSecondColumn(
      profile.columns_profile.find(
        (column) =>
          column.semantic_role === "measure" &&
          column.name !== initialMeasure
      )?.name ?? ""
    );
    setGroupBy("");
    setSegmentBy(initialSegment);
    setDateColumn(getPreferredDateColumn(profile));
    setTrendInterval("month");
    setResult(null);
    setExecutionError(null);
  }, [profile.dataset_id, profile.columns_profile]);
  useEffect(() => {
    if (
      !requestedAnalysis ||
      requestedAnalysis.dataset_id !== profile.dataset_id
    ) {
      return;
    }

    const { operation: requestedOperation, columns } = requestedAnalysis;
    const availableNames = new Set(
      profile.columns_profile.map((column) => column.name)
    );

    const expectedColumnCount =
      requestedOperation === "descriptive" ? 1 : 2;

    if (
      columns.length !== expectedColumnCount ||
      new Set(columns).size !== columns.length ||
      columns.some((column) => !availableNames.has(column))
    ) {
      setExecutionError(
        "Requested analysis contains unavailable or invalid columns. Please review the recommendation."
      );
      return;
    }

    const measureColumns = new Set(
      profile.columns_profile
        .filter((column) => column.semantic_role === "measure")
        .map((column) => column.name)
    );

    const measureColumn =
      requestedOperation === "trend" ||
      requestedOperation === "segment_comparison"
        ? columns[1]
        : columns[0];

    if (
      requestedOperation !== "correlation" &&
      !measureColumns.has(measureColumn)
    ) {
      setExecutionError(
        "The recommended measure is not identified as numeric in the current dataset."
      );
      return;
    }

    if (
      requestedOperation === "correlation" &&
      columns.some((column) => !measureColumns.has(column))
    ) {
      setExecutionError(
        "Correlation requires two numeric measure columns."
      );
      return;
    }

    if (
      requestedOperation === "trend" &&
      measureColumn === columns[0]
    ) {
      setExecutionError(
        "The trend recommendation must use distinct date and measure columns."
      );
      return;
    }

    if (
      requestedOperation === "segment_comparison" &&
      columns[0] === columns[1]
    ) {
      setExecutionError(
        "Segment comparison requires distinct segment and measure columns."
      );
      return;
    }

    setOperation(requestedOperation);
    setSelectedColumn(measureColumn);

    if (requestedOperation === "trend") {
      setDateColumn(columns[0]);
    }

    if (requestedOperation === "segment_comparison") {
      setSegmentBy(columns[0]);
      setGroupBy("");
    }

    if (requestedOperation === "correlation") {
      setSecondColumn(columns[1]);
    }

    setResult(null);
    setExecutionError(null);
  }, [requestedAnalysis, profile.dataset_id, profile.columns_profile]);

  useEffect(() => {
    if (
      availableMeasureColumns.length > 0 &&
      !availableMeasureColumns.some(
        (column) => column.name === selectedColumn
      )
    ) {
      setSelectedColumn(availableMeasureColumns[0].name);
    }
  }, [availableMeasureColumns, selectedColumn]);

  const availableSecondColumns = useMemo(
    () => numericColumns.filter((column) => column.name !== selectedColumn),
    [numericColumns, selectedColumn]
  );

  useEffect(() => {
    if (
      availableSecondColumns.length > 0 &&
      !availableSecondColumns.some(
        (column) => column.name === secondColumn
      )
    ) {
      setSecondColumn(availableSecondColumns[0].name);
    } else if (availableSecondColumns.length === 0 && secondColumn !== "") {
      setSecondColumn("");
    }
  }, [availableSecondColumns, secondColumn]);

  useEffect(() => {
    if (
      operation === "segment_comparison" &&
      segmentBy === selectedColumn
    ) {
      const alternative = allColumns.find(
        (column) => column.name !== selectedColumn
      );

      setSegmentBy(alternative?.name ?? "");
    }
  }, [operation, segmentBy, selectedColumn, allColumns]);

  async function handleExecute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setExecutionError(null);

    if (!selectedColumn) {
      setExecutionError("Select a column before executing the analysis.");
      return;
    }

    if (
      operation === "trend" &&
      (!dateColumn || dateColumn === selectedColumn)
    ) {
      setExecutionError(
        !dateColumn
          ? "Select a date column before executing trend analysis."
          : "Select a date column different from the column being analyzed."
      );
      return;
    }

    if (operation === "correlation") {
      if (numericColumns.length < 2 || availableSecondColumns.length === 0) {
        setExecutionError(
          "Measure Relationship requires at least two numeric columns."
        );
        return;
      }

      if (!secondColumn || secondColumn === selectedColumn) {
        setExecutionError(
          "Select two different numeric columns for the relationship analysis."
        );
        return;
      }
    }

    if (operation === "segment_comparison") {
      if (!segmentBy) {
        setExecutionError(
          "Select a segment column before executing the comparison."
        );
        return;
      }

      if (segmentBy === selectedColumn) {
        setExecutionError(
          "The measure column and segment column must be different."
        );
        return;
      }
    }

    setExecuting(true);
    setResult(null);

    try {
      const request =
        operation === "descriptive"
          ? {
              operation: "descriptive" as const,
              column: selectedColumn,
            }
          : operation === "trend"
            ? {
                operation: "trend" as const,
                column: selectedColumn,
                aggregation,
                date_column: dateColumn,
                interval: trendInterval,
              }
            : operation === "segment_comparison"
              ? {
                  operation: "segment_comparison" as const,
                  column: selectedColumn,
                  aggregation,
                  group_by: segmentBy,
                }
              : operation === "correlation"
                ? {
                    operation: "correlation" as const,
                    column: selectedColumn,
                    second_column: secondColumn,
                  }
                : {
                  operation: "kpi" as const,
                  column: selectedColumn,
                  aggregation,
                  group_by: groupBy || null,
                };

      const response = await executeDatasetAnalytics(
        profile.dataset_id,
        request
      );

      setResult(response);
    } catch (error) {
      setExecutionError(
        error instanceof Error
          ? error.message
          : "Unable to execute the requested analysis."
      );
    } finally {
      setExecuting(false);
    }
  }

  const canExecuteSegmentComparison =
    operation !== "segment_comparison" ||
    (Boolean(segmentBy) && segmentBy !== selectedColumn);

  const canExecuteCorrelation =
    operation !== "correlation" ||
    (numericColumns.length >= 2 &&
      Boolean(secondColumn) &&
      secondColumn !== selectedColumn);

  return (
    <section
      aria-labelledby="analytics-execution-heading"
      className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-7"
    >
      <div className="mb-6">
        <h3
          id="analytics-execution-heading"
          className="mt-2 text-2xl font-semibold"
        >
          Execute Analytics
        </h3>

        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--foreground-secondary)]">
          Choose KPI Analysis for aggregations and optional grouping,
          Descriptive Statistics to inspect a numeric column, Trend Analysis
          to examine a measure over time, Segment Comparison to compare
          an aggregation across categories, or Measure Relationship to assess
          the Pearson correlation between two numeric columns. Calculations
          use the uploaded dataset without modifying the original data.
        </p>
      </div>

      {allColumns.length === 0 ? (
        <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/5 p-4 text-sm">
          No columns are available for analysis.
        </div>
      ) : (
        <form onSubmit={handleExecute} className="space-y-5">
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {/* Analysis type */}
            <div>
              <label
                htmlFor="execution-operation"
                className="mb-2 block text-sm font-semibold"
              >
                Analysis type
              </label>

              <select
                id="execution-operation"
                value={operation}
                onChange={(event) => {
                  setOperation(event.target.value as AnalysisOperation);
                  setResult(null);
                  setExecutionError(null);
                }}
                disabled={executing}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-3 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 disabled:opacity-50"
              >
                <option value="kpi">KPI Analysis</option>
                <option value="descriptive">Descriptive Statistics</option>
                <option value="trend">Trend Analysis</option>
                <option value="segment_comparison">
                  Segment Comparison
                </option>
                <option
                  value="correlation"
                  disabled={numericColumns.length < 2}
                >
                  Measure Relationship
                </option>
              </select>
            </div>

            {/* Aggregation */}
            {operation !== "descriptive" &&
              operation !== "correlation" && (
              <div>
                <label
                  htmlFor="execution-aggregation"
                  className="mb-2 block text-sm font-semibold"
                >
                  Aggregation
                </label>

                <select
                  id="execution-aggregation"
                  value={aggregation}
                  onChange={(event) => {
                    setAggregation(
                      event.target.value as ExecutionAggregation
                    );
                    setResult(null);
                    setExecutionError(null);
                  }}
                  disabled={executing}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-3 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 disabled:opacity-50"
                >
                  <option value="sum" disabled={numericColumns.length === 0}>
                    Sum
                  </option>

                  <option
                    value="average"
                    disabled={numericColumns.length === 0}
                  >
                    Average
                  </option>

                  <option value="count">Count non-null values</option>
                </select>
              </div>
            )}

            {/* Measure column */}
            <div>
              <label
                htmlFor="execution-column"
                className="mb-2 block text-sm font-semibold"
              >
                Column to analyze
              </label>

              <select
                id="execution-column"
                value={selectedColumn}
                onChange={(event) => {
                  setSelectedColumn(event.target.value);
                  setResult(null);
                  setExecutionError(null);
                }}
                disabled={executing || availableMeasureColumns.length === 0}
                required
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-3 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 disabled:opacity-50"
              >
                {availableMeasureColumns.map((column) => (
                  <option key={column.name} value={column.name}>
                    {column.name} · {column.dtype}
                  </option>
                ))}
              </select>

              {availableMeasureColumns.length === 0 && (
                <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                  No eligible columns are available for this selection.
                </p>
              )}

              {operation === "descriptive" && (
                <p className="mt-2 text-xs text-[var(--foreground-secondary)]">
                  Descriptive statistics require a numeric measure.
                </p>
              )}

              {operation === "correlation" && (
                <p className="mt-2 text-xs text-[var(--foreground-secondary)]">
                  Choose the first numeric measure for the relationship analysis.
                </p>
              )}

              {operation !== "descriptive" &&
                operation !== "correlation" &&
                aggregation !== "count" && (
                <p className="mt-2 text-xs text-[var(--foreground-secondary)]">
                  Numeric measure columns are available for this aggregation.
                </p>
              )}
            </div>

            {/* Second measure for correlation */}
            {operation === "correlation" && (
              <div>
                <label
                  htmlFor="execution-second-column"
                  className="mb-2 block text-sm font-semibold"
                >
                  Compare with numeric column
                </label>

                <select
                  id="execution-second-column"
                  value={secondColumn}
                  onChange={(event) => {
                    setSecondColumn(event.target.value);
                    setResult(null);
                    setExecutionError(null);
                  }}
                  disabled={executing || availableSecondColumns.length === 0}
                  required
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-3 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 disabled:opacity-50"
                >
                  <option value="">Select a second numeric column</option>

                  {availableSecondColumns.map((column) => (
                    <option key={column.name} value={column.name}>
                      {column.name} · {column.dtype}
                    </option>
                  ))}
                </select>

                <p className="mt-2 text-xs text-[var(--foreground-secondary)]">
                  Select a different numeric measure. Only rows with valid
                  values in both columns contribute to the correlation.
                </p>

                {numericColumns.length < 2 && (
                  <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                    At least two numeric columns are required.
                  </p>
                )}
              </div>
            )}

            {/* Date column */}
            {operation === "trend" && (
              <div>
                <label
                  htmlFor="execution-date-column"
                  className="mb-2 block text-sm font-semibold"
                >
                  Date column
                </label>

                <select
                  id="execution-date-column"
                  value={dateColumn}
                  onChange={(event) => {
                    setDateColumn(event.target.value);
                    setResult(null);
                    setExecutionError(null);
                  }}
                  disabled={executing}
                  required
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-3 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 disabled:opacity-50"
                >
                  <option value="">Select a date column</option>

                  {allColumns.map((column) => (
                    <option key={column.name} value={column.name}>
                      {column.name} · {column.dtype}
                    </option>
                  ))}
                </select>

                <p className="mt-2 text-xs text-[var(--foreground-secondary)]">
                  Choose a column containing dates or timestamps.
                </p>
              </div>
            )}

            {/* Trend interval */}
            {operation === "trend" && (
              <div>
                <label
                  htmlFor="execution-trend-interval"
                  className="mb-2 block text-sm font-semibold"
                >
                  Time interval
                </label>

                <select
                  id="execution-trend-interval"
                  value={trendInterval}
                  onChange={(event) => {
                    setTrendInterval(event.target.value as TrendInterval);
                    setResult(null);
                    setExecutionError(null);
                  }}
                  disabled={executing}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-3 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 disabled:opacity-50"
                >
                  <option value="day">Daily</option>
                  <option value="week">Weekly</option>
                  <option value="month">Monthly</option>
                  <option value="year">Yearly</option>
                </select>
              </div>
            )}

            {/* KPI grouping */}
            {operation === "kpi" && (
              <div>
                <label
                  htmlFor="execution-group-by"
                  className="mb-2 block text-sm font-semibold"
                >
                  Group results (optional)
                </label>

                <select
                  id="execution-group-by"
                  value={groupBy}
                  onChange={(event) => {
                    setGroupBy(event.target.value);
                    setResult(null);
                    setExecutionError(null);
                  }}
                  disabled={executing}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-3 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 disabled:opacity-50"
                >
                  <option value="">No grouping</option>

                  {allColumns
                    .filter((column) => column.name !== selectedColumn)
                    .map((column) => (
                      <option key={column.name} value={column.name}>
                        {column.name} · {column.semantic_role}
                      </option>
                    ))}
                </select>
              </div>
            )}

            {/* Segment comparison column */}
            {operation === "segment_comparison" && (
              <div>
                <label
                  htmlFor="execution-segment-by"
                  className="mb-2 block text-sm font-semibold"
                >
                  Compare segments by
                </label>

                <select
                  id="execution-segment-by"
                  value={segmentBy}
                  onChange={(event) => {
                    setSegmentBy(event.target.value);
                    setResult(null);
                    setExecutionError(null);
                  }}
                  disabled={executing}
                  required
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-3 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 disabled:opacity-50"
                >
                  <option value="">Select a segment column</option>

                  {allColumns
                    .filter((column) => column.name !== selectedColumn)
                    .map((column) => (
                      <option key={column.name} value={column.name}>
                        {column.name} · {column.semantic_role}
                      </option>
                    ))}
                </select>

                <p className="mt-2 text-xs text-[var(--foreground-secondary)]">
                  Compare the selected aggregation across each distinct
                  segment, including missing segment values where present.
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-5 text-[var(--foreground-secondary)]">
              Dataset: {profile.filename} · {profile.rows.toLocaleString()} rows
            </p>

            <button
              type="submit"
              disabled={
                executing ||
                !selectedColumn ||
                availableMeasureColumns.length === 0 ||
                (operation === "trend" &&
                  (!dateColumn || dateColumn === selectedColumn)) ||
                !canExecuteSegmentComparison ||
                !canExecuteCorrelation
              }
              className="inline-flex items-center justify-center rounded-lg bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {executing ? "Executing..." : "Execute Analysis"}
            </button>
          </div>
        </form>
      )}

      {/* Execution status */}
      {executing && (
        <div
          role="status"
          className="mt-6 rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-4 text-sm text-[var(--foreground-secondary)]"
        >
          Executing the requested calculation...
        </div>
      )}

      {/* Execution error */}
      {executionError && (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-red-500/40 bg-red-500/5 p-4 text-sm text-red-700 dark:text-red-300"
        >
          <p className="font-semibold">Analytics execution failed</p>
          <p className="mt-1">{executionError}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="mt-8 space-y-5 border-t border-[var(--border)] pt-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--foreground-secondary)]">
              Execution result
            </p>

            <h4 className="mt-2 text-lg font-semibold">
              {result.operation === "correlation"
                ? `Relationship between ${result.column} and ${result.second_column}`
                : result.operation === "descriptive"
                  ? `Descriptive statistics for ${result.column}`
                  : result.operation === "trend"
                  ? `${formatAggregation(result.aggregation)} trend for ${result.column}`
                  : result.operation === "segment_comparison"
                    ? `${formatAggregation(result.aggregation)} of ${result.column} by ${result.segment_by}`
                    : `${formatAggregation(result.aggregation)} of ${result.column}${
                        "groups" in result ? ` by ${result.group_by}` : ""
                      }`}
            </h4>
          </div>

          {/* Descriptive statistics */}
          {result.operation === "descriptive" ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  { label: "Mean", value: result.statistics.mean },
                  { label: "Median", value: result.statistics.median },
                  { label: "Minimum", value: result.statistics.minimum },
                  { label: "Maximum", value: result.statistics.maximum },
                  {
                    label: "Standard deviation",
                    value: result.statistics.standard_deviation,
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-4"
                  >
                    <p className="text-sm text-[var(--foreground-secondary)]">
                      {item.label}
                    </p>

                    <p className="mt-2 break-words text-2xl font-semibold">
                      {item.value === null
                        ? "Not available"
                        : formatNumber(item.value)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { label: "Total rows", value: result.row_count },
                  {
                    label: "Valid values",
                    value: result.valid_value_count,
                  },
                  { label: "Null values", value: result.null_count },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-4"
                  >
                    <p className="text-sm text-[var(--foreground-secondary)]">
                      {item.label}
                    </p>

                    <p className="mt-2 text-2xl font-semibold">
                      {item.value.toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>

              <p className="text-xs leading-5 text-[var(--foreground-secondary)]">
                Standard deviation uses the sample calculation. It is
                unavailable when fewer than two valid numeric values exist.
                Statistics are calculated from the uploaded dataset without
                modifying the original data.
              </p>
            </>
          ) : result.operation === "trend" ? (
            /* Trend analysis */
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    label: "Periods returned",
                    value: result.points.length,
                  },
                  {
                    label: "Periods with valid results",
                    value: result.points.filter(
                      (point) =>
                        point.value !== null &&
                        Number.isFinite(point.value)
                    ).length,
                  },
                  {
                    label: "Rows in valid-date periods",
                    value: result.points.reduce(
                      (total, point) => total + point.row_count,
                      0
                    ),
                  },
                  {
                    label: "Null measure values",
                    value: result.points.reduce(
                      (total, point) => total + point.null_count,
                      0
                    ),
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-4"
                  >
                    <p className="text-sm text-[var(--foreground-secondary)]">
                      {item.label}
                    </p>

                    <p className="mt-2 text-2xl font-semibold">
                      {item.value.toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>

              <AnalyticsTrendChart result={result} />

              <div className="overflow-hidden rounded-xl border border-[var(--border)]">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[680px] text-left text-sm">
                    <thead className="bg-[var(--surface-secondary)] text-[var(--foreground-secondary)]">
                      <tr>
                        <th className="px-4 py-3">Period</th>
                        <th className="px-4 py-3">Result</th>
                        <th className="px-4 py-3">Rows</th>
                        <th className="px-4 py-3">Valid values</th>
                        <th className="px-4 py-3">Null values</th>
                      </tr>
                    </thead>

                    <tbody>
                      {result.points.map((point) => (
                        <tr
                          key={point.period}
                          className="border-t border-[var(--border)]"
                        >
                          <td className="px-4 py-3 font-medium">
                            {point.period}
                          </td>
                          <td className="px-4 py-3 font-semibold">
                            {formatNumber(point.value)}
                          </td>
                          <td className="px-4 py-3">
                            {point.row_count.toLocaleString()}
                          </td>
                          <td className="px-4 py-3">
                            {point.valid_value_count.toLocaleString()}
                          </td>
                          <td className="px-4 py-3">
                            {point.null_count.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <p className="text-xs leading-5 text-[var(--foreground-secondary)]">
                Records with invalid dates are excluded from the trend.
                Null measure values remain reflected in each period&apos;s
                counts. The original uploaded dataset remains unchanged.
              </p>
            </>
          ) : result.operation === "segment_comparison" ? (
            /* Segment comparison */
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    label: "Segments returned",
                    value: result.segments.length,
                  },
                  {
                    label: "Segments with valid results",
                    value: result.segments.filter(
                      (segment) =>
                        segment.value !== null &&
                        Number.isFinite(segment.value)
                    ).length,
                  },
                  {
                    label: "Rows across segments",
                    value: result.segments.reduce(
                      (total, segment) => total + segment.row_count,
                      0
                    ),
                  },
                  {
                    label: "Null measure values",
                    value: result.segments.reduce(
                      (total, segment) => total + segment.null_count,
                      0
                    ),
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-4"
                  >
                    <p className="text-sm text-[var(--foreground-secondary)]">
                      {item.label}
                    </p>

                    <p className="mt-2 text-2xl font-semibold">
                      {item.value.toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>

              {result.segments.length === 0 ? (
                <p className="rounded-xl border border-[var(--border)] p-5 text-sm text-[var(--foreground-secondary)]">
                  No segments were returned for this calculation.
                </p>
              ) : (
                <>
                  <AnalyticsSegmentComparisonChart result={result} />

                  <div className="overflow-hidden rounded-xl border border-[var(--border)]">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[720px] text-left text-sm">
                        <thead className="bg-[var(--surface-secondary)] text-[var(--foreground-secondary)]">
                          <tr>
                            <th className="px-4 py-3">
                              {result.segment_by}
                            </th>
                            <th className="px-4 py-3">Result</th>
                            <th className="px-4 py-3">Rows</th>
                            <th className="px-4 py-3">Valid values</th>
                            <th className="px-4 py-3">Null values</th>
                          </tr>
                        </thead>

                        <tbody>
                          {result.segments.map((segment, index) => (
                            <tr
                              key={`${String(segment.group)}-${index}`}
                              className="border-t border-[var(--border)]"
                            >
                              <td className="max-w-xs break-words px-4 py-3 font-medium">
                                {formatGroup(segment.group)}
                              </td>
                              <td className="px-4 py-3 font-semibold">
                                {formatNumber(segment.value)}
                              </td>
                              <td className="px-4 py-3">
                                {segment.row_count.toLocaleString()}
                              </td>
                              <td className="px-4 py-3">
                                {segment.valid_value_count.toLocaleString()}
                              </td>
                              <td className="px-4 py-3">
                                {segment.null_count.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              <p className="text-xs leading-5 text-[var(--foreground-secondary)]">
                Each segment is calculated independently. Null measure values
                are reflected in the counts, and missing segment values are
                retained as a separate segment when present. The uploaded
                dataset is not modified.
              </p>
            </>
          ) : result.operation === "correlation" ? (
            /* Measure Relationship / Pearson Correlation */
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-5">
                  <p className="text-sm text-[var(--foreground-secondary)]">
                    Pearson correlation coefficient
                  </p>
                  <p className="mt-2 break-words text-3xl font-bold sm:text-4xl">
                    {result.correlation.toFixed(4)}
                  </p>
                  <p className="mt-2 text-xs text-[var(--foreground-secondary)]">
                    Range: -1 to +1
                  </p>
                </div>

                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-4">
                  <p className="text-sm text-[var(--foreground-secondary)]">
                    Relationship strength
                  </p>
                  <p className="mt-2 text-xl font-semibold capitalize">
                    {result.strength}
                  </p>
                </div>

                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-4">
                  <p className="text-sm text-[var(--foreground-secondary)]">
                    Direction
                  </p>
                  <p className="mt-2 text-xl font-semibold capitalize">
                    {result.direction}
                  </p>
                </div>

                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-4">
                  <p className="text-sm text-[var(--foreground-secondary)]">
                    Paired observations
                  </p>
                  <p className="mt-2 text-2xl font-semibold">
                    {result.observation_count.toLocaleString()}
                  </p>
                </div>
              </div>

              <AnalyticsCorrelationChart result={result} />

    <div className="rounded-xl border border-[var(--border)] p-5">
                <h5 className="font-semibold">Interpretation</h5>
                <p className="mt-2 text-sm leading-6 text-[var(--foreground-secondary)]">
                  {result.strength === "negligible"
                    ? "The linear relationship between these measures is negligible."
                    : `The measures have a ${result.strength} ${result.direction === "none" ? "" : result.direction + " "}linear relationship.`}
                  {" "}The coefficient describes linear association, not causation.
                  Rows missing a value in either selected column are excluded
                  from the calculation.
                </p>
              </div>
            </>
          ) : !isGroupedResult(result) ? (
            /* Ungrouped KPI */
            <>
              <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-6">
                <p className="text-sm text-[var(--foreground-secondary)]">
                  {formatAggregation(result.aggregation)} result
                </p>

                <p className="mt-2 break-words text-3xl font-bold sm:text-4xl">
                  {formatNumber(result.value)}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { label: "Total rows", value: result.row_count },
                  {
                    label: "Valid values",
                    value: result.valid_value_count,
                  },
                  { label: "Null values", value: result.null_count },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-4"
                  >
                    <p className="text-sm text-[var(--foreground-secondary)]">
                      {item.label}
                    </p>

                    <p className="mt-2 text-2xl font-semibold">
                      {item.value.toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            /* Grouped KPI */
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-4">
                  <p className="text-sm text-[var(--foreground-secondary)]">
                    Groups returned
                  </p>

                  <p className="mt-2 text-2xl font-semibold">
                    {result.groups.length.toLocaleString()}
                  </p>
                </div>

                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-4">
                  <p className="text-sm text-[var(--foreground-secondary)]">
                    Aggregation
                  </p>

                  <p className="mt-2 text-lg font-semibold">
                    {formatAggregation(result.aggregation)}
                  </p>
                </div>

                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-4">
                  <p className="text-sm text-[var(--foreground-secondary)]">
                    Grouping column
                  </p>

                  <p className="mt-2 break-words text-lg font-semibold">
                    {result.group_by}
                  </p>
                </div>
              </div>

              {result.groups.length > 0 && (
                <>
                  <AnalyticsResultsChart result={result} />
                </>
              )}

              {result.groups.length === 0 ? (
                <p className="rounded-xl border border-[var(--border)] p-5 text-sm text-[var(--foreground-secondary)]">
                  No groups were returned for this calculation.
                </p>
              ) : (
                <div className="overflow-hidden rounded-xl border border-[var(--border)]">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-left text-sm">
                      <thead className="bg-[var(--surface-secondary)] text-[var(--foreground-secondary)]">
                        <tr>
                          <th className="px-4 py-3">Group</th>
                          <th className="px-4 py-3">Result</th>
                          <th className="px-4 py-3">Rows</th>
                          <th className="px-4 py-3">Valid values</th>
                          <th className="px-4 py-3">Null values</th>
                        </tr>
                      </thead>

                      <tbody>
                        {result.groups.map((group, index) => (
                          <tr
                            key={`${String(group.group)}-${index}`}
                            className="border-t border-[var(--border)]"
                          >
                            <td className="max-w-xs break-words px-4 py-3 font-medium">
                              {formatGroup(group.group)}
                            </td>
                            <td className="px-4 py-3 font-semibold">
                              {formatNumber(group.value)}
                            </td>
                            <td className="px-4 py-3">
                              {group.row_count.toLocaleString()}
                            </td>
                            <td className="px-4 py-3">
                              {group.valid_value_count.toLocaleString()}
                            </td>
                            <td className="px-4 py-3">
                              {group.null_count.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          <AnalyticsBusinessInsights result={result} />
        </div>
      )}
    </section>
  );
}
