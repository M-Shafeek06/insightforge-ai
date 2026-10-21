"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { Config, Data, Layout } from "plotly.js";
import { useTheme } from "@/components/theme/ThemeProvider";
import type { TrendAnalyticsResponse } from "@/lib/api/execution";

type Props = {
  result: TrendAnalyticsResponse;
};

const Plot = dynamic(() => import("react-plotly.js"), {
  ssr: false,
  loading: () => (
    <div
      className="flex min-h-72 items-center justify-center text-sm text-[var(--foreground-secondary)]"
      role="status"
    >
      Loading trend chart...
    </div>
  ),
});

function formatNumber(value: number): string {
  return value.toLocaleString(undefined, {
    maximumFractionDigits: 4,
  });
}

function formatInterval(interval: TrendAnalyticsResponse["interval"]): string {
  switch (interval) {
    case "day":
      return "Daily";
    case "week":
      return "Weekly";
    case "month":
      return "Monthly";
    case "year":
      return "Yearly";
  }
}

function formatAggregation(
  aggregation: TrendAnalyticsResponse["aggregation"]
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

export default function AnalyticsTrendChart({ result }: Props) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const validPoints = useMemo(
    () =>
      result.points.filter(
        (point) => point.value !== null && Number.isFinite(point.value)
      ),
    [result.points]
  );

  const data = useMemo<Data[]>(
    () => [
      {
        type: "scatter",
        mode: "lines+markers",
        x: validPoints.map((point) => point.period),
        y: validPoints.map((point) => point.value as number),
        line: {
          color: isDark ? "#22d3ee" : "#0891b2",
          width: 3,
        },
        marker: {
          size: 8,
        },
        hovertemplate:
          "<b>%{x}</b><br>" +
          `${formatAggregation(result.aggregation)}: %{y:,.4f}` +
          "<extra></extra>",
      },
    ],
    [validPoints, isDark, result.aggregation]
  );

  const layout = useMemo<Partial<Layout>>(
    () => ({
      autosize: true,
      height: 380,
      margin: { l: 75, r: 25, t: 25, b: 90 },
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: {
        color: isDark ? "#f9fafb" : "#111827",
        family: "Arial, Helvetica, sans-serif",
        size: 12,
      },
      hoverlabel: {
        bgcolor: isDark ? "#181818" : "#ffffff",
        font: { color: isDark ? "#f9fafb" : "#111827" },
      },
      xaxis: {
        title: { text: "Period" },
        type: "date",
        automargin: true,
        tickangle: -35,
        tickformat:
            result.interval === "year"
            ? "%Y"
            : result.interval === "month"
                ? "%b %Y"
                : result.interval === "week"
                ? "%d %b %Y"
                : "%d %b %Y",
        dtick:
            result.interval === "year"
            ? "M12"
            : result.interval === "month"
                ? "M1"
                : undefined,
        gridcolor: isDark ? "#303030" : "#e5e7eb",
        },
      yaxis: {
        title: { text: formatAggregation(result.aggregation) },
        automargin: true,
        gridcolor: isDark ? "#303030" : "#e5e7eb",
        zerolinecolor: isDark ? "#525252" : "#cbd5e1",
      },
    }),
      [isDark, result.aggregation, result.interval]
  );

  const config = useMemo<Partial<Config>>(
    () => ({
      responsive: true,
      displaylogo: false,
    }),
    []
  );

  return (
    <section className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-4 sm:p-5">
      <div>
        <h5 className="font-semibold">
          {formatInterval(result.interval)} {result.column} trend
        </h5>

        <p className="mt-1 text-sm text-[var(--foreground-secondary)]">
          {formatAggregation(result.aggregation)} of {result.column}, grouped by{" "}
          {result.date_column}.
        </p>
      </div>

      {validPoints.length === 0 ? (
        <p className="rounded-lg border border-[var(--border)] p-4 text-sm text-[var(--foreground-secondary)]">
          No periods have valid results to visualize. The period-level results
          are still available below.
        </p>
      ) : (
        <div className="w-full min-w-0">
          <Plot
            data={data}
            layout={layout}
            config={config}
            useResizeHandler
            style={{ width: "100%", height: "380px" }}
          />
        </div>
      )}

      <p className="text-xs text-[var(--foreground-secondary)]">
        {validPoints.length.toLocaleString()} periods with valid results out of{" "}
        {result.points.length.toLocaleString()} returned periods.
      </p>
    </section>
  );
}