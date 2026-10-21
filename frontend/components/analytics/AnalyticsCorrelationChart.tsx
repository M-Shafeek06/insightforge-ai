"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { Config, Data, Layout } from "plotly.js";
import { useTheme } from "@/components/theme/ThemeProvider";
import type { CorrelationAnalyticsResponse } from "@/lib/api/execution";

type Props = {
  result: CorrelationAnalyticsResponse;
};

const Plot = dynamic(() => import("react-plotly.js"), {
  ssr: false,
  loading: () => (
    <div
      className="flex min-h-80 items-center justify-center text-sm text-[var(--foreground-secondary)]"
      role="status"
    >
      Loading correlation chart...
    </div>
  ),
});

function formatNumber(value: number): string {
  return value.toLocaleString(undefined, {
    maximumFractionDigits: 4,
  });
}

export default function AnalyticsCorrelationChart({ result }: Props) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const validPoints = useMemo(
    () =>
      result.points.filter(
        (point) =>
          Number.isFinite(point.x) && Number.isFinite(point.y)
      ),
    [result.points]
  );

  const regression = useMemo(() => {
    if (validPoints.length < 2) {
      return null;
    }

    const meanX =
      validPoints.reduce((total, point) => total + point.x, 0) /
      validPoints.length;
    const meanY =
      validPoints.reduce((total, point) => total + point.y, 0) /
      validPoints.length;

    let covarianceNumerator = 0;
    let varianceNumerator = 0;

    for (const point of validPoints) {
      const differenceX = point.x - meanX;
      covarianceNumerator += differenceX * (point.y - meanY);
      varianceNumerator += differenceX * differenceX;
    }

    if (
      varianceNumerator === 0 ||
      !Number.isFinite(varianceNumerator) ||
      !Number.isFinite(covarianceNumerator)
    ) {
      return null;
    }

    const slope = covarianceNumerator / varianceNumerator;
    const intercept = meanY - slope * meanX;

    const minX = Math.min(...validPoints.map((point) => point.x));
    const maxX = Math.max(...validPoints.map((point) => point.x));

    const lineY = (x: number) => slope * x + intercept;
    const firstY = lineY(minX);
    const lastY = lineY(maxX);

    if (
      !Number.isFinite(firstY) ||
      !Number.isFinite(lastY)
    ) {
      return null;
    }

    return {
      x: [minX, maxX],
      y: [firstY, lastY],
    };
  }, [validPoints]);

  const data = useMemo<Data[]>(() => {
    const traces: Data[] = [
      {
        type: "scatter",
        mode: "markers",
        name: "Observations",
        x: validPoints.map((point) => point.x),
        y: validPoints.map((point) => point.y),
        marker: {
          color: isDark ? "#22d3ee" : "#0891b2",
          size: 7,
          opacity: 0.75,
          line: {
            width: 0.5,
            color: isDark ? "#a5f3fc" : "#164e63",
          },
        },
        hovertemplate:
          `<b>${result.column}</b>: %{x:,.6g}<br>` +
          `<b>${result.second_column}</b>: %{y:,.6g}` +
          "<extra></extra>",
      },
    ];

    if (regression) {
      traces.push({
        type: "scatter",
        mode: "lines",
        name: "Linear trendline",
        x: regression.x,
        y: regression.y,
        line: {
          color: isDark ? "#fbbf24" : "#d97706",
          width: 2.5,
        },
        hovertemplate:
          `<b>${result.column}</b>: %{x:,.6g}<br>` +
          `<b>Trend estimate</b>: %{y:,.6g}` +
          "<extra></extra>",
      });
    }

    return traces;
  }, [
    validPoints,
    regression,
    isDark,
    result.column,
    result.second_column,
  ]);

  const layout = useMemo<Partial<Layout>>(
    () => ({
      autosize: true,
      height: 430,
      margin: {
        l: 80,
        r: 28,
        t: 30,
        b: 90,
      },
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: {
        color: isDark ? "#f9fafb" : "#111827",
        family: "Arial, Helvetica, sans-serif",
        size: 12,
      },
      showlegend: true,
      legend: {
        orientation: "h",
        y: -0.24,
        x: 0,
      },
      hoverlabel: {
        bgcolor: isDark ? "#181818" : "#ffffff",
        font: {
          color: isDark ? "#f9fafb" : "#111827",
        },
      },
      xaxis: {
        title: {
          text: result.column,
          standoff: 16,
        },
        automargin: true,
        gridcolor: isDark ? "#303030" : "#e5e7eb",
        zerolinecolor: isDark ? "#525252" : "#cbd5e1",
      },
      yaxis: {
        title: {
          text: result.second_column,
          standoff: 12,
        },
        automargin: true,
        gridcolor: isDark ? "#303030" : "#e5e7eb",
        zerolinecolor: isDark ? "#525252" : "#cbd5e1",
      },
    }),
    [isDark, result.column, result.second_column]
  );

  const config = useMemo<Partial<Config>>(
    () => ({
      responsive: true,
      displaylogo: false,
    }),
    []
  );

  return (
    <section
      aria-labelledby="correlation-chart-heading"
      className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-4 sm:p-5"
    >
      <div>
        <h5 id="correlation-chart-heading" className="font-semibold">
          Relationship between {result.column} and {result.second_column}
        </h5>

        <p className="mt-1 text-sm text-[var(--foreground-secondary)]">
          Pearson correlation: {result.correlation.toFixed(4)}
          {" · "}
          {result.observation_count.toLocaleString()} valid paired observations
        </p>
      </div>

      {result.sampled && (
        <p className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs text-[var(--foreground-secondary)]">
          The chart displays a deterministic sample of{" "}
          {validPoints.length.toLocaleString()} observations. The Pearson
          coefficient and observation count are calculated using all valid
          paired observations.
        </p>
      )}

      {validPoints.length < 2 ? (
        <p className="rounded-lg border border-[var(--border)] p-4 text-sm text-[var(--foreground-secondary)]">
          There are not enough valid chart points to display this relationship.
        </p>
      ) : (
        <Plot
          data={data}
          layout={layout}
          config={config}
          useResizeHandler
          style={{ width: "100%", height: "100%" }}
        />
      )}

      <p className="text-xs leading-5 text-[var(--foreground-secondary)]">
        Each point represents one valid pair. The trendline illustrates the
        linear pattern; correlation does not establish causation.
      </p>
    </section>
  );
}
