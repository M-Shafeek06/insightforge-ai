"use client";

import { useMemo } from "react";
import type { AnalyticsExecutionResult } from "@/lib/api/execution";
import {
  generateBusinessInsights,
  getBusinessInsightSummary,
  type BusinessInsightCategory,
} from "@/lib/analytics/business-insights";

type Props = {
  result: AnalyticsExecutionResult;
};

const CATEGORY_CONFIG: Record<
  BusinessInsightCategory,
  { title: string; description: string }
> = {
  finding: {
    title: "Findings",
    description: "What the calculated results show.",
  },
  interpretation: {
    title: "Interpretation",
    description: "What the observations mean within the limits of this analysis.",
  },
  next_question: {
    title: "Questions to investigate",
    description: "Questions that can guide the next analytical step.",
  },
  data_quality: {
    title: "Data quality and limitations",
    description: "Important data coverage and interpretation limitations.",
  },
};

const CATEGORY_ORDER: BusinessInsightCategory[] = [
  "finding",
  "interpretation",
  "data_quality",
  "next_question",
];

function getAnalysisDescription(result: AnalyticsExecutionResult): string {
  switch (result.operation) {
    case "kpi":
      return "Observations generated from the calculated KPI results.";
    case "descriptive":
      return `Distribution and variability observations for ${result.column}.`;
    case "trend":
      return `Time-based observations for ${result.column}, using ${result.interval} intervals.`;
    case "segment_comparison":
      return `Comparison observations for ${result.column}, grouped by ${result.segment_by}.`;
    case "correlation":
      return `Relationship observations for ${result.column} and ${result.second_column}.`;
  }
}

export default function AnalyticsBusinessInsights({ result }: Props) {
  const insights = useMemo(
    () => generateBusinessInsights(result),
    [result]
  );

  const summary = useMemo(
    () => getBusinessInsightSummary(insights),
    [insights]
  );

  const groupedInsights = useMemo(
    () =>
      CATEGORY_ORDER.map((category) => ({
        category,
        ...CATEGORY_CONFIG[category],
        items: insights.filter((insight) => insight.category === category),
      })).filter((group) => group.items.length > 0),
    [insights]
  );

  return (
    <section
      aria-labelledby="analytics-insights-heading"
      className="space-y-5 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-4 sm:p-5"
    >
      <div className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h5
              id="analytics-insights-heading"
              className="font-semibold"
            >
              Business Insights &amp; Decision Support
            </h5>

            <p className="mt-1 text-sm text-[var(--foreground-secondary)]">
              {getAnalysisDescription(result)}
            </p>
          </div>

          <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-medium">
            Deterministic analysis
          </span>
        </div>

        <div
          className="flex flex-wrap gap-2"
          aria-label="Insight summary"
        >
          {[
            { label: "Findings", value: summary.finding },
            { label: "Interpretations", value: summary.interpretation },
            { label: "Data limitations", value: summary.data_quality },
            { label: "Next questions", value: summary.next_question },
          ].map((item) => (
            <span
              key={item.label}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--foreground-secondary)]"
            >
              <span className="font-semibold text-[var(--foreground)]">
                {item.value.toLocaleString()}
              </span>{" "}
              {item.label}
            </span>
          ))}
        </div>
      </div>

      {insights.length === 0 ? (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
          <h6 className="text-sm font-semibold">
            No insights available
          </h6>

          <p className="mt-2 text-sm leading-6 text-[var(--foreground-secondary)]">
            The current result does not contain enough valid information to
            generate a supported observation. Review the calculation results
            and data coverage before drawing conclusions.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {groupedInsights.map((group) => (
            <div key={group.category} className="space-y-3">
              <div>
                <h6 className="text-sm font-semibold">
                  {group.title}
                </h6>

                <p className="mt-1 text-xs text-[var(--foreground-secondary)]">
                  {group.description}
                </p>
              </div>

              <ul className="grid gap-3 md:grid-cols-2">
                {group.items.map((insight) => (
                  <li
                    key={insight.id}
                    className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4"
                  >
                    <h6 className="text-sm font-semibold">
                      {insight.title}
                    </h6>

                    <p className="mt-2 break-words text-sm leading-6 text-[var(--foreground-secondary)]">
                      {insight.description}
                    </p>

                    {insight.evidence && (
                      <div className="mt-3 border-t border-[var(--border)] pt-3">
                        <p className="text-xs font-medium text-[var(--foreground-secondary)]">
                          Supporting evidence
                        </p>

                        <p className="mt-1 break-words text-sm font-semibold">
                          {insight.evidence}
                        </p>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <p className="border-t border-[var(--border)] pt-4 text-xs leading-5 text-[var(--foreground-secondary)]">
        These insights summarize calculated observations. They do not establish
        causation, statistical significance, profitability, or overall business
        performance. Validate important decisions with relevant business
        context and additional evidence.
      </p>
    </section>
  );
}
