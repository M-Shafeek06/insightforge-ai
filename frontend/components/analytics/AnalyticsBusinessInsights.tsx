"use client";

import { useMemo } from "react";
import type {
  AnalyticsExecutionGroup,
  GroupedAnalyticsExecutionResponse,
} from "@/lib/api/execution";

type Props = {
  result: GroupedAnalyticsExecutionResponse;
};

type ValidGroup = AnalyticsExecutionGroup & {
  value: number;
};

type Insight = {
  title: string;
  description: string;
};

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
      return "sum";
    case "average":
      return "average";
    case "count":
      return "count of non-null values";
  }
}

function getValidGroups(groups: AnalyticsExecutionGroup[]): ValidGroup[] {
  return groups.filter(
    (group): group is ValidGroup =>
      typeof group.value === "number" && Number.isFinite(group.value)
  );
}

function buildInsights(
  result: GroupedAnalyticsExecutionResponse,
  validGroups: ValidGroup[]
): Insight[] {
  if (validGroups.length === 0) {
    return [];
  }

  let highestValue = validGroups[0].value;
  let lowestValue = validGroups[0].value;

  for (const group of validGroups) {
    if (group.value > highestValue) {
      highestValue = group.value;
    }

    if (group.value < lowestValue) {
      lowestValue = group.value;
    }
  }

  const highestGroups = validGroups.filter(
    (group) => group.value === highestValue
  );

  const lowestGroups = validGroups.filter(
    (group) => group.value === lowestValue
  );

  const aggregationLabel = formatAggregation(result.aggregation);
  const items: Insight[] = [];

  if (highestValue === lowestValue) {
    items.push({
      title: "Equal calculated values",
      description:
        `All ${validGroups.length.toLocaleString()} groups with valid results ` +
        `have the same ${aggregationLabel}: ${formatNumber(highestValue)}.`,
    });
  } else {
    items.push({
      title: "Highest calculated value",
      description:
        `${highestGroups.map((group) => formatGroup(group.group)).join(", ")} ` +
        `has the highest ${aggregationLabel} of ${formatNumber(highestValue)}.`,
    });

    items.push({
      title: "Lowest calculated value",
      description:
        `${lowestGroups.map((group) => formatGroup(group.group)).join(", ")} ` +
        `has the lowest ${aggregationLabel} of ${formatNumber(lowestValue)}.`,
    });

    items.push({
      title: "Difference between extremes",
      description:
        `The absolute difference between the highest and lowest ` +
        `calculated values is ${formatNumber(highestValue - lowestValue)}.`,
    });
  }

  if (validGroups.length === 1) {
    items.push({
      title: "Limited comparison",
      description:
        "Only one group has a valid calculated value. A comparison between " +
        "different groups is not available.",
    });
  }

  const excludedCount = result.groups.length - validGroups.length;

  if (excludedCount > 0) {
    items.push({
      title: "Incomplete group results",
      description:
        `${excludedCount.toLocaleString()} of ` +
        `${result.groups.length.toLocaleString()} groups have unavailable ` +
        "or non-finite calculated values and were excluded from the comparison.",
    });
  }

  return items;
}

export default function AnalyticsBusinessInsights({ result }: Props) {
  const validGroups = useMemo(
    () => getValidGroups(result.groups),
    [result.groups]
  );

  const insights = useMemo(
    () => buildInsights(result, validGroups),
    [result, validGroups]
  );

  return (
    <section
      aria-labelledby="analytics-insights-heading"
      className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-4 sm:p-5"
    >
      <div>
        <h5 id="analytics-insights-heading" className="font-semibold">
          Business Insights
        </h5>

        <p className="mt-1 text-sm text-[var(--foreground-secondary)]">
          Deterministic observations derived from the calculated results for{" "}
          {result.column}, grouped by {result.group_by}.
        </p>
      </div>

      {insights.length === 0 ? (
        <p className="text-sm text-[var(--foreground-secondary)]">
          No valid calculated group results are available to generate insights.
          Review the results table for group-level details.
        </p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {insights.map((insight) => (
            <li
              key={insight.title}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4"
            >
              <h6 className="text-sm font-semibold">{insight.title}</h6>
              <p className="mt-2 break-words text-sm leading-6 text-[var(--foreground-secondary)]">
                {insight.description}
              </p>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs leading-5 text-[var(--foreground-secondary)]">
        These observations describe calculated values only. They do not
        establish business causes, profitability, or overall performance.
      </p>
    </section>
  );
}
