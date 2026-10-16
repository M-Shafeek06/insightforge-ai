"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { DatasetProfile } from "@/lib/api/datasets";
import {
  executeDatasetAnalytics,
  type AnalyticsExecutionResult,
  type ExecutionAggregation,
} from "@/lib/api/execution";

type Props = {
  profile: DatasetProfile;
};

function isGroupedResult(
  result: AnalyticsExecutionResult
): result is Extract<AnalyticsExecutionResult, { groups: unknown[] }> {
  return "groups" in result;
}

function formatNumber(value: number | null): string {
  if (value === null) {
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

export default function AnalyticsExecutionPanel({ profile }: Props) {
  const numericColumns = useMemo(
    () =>
      profile.columns_profile.filter(
        (column) => column.semantic_role === "measure"
      ),
    [profile.columns_profile]
  );

  const allColumns = profile.columns_profile;

  const [aggregation, setAggregation] =
    useState<ExecutionAggregation>(
      numericColumns.length > 0 ? "sum" : "count"
    );
  const [selectedColumn, setSelectedColumn] = useState(
    numericColumns[0]?.name ?? allColumns[0]?.name ?? ""
  );
  const [groupBy, setGroupBy] = useState("");
  const [result, setResult] = useState<AnalyticsExecutionResult | null>(null);
  const [executing, setExecuting] = useState(false);
  const [executionError, setExecutionError] = useState<string | null>(null);

  const availableMeasureColumns =
    aggregation === "count" ? allColumns : numericColumns;

  useEffect(() => {
    const firstMeasure = profile.columns_profile.find(
      (column) => column.semantic_role === "measure"
    );

    setAggregation(firstMeasure ? "sum" : "count");
    setSelectedColumn(
      firstMeasure?.name ?? profile.columns_profile[0]?.name ?? ""
    );
    setGroupBy("");
    setResult(null);
    setExecutionError(null);
  }, [profile.dataset_id, profile.columns_profile]);

  useEffect(() => {
    if (
      availableMeasureColumns.length > 0 &&
      !availableMeasureColumns.some(
        (column) => column.name === selectedColumn
      )
    ) {
      setSelectedColumn(availableMeasureColumns[0].name);
    }
  }, [aggregation, availableMeasureColumns, selectedColumn]);

  async function handleExecute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedColumn) {
      setExecutionError("Select a column before executing the analysis.");
      return;
    }

    setExecuting(true);
    setExecutionError(null);
    setResult(null);

    try {
      const response = await executeDatasetAnalytics(profile.dataset_id, {
        operation: "kpi",
        column: selectedColumn,
        aggregation,
        group_by: groupBy || null,
      });

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

  return (
    <section
      aria-labelledby="analytics-execution-heading"
      className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-7"
    >
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-400">
          Stage 10 · Analytics Execution
        </p>

        <h3
          id="analytics-execution-heading"
          className="mt-2 text-2xl font-semibold"
        >
          Execute Analytics
        </h3>

        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--foreground-secondary)]">
          Select a column, choose an aggregation, and optionally group the
          results. Calculations run against the uploaded dataset without
          modifying the original data.
        </p>
      </div>

      {allColumns.length === 0 ? (
        <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/5 p-4 text-sm">
          No columns are available for analysis.
        </div>
      ) : (
        <form onSubmit={handleExecute} className="space-y-5">
          <div className="grid gap-5 md:grid-cols-3">
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

              {aggregation !== "count" && (
                <p className="mt-2 text-xs text-[var(--foreground-secondary)]">
                  Numeric measure columns are available for this aggregation.
                </p>
              )}
            </div>

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
                availableMeasureColumns.length === 0
              }
              className="inline-flex items-center justify-center rounded-lg bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {executing ? "Executing..." : "Execute Analysis"}
            </button>
          </div>
        </form>
      )}

      {executing && (
        <div
          role="status"
          className="mt-6 rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-4 text-sm text-[var(--foreground-secondary)]"
        >
          Executing the requested calculation...
        </div>
      )}

      {executionError && (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-red-500/40 bg-red-500/5 p-4 text-sm text-red-700 dark:text-red-300"
        >
          <p className="font-semibold">Analytics execution failed</p>
          <p className="mt-1">{executionError}</p>
        </div>
      )}

      {result && (
        <div className="mt-8 space-y-5 border-t border-[var(--border)] pt-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--foreground-secondary)]">
              Execution result
            </p>

            <h4 className="mt-2 text-lg font-semibold">
              {formatAggregation(result.aggregation)} of {result.column}
              {"groups" in result ? ` by ${result.group_by}` : ""}
            </h4>
          </div>

          {!isGroupedResult(result) ? (
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
                  { label: "Valid values", value: result.valid_value_count },
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
        </div>
      )}
    </section>
  );
}
