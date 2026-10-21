"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { Config, Data, Layout } from "plotly.js";
import { useTheme } from "@/components/theme/ThemeProvider";
import type { SegmentComparisonResponse } from "@/lib/api/execution";

type Props = {
  result: SegmentComparisonResponse;
};

const Plot = dynamic(() => import("react-plotly.js"), {
  ssr: false,
  loading: () => (
    <div
      className="flex min-h-72 items-center justify-center text-sm text-[var(--foreground-secondary)]"
      role="status"
    >
      Loading segment comparison chart...
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
  aggregation: SegmentComparisonResponse["aggregation"]
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

export default function AnalyticsSegmentComparisonChart({
  result,
}: Props) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const validSegments = useMemo(
    () =>
      result.segments
        .filter(
          (
            segment
          ): segment is typeof segment & {
            value: number;
          } =>
            segment.value !== null && Number.isFinite(segment.value)
        )
        .sort((a, b) => b.value - a.value),
    [result.segments]
  );

  const chartSegments = validSegments.slice(0, 25);
  const hasMoreSegments = validSegments.length > chartSegments.length;
  const excludedSegmentCount =
    result.segments.length - validSegments.length;

  const data = useMemo<Data[]>(
    () => [
      {
        type: "bar",
        orientation: "h",
        x: chartSegments.map((segment) => segment.value),
        y: chartSegments.map((segment) => formatGroup(segment.group)),
        marker: {
          color: isDark ? "#22d3ee" : "#0891b2",
        },
        text: chartSegments.map((segment) =>
          formatNumber(segment.value)
        ),
        textposition: "auto",
        hovertemplate:
          "<b>%{y}</b><br>" +
          `${formatAggregation(result.aggregation)}: %{x:,.4f}` +
          "<extra></extra>",
      },
    ],
    [chartSegments, isDark, result.aggregation]
  );

  const chartHeight = Math.max(320, chartSegments.length * 36 + 100);

  const layout = useMemo<Partial<Layout>>(
    () => ({
      autosize: true,
      height: chartHeight,
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
        title: {
          text: formatAggregation(result.aggregation),
        },
        automargin: true,
        gridcolor: isDark ? "#303030" : "#e5e7eb",
        zerolinecolor: isDark ? "#525252" : "#cbd5e1",
      },
      yaxis: {
        title: {
          text: result.segment_by,
        },
        automargin: true,
        autorange: "reversed",
        gridcolor: isDark ? "#303030" : "#e5e7eb",
      },
    }),
    [chartHeight, isDark, result.aggregation, result.segment_by]
  );

  const config = useMemo<Partial<Config>>(
    () => ({
      responsive: true,
      displaylogo: false,
    }),
    []
  );

  if (validSegments.length === 0) {
    return (
      <section className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-4 sm:p-5">
        <h5 className="font-semibold">Segment comparison chart</h5>

        <p className="text-sm text-[var(--foreground-secondary)]">
          No segments have valid numeric results to visualize. The results
          table below retains the returned segment details.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="segment-comparison-chart-heading"
      className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-4 sm:p-5"
    >
      <div>
        <h5
          id="segment-comparison-chart-heading"
          className="font-semibold"
        >
          {formatAggregation(result.aggregation)} by {result.segment_by}
        </h5>

        <p className="mt-1 text-sm text-[var(--foreground-secondary)]">
          Comparing {result.column} across{" "}
          {validSegments.length.toLocaleString()} segments with valid results.
        </p>
      </div>

      {hasMoreSegments && (
        <p className="text-xs text-[var(--foreground-secondary)]">
          Showing the 25 highest calculated values. The table below contains
          all returned segments.
        </p>
      )}

      {excludedSegmentCount > 0 && (
        <p className="text-xs text-[var(--foreground-secondary)]">
          {excludedSegmentCount.toLocaleString()} segment
          {excludedSegmentCount === 1 ? "" : "s"} with unavailable or
          non-finite results{" "}
          {excludedSegmentCount === 1 ? "was" : "were"} excluded from the
          chart.
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
            height: `${chartHeight}px`,
          }}
        />
      </div>
    </section>
  );
}
