import type {
  AnalyticsExecutionGroup,
  AnalyticsExecutionResult,
  ExecutionAggregation,
} from "@/lib/api/execution";

export type BusinessInsightCategory =
  | "finding"
  | "interpretation"
  | "next_question"
  | "data_quality";

export type BusinessInsight = {
  id: string;
  category: BusinessInsightCategory;
  title: string;
  description: string;
  evidence?: string;
};

function formatNumber(value: number): string {
  return value.toLocaleString(undefined, {
    maximumFractionDigits: 4,
  });
}

function formatGroup(
  value: string | number | boolean | null
): string {
  if (value === null) {
    return "(Missing value)";
  }

  if (typeof value === "boolean") {
    return value ? "True" : "False";
  }

  return String(value);
}

function formatAggregation(
  aggregation: ExecutionAggregation
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

function createInsight(
  id: string,
  category: BusinessInsightCategory,
  title: string,
  description: string,
  evidence?: string
): BusinessInsight {
  return {
    id,
    category,
    title,
    description,
    ...(evidence ? { evidence } : {}),
  };
}

function getValidGroups(
  groups: AnalyticsExecutionGroup[]
): Array<AnalyticsExecutionGroup & { value: number }> {
  return groups.filter(
    (group): group is AnalyticsExecutionGroup & { value: number } =>
      typeof group.value === "number" && Number.isFinite(group.value)
  );
}

function getExtremes(
  groups: Array<AnalyticsExecutionGroup & { value: number }>
) {
  if (groups.length === 0) {
    return null;
  }

  let highest = groups[0].value;
  let lowest = groups[0].value;

  for (const group of groups) {
    highest = Math.max(highest, group.value);
    lowest = Math.min(lowest, group.value);
  }

  return {
    highest,
    lowest,
    highestGroups: groups.filter((group) => group.value === highest),
    lowestGroups: groups.filter((group) => group.value === lowest),
  };
}

function buildKpiInsights(
  result: Extract<AnalyticsExecutionResult, { operation: "kpi" }>
): BusinessInsight[] {
  const insights: BusinessInsight[] = [];

  if ("groups" in result) {
    const validGroups = getValidGroups(result.groups);
    const extremes = getExtremes(validGroups);

    if (extremes) {
      if (extremes.highest === extremes.lowest) {
        insights.push(
          createInsight(
            "kpi-equal-groups",
            "finding",
            "Equal calculated values",
            `All ${validGroups.length.toLocaleString()} groups with valid results have the same ${formatAggregation(result.aggregation)}: ${formatNumber(extremes.highest)}.`,
            `${validGroups.length.toLocaleString()} valid groups`
          )
        );
      } else {
        insights.push(
          createInsight(
            "kpi-highest-group",
            "finding",
            "Highest calculated value",
            `${extremes.highestGroups.map((group) => formatGroup(group.group)).join(", ")} has the highest ${formatAggregation(result.aggregation)}.`,
            formatNumber(extremes.highest)
          ),
          createInsight(
            "kpi-lowest-group",
            "finding",
            "Lowest calculated value",
            `${extremes.lowestGroups.map((group) => formatGroup(group.group)).join(", ")} has the lowest ${formatAggregation(result.aggregation)}.`,
            formatNumber(extremes.lowest)
          ),
          createInsight(
            "kpi-group-difference",
            "interpretation",
            "Difference between extremes",
            "The absolute difference between the highest and lowest valid group results summarizes the observed spread. It does not explain the cause of the difference.",
            formatNumber(extremes.highest - extremes.lowest)
          )
        );
      }

      if (validGroups.length === 1) {
        insights.push(
          createInsight(
            "kpi-limited-comparison",
            "interpretation",
            "Limited comparison",
            "Only one group has a valid calculated value, so a comparison between multiple valid groups is unavailable."
          )
        );
      }

      insights.push(
        createInsight(
          "kpi-group-follow-up",
          "next_question",
          "Next question",
          `What factors might explain the observed differences in ${result.column} across ${result.group_by}?`
        )
      );
    }

    // Report missing measure values even when the affected group
    // still has a valid calculated result.
    const groupsWithNullValues = result.groups.filter(
      (group) => group.null_count > 0
    );

    const totalNullValues = result.groups.reduce(
      (total, group) => total + group.null_count,
      0
    );

    if (totalNullValues > 0) {
      insights.push(
        createInsight(
          "kpi-group-null-values",
          "data_quality",
          "Missing measure values",
          `${totalNullValues.toLocaleString()} null measure values were found across ${groupsWithNullValues.length.toLocaleString()} of ${result.groups.length.toLocaleString()} groups. Interpret the calculated results in light of this data coverage.`,
          `${totalNullValues.toLocaleString()} null values across ${groupsWithNullValues.length.toLocaleString()} groups`
        )
      );
    }

    const excludedCount = result.groups.length - validGroups.length;

    if (excludedCount > 0) {
      insights.push(
        createInsight(
          "kpi-invalid-groups",
          "data_quality",
          "Unavailable group results",
          `${excludedCount.toLocaleString()} of ${result.groups.length.toLocaleString()} groups have unavailable or non-finite results and were excluded from comparisons.`
        )
      );
    }

    if (validGroups.length === 0) {
      insights.push(
        createInsight(
          "kpi-no-valid-groups",
          "data_quality",
          "No valid group results",
          "No finite calculated group values are available for comparison."
        )
      );
    }

    return insights;
  }

  insights.push(
    createInsight(
      "kpi-calculated-value",
      "finding",
      "Calculated KPI",
      `The ${formatAggregation(result.aggregation)} of ${result.column} is ${formatNumber(result.value)}.`,
      `${result.valid_value_count.toLocaleString()} valid values out of ${result.row_count.toLocaleString()} rows`
    )
  );

  if (result.null_count > 0) {
    insights.push(
      createInsight(
        "kpi-null-values",
        "data_quality",
        "Missing measure values",
        `${result.null_count.toLocaleString()} rows have null values for ${result.column}. Interpret the KPI with this data coverage in mind.`,
        `${result.valid_value_count.toLocaleString()} valid values out of ${result.row_count.toLocaleString()} rows`
      )
    );
  }

  insights.push(
    createInsight(
      "kpi-follow-up",
      "next_question",
      "Next question",
      `How does this ${result.column} KPI compare with another period, segment, or relevant business target?`
    )
  );

  return insights;
}

function buildDescriptiveInsights(
  result: Extract<AnalyticsExecutionResult, { operation: "descriptive" }>
): BusinessInsight[] {
  const insights: BusinessInsight[] = [];
  const stats = result.statistics;

  if (result.valid_value_count === 0) {
    return [
      createInsight(
        "descriptive-no-valid-values",
        "data_quality",
        "No valid values",
        `No valid observations are available to interpret ${result.column}.`
      ),
    ];
  }

  insights.push(
    createInsight(
      "descriptive-central-tendency",
      "finding",
      "Mean and median",
      `The mean is ${formatNumber(stats.mean)} and the median is ${formatNumber(stats.median)}.`,
      `Mean: ${formatNumber(stats.mean)}; median: ${formatNumber(stats.median)}`
    )
  );

  if (stats.mean > stats.median) {
    insights.push(
      createInsight(
        "descriptive-mean-above-median",
        "interpretation",
        "Mean exceeds median",
        "The mean is higher than the median. This can occur when higher observations pull the mean upward, but the distribution should be examined before drawing conclusions."
      )
    );
  } else if (stats.mean < stats.median) {
    insights.push(
      createInsight(
        "descriptive-mean-below-median",
        "interpretation",
        "Mean is below median",
        "The mean is lower than the median. This can occur when lower observations pull the mean downward, but the distribution should be examined before drawing conclusions."
      )
    );
  } else {
    insights.push(
      createInsight(
        "descriptive-mean-equals-median",
        "interpretation",
        "Mean equals median",
        "The mean and median are equal at the reported precision. This alone does not establish that the distribution is symmetric."
      )
    );
  }

  const range = stats.maximum - stats.minimum;

  insights.push(
    createInsight(
      "descriptive-range",
      "finding",
      "Observed range",
      `The observed values span from ${formatNumber(stats.minimum)} to ${formatNumber(stats.maximum)}.`,
      `Range: ${formatNumber(range)}`
    )
  );

  if (stats.standard_deviation !== null) {
    insights.push(
      createInsight(
        "descriptive-variability",
        "finding",
        "Standard deviation",
        `The reported standard deviation is ${formatNumber(stats.standard_deviation)}. It describes dispersion around the mean in the measure's original units.`,
        `Standard deviation: ${formatNumber(stats.standard_deviation)}`
      )
    );
  } else {
    insights.push(
      createInsight(
        "descriptive-insufficient-variation",
        "interpretation",
        "Standard deviation unavailable",
        "A standard deviation could not be reported for this result. Check the number of valid observations."
      )
    );
  }

  if (result.null_count > 0) {
    insights.push(
      createInsight(
        "descriptive-null-values",
        "data_quality",
        "Missing observations",
        `${result.null_count.toLocaleString()} of ${result.row_count.toLocaleString()} rows have null values for ${result.column}. The statistics are based on valid observations.`,
        `${result.valid_value_count.toLocaleString()} valid observations out of ${result.row_count.toLocaleString()} rows`
      )
    );
  }

  insights.push(
    createInsight(
      "descriptive-follow-up",
      "next_question",
      "Next question",
      `Do the distribution and variability of ${result.column} differ across time periods or segments?`
    )
  );

  return insights;
}

function buildTrendInsights(
  result: Extract<AnalyticsExecutionResult, { operation: "trend" }>
): BusinessInsight[] {
  const insights: BusinessInsight[] = [];

  const validPoints = result.points.filter(
    (point): point is typeof point & { value: number } =>
      typeof point.value === "number" && Number.isFinite(point.value)
  );

  if (validPoints.length === 0) {
    return [
      createInsight(
        "trend-no-valid-values",
        "data_quality",
        "No valid trend values",
        "No finite period values are available to describe the trend."
      ),
    ];
  }

  const first = validPoints[0];
  const last = validPoints[validPoints.length - 1];
  const change = last.value - first.value;
  const absoluteChange = Math.abs(change);

  insights.push(
    createInsight(
      "trend-first-last",
      "finding",
      "First and last valid periods",
      `The ${result.column} ${formatAggregation(result.aggregation)} changed from ${formatNumber(first.value)} in ${first.period} to ${formatNumber(last.value)} in ${last.period}.`,
      `Absolute change: ${formatNumber(absoluteChange)}`
    )
  );

  if (change > 0) {
    insights.push(
      createInsight(
        "trend-direction",
        "interpretation",
        "Increase across observed endpoints",
        "The last valid period is higher than the first valid period. This endpoint comparison does not establish that every intervening period increased."
      )
    );
  } else if (change < 0) {
    insights.push(
      createInsight(
        "trend-direction",
        "interpretation",
        "Decrease across observed endpoints",
        "The last valid period is lower than the first valid period. This endpoint comparison does not establish that every intervening period decreased."
      )
    );
  } else {
    insights.push(
      createInsight(
        "trend-direction",
        "interpretation",
        "Equal endpoint values",
        "The first and last valid periods have the same value, although values between those periods may differ."
      )
    );
  }

  const invalidPoints = result.points.length - validPoints.length;

  if (invalidPoints > 0) {
    insights.push(
      createInsight(
        "trend-invalid-periods",
        "data_quality",
        "Periods without valid results",
        `${invalidPoints.toLocaleString()} of ${result.points.length.toLocaleString()} returned periods have unavailable or non-finite values.`
      )
    );
  }

  // Count null measure values across every returned period, including
  // periods whose calculated value is unavailable.
  const nullCount = result.points.reduce(
    (total, point) => total + point.null_count,
    0
  );

  if (nullCount > 0) {
    insights.push(
      createInsight(
        "trend-null-values",
        "data_quality",
        "Missing measure values",
        `${nullCount.toLocaleString()} null measure values are recorded across the returned periods. Calculated trends should be interpreted in light of this data coverage.`
      )
    );
  }

  insights.push(
    createInsight(
      "trend-follow-up",
      "next_question",
      "Next question",
      `Does the observed change in ${result.column} persist when the results are examined at another time interval or across different segments?`
    )
  );

  return insights;
}

function buildSegmentInsights(
  result: Extract<AnalyticsExecutionResult, { operation: "segment_comparison" }>
): BusinessInsight[] {
  const insights: BusinessInsight[] = [];
  const validGroups = getValidGroups(result.segments);
  const extremes = getExtremes(validGroups);

  if (!extremes) {
    insights.push(
      createInsight(
        "segment-no-valid-results",
        "data_quality",
        "No valid segment results",
        "No finite calculated segment values are available for comparison."
      )
    );
  } else {
    if (extremes.highest === extremes.lowest) {
      insights.push(
        createInsight(
          "segment-equal-values",
          "finding",
          "Equal segment values",
          `All ${validGroups.length.toLocaleString()} segments with valid results have the same ${formatAggregation(result.aggregation)}: ${formatNumber(extremes.highest)}.`
        )
      );
    } else {
      insights.push(
        createInsight(
          "segment-highest",
          "finding",
          "Highest calculated segment",
          `${extremes.highestGroups.map((group) => formatGroup(group.group)).join(", ")} has the highest calculated value.`,
          formatNumber(extremes.highest)
        ),
        createInsight(
          "segment-lowest",
          "finding",
          "Lowest calculated segment",
          `${extremes.lowestGroups.map((group) => formatGroup(group.group)).join(", ")} has the lowest calculated value.`,
          formatNumber(extremes.lowest)
        ),
        createInsight(
          "segment-difference",
          "interpretation",
          "Difference between extremes",
          "The difference summarizes the spread between the highest and lowest valid segment results; it does not explain the reason for that spread.",
          formatNumber(extremes.highest - extremes.lowest)
        )
      );
    }
  }

  const invalidCount = result.segments.length - validGroups.length;

  if (invalidCount > 0) {
    insights.push(
      createInsight(
        "segment-invalid-results",
        "data_quality",
        "Unavailable segment results",
        `${invalidCount.toLocaleString()} of ${result.segments.length.toLocaleString()} segments have unavailable or non-finite values and were excluded from comparisons.`
      )
    );
  }

  const nullCount = result.segments.reduce(
    (total, segment) => total + segment.null_count,
    0
  );

  if (nullCount > 0) {
    insights.push(
      createInsight(
        "segment-null-values",
        "data_quality",
        "Missing measure values",
        `${nullCount.toLocaleString()} null measure values are recorded across the returned segments. Interpret the calculated results in light of this data coverage.`,
        `${result.segments.reduce((total, segment) => total + segment.valid_value_count, 0).toLocaleString()} valid values across returned segments`
      )
    );
  }

  if (extremes) {
    insights.push(
      createInsight(
        "segment-follow-up",
        "next_question",
        "Next question",
        `What differences in context or underlying records might help explain the variation in ${result.column} across ${result.segment_by}?`
      )
    );
  }

  return insights;
}

function buildCorrelationInsights(
  result: Extract<AnalyticsExecutionResult, { operation: "correlation" }>
): BusinessInsight[] {
  const insights: BusinessInsight[] = [];

  const direction =
    result.correlation > 0
      ? "positive"
      : result.correlation < 0
        ? "negative"
        : "no linear direction";

  insights.push(
    createInsight(
      "correlation-result",
      "finding",
      "Observed linear association",
      `${result.column} and ${result.second_column} have a ${result.strength} ${direction} linear association in the calculated result.`,
      `Pearson r = ${result.correlation.toFixed(4)}; paired observations = ${result.observation_count.toLocaleString()}`
    )
  );

  insights.push(
    createInsight(
      "correlation-interpretation",
      "interpretation",
      "Interpret with care",
      "Pearson correlation describes linear association. It does not establish causation, rule out confounding factors, or capture every possible nonlinear relationship."
    )
  );

  if (result.observation_count < 10) {
    insights.push(
      createInsight(
        "correlation-small-sample",
        "data_quality",
        "Limited paired observations",
        `The correlation is based on ${result.observation_count.toLocaleString()} paired observations. Treat the result cautiously and inspect additional data before drawing broader conclusions.`
      )
    );
  }

  if (result.sampled) {
    insights.push(
      createInsight(
        "correlation-sampled-chart",
        "interpretation",
        "Chart sampling",
        "The scatter plot displays a sample of the valid pairs for readability. The reported correlation is calculated from all valid paired observations."
      )
    );
  }

  insights.push(
    createInsight(
      "correlation-follow-up",
      "next_question",
      "Next question",
      `Does the observed relationship between ${result.column} and ${result.second_column} remain similar across different segments or time periods?`
    )
  );

  return insights;
}

export function generateBusinessInsights(
  result: AnalyticsExecutionResult
): BusinessInsight[] {
  switch (result.operation) {
    case "kpi":
      return buildKpiInsights(result);

    case "descriptive":
      return buildDescriptiveInsights(result);

    case "trend":
      return buildTrendInsights(result);

    case "segment_comparison":
      return buildSegmentInsights(result);

    case "correlation":
      return buildCorrelationInsights(result);
  }
}

export function getBusinessInsightSummary(
  insights: BusinessInsight[]
): Record<BusinessInsightCategory, number> {
  return {
    finding: insights.filter((item) => item.category === "finding").length,

    interpretation: insights.filter(
      (item) => item.category === "interpretation"
    ).length,

    next_question: insights.filter(
      (item) => item.category === "next_question"
    ).length,

    data_quality: insights.filter(
      (item) => item.category === "data_quality"
    ).length,
  };
}