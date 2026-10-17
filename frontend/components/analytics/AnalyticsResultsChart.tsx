"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { Config, Data, Layout } from "plotly.js";
import { useTheme } from "@/components/theme/ThemeProvider";
import type { GroupedAnalyticsExecutionResponse } from "@/lib/api/execution";

type Props = {
  result: GroupedAnalyticsExecutionResponse;
};

const Plot = dynamic(() => import("react-plotly.js"), {
  ssr: false,
  loading: () => (
    <div
      className="flex min-h-72 items-center justify-center text-sm text-[var(--foreground-secondary)]"
      role="status"
    >
      Loading chart...
    </div>
  ),
});

function formatGroup(value: string | number | boolean | null): string {
  if (value === null) {
    return "(Missing value)";
  }

  if (typeof value === "boolean") {
    return value ? "True" : "False";
  }

  return String(value);
}

function formatNumber(value: number): string {
  return value.toLocaleString(undefined, {
    maximumFractionDigits: 4,
  });
}

function formatAggregation(
  aggregation: GroupedAnalyticsExecutionResponse["aggregation"]
): string {
  switch (aggregation) {
    case "sum":
      return "Sum";
    case "average":
      return "Average";
    case "count":
      return "Count";
  }
}

export default function AnalyticsResultsChart({ result }: Props) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const validGroups = useMemo(
    () =>
      result.groups
        .filter(
          (
            group
          ): group is typeof group & {
            value: number;
          } =>
            group.value !== null && Number.isFinite(group.value)
        )
        .sort((a, b) => b.value - a.value),
    [result.groups]
  );

  const chartGroups = validGroups.slice(0, 25);
  const excludedGroupCount = result.groups.length - validGroups.length;
  const hasMoreGroups = validGroups.length > chartGroups.length;

  const data = useMemo<Data[]>(
    () => [
      {
        type: "bar",
        orientation: "h",
        x: chartGroups.map((group) => group.value),
        y: chartGroups.map((group) => formatGroup(group.group)),
        marker: {
          color: isDark ? "#22d3ee" : "#0891b2",
        },
        text: chartGroups.map((group) => formatNumber(group.value)),
        textposition: "auto",
        hovertemplate:
          "<b>%{y}</b><br>" +
          `${formatAggregation(result.aggregation)}: %{x:,.4f}` +
          "<extra></extra>",
      },
    ],
    [chartGroups, isDark, result.aggregation]
  );

  const layout = useMemo<Partial<Layout>>(
    () => ({
      autosize: true,
      height: Math.max(320, chartGroups.length * 36 + 100),
      margin: {
        l: 120,
        r: 28,
        t: 20,
        b: 65,
      },
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: {
        color: isDark ? "#f9fafb" : "#111827",
        family: "Arial, Helvetica, sans-serif",
        size: 12,
      },
      showlegend: false,
      hoverlabel: {
        bgcolor: isDark ? "#181818" : "#ffffff",
        font: {
          color: isDark ? "#f9fafb" : "#111827",
        },
      },
      xaxis: {
        title: { text: formatAggregation(result.aggregation) },
        automargin: true,
        gridcolor: isDark ? "#303030" : "#e5e7eb",
        zerolinecolor: isDark ? "#525252" : "#cbd5e1",
      },
      yaxis: {
        title: { text: result.group_by },
        automargin: true,
        autorange: "reversed",
        gridcolor: isDark ? "#303030" : "#e5e7eb",
      },
    }),
    [chartGroups.length, isDark, result.aggregation, result.group_by]
  );

  const config = useMemo<Partial<Config>>(
    () => ({
      responsive: true,
      displaylogo: false,
    }),
    []
  );

  if (validGroups.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-5">
        <h5 className="font-semibold">Grouped results visualization</h5>
        <p className="mt-2 text-sm text-[var(--foreground-secondary)]">
          No groups have valid numeric results to visualize. The results table
          below retains the returned group details.
        </p>
      </div>
    );
  }

  return (
    <section
      aria-labelledby="analytics-chart-heading"
      className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-4 sm:p-5"
    >
      <div>
        <h5 id="analytics-chart-heading" className="font-semibold">
          {formatAggregation(result.aggregation)} by {result.group_by}
        </h5>

        <p className="mt-1 text-sm text-[var(--foreground-secondary)]">
          Comparing calculated values for {validGroups.length.toLocaleString()}{" "}
          groups with valid results.
        </p>
      </div>

      {hasMoreGroups && (
        <p className="text-xs text-[var(--foreground-secondary)]">
          Showing the 25 highest calculated values. The table below contains
          all returned groups.
        </p>
      )}

      {excludedGroupCount > 0 && (
        <p className="text-xs text-[var(--foreground-secondary)]">
          {excludedGroupCount.toLocaleString()} group
          {excludedGroupCount === 1 ? "" : "s"} with unavailable or
          non-finite results {excludedGroupCount === 1 ? "was" : "were"}{" "}
          excluded from the chart.
        </p>
      )}

      <div className="w-full min-w-0">
        <Plot
          data={data}
          layout={layout}
          config={config}
          useResizeHandler
          style={{
            width: "100%",
            height: `${Math.max(320, chartGroups.length * 36 + 100)}px`,
          }}
        />
      </div>
    </section>
  );
}

