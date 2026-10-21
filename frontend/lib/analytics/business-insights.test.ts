import { describe, expect, it } from "vitest";

import {
  generateBusinessInsights,
  getBusinessInsightSummary,
} from "./business-insights";

import type { AnalyticsExecutionResult } from "@/lib/api/execution";

describe("generateBusinessInsights", () => {
  describe("Grouped KPI analysis", () => {
    const result: AnalyticsExecutionResult = {
      dataset_id: "test-dataset",
      operation: "kpi",
      column: "Revenue",
      aggregation: "sum",
      group_by: "Region",
      groups: [
        {
          group: "North",
          value: 1700,
          row_count: 2,
          valid_value_count: 2,
          null_count: 0,
        },
        {
          group: "South",
          value: 1200,
          row_count: 2,
          valid_value_count: 1,
          null_count: 1,
        },
        {
          group: "West",
          value: 650,
          row_count: 1,
          valid_value_count: 1,
          null_count: 0,
        },
      ],
    };

    it("identifies the highest and lowest groups", () => {
      const insights = generateBusinessInsights(result);

      expect(
        insights.find((item) => item.id === "kpi-highest-group")
          ?.description
      ).toContain("North");

      expect(
        insights.find((item) => item.id === "kpi-lowest-group")
          ?.description
      ).toContain("West");
    });

    it("calculates the difference between group extremes", () => {
      const insights = generateBusinessInsights(result);

      expect(
        insights.find((item) => item.id === "kpi-group-difference")
          ?.evidence
      ).toBe("1,050");
    });

    it("reports missing values across groups", () => {
      const insights = generateBusinessInsights(result);

      const missingValueInsight = insights.find(
        (item) => item.id === "kpi-group-null-values"
      );

      expect(missingValueInsight).toBeDefined();
      expect(missingValueInsight?.category).toBe("data_quality");
      expect(missingValueInsight?.description).toContain(
        "1 null measure values"
      );
      expect(missingValueInsight?.description).toContain(
        "1 of 3 groups"
      );
    });
  });

  describe("Ungrouped KPI analysis", () => {
    it("reports the calculated value and missing observations", () => {
      const result: AnalyticsExecutionResult = {
        dataset_id: "test-dataset",
        operation: "kpi",
        column: "Revenue",
        aggregation: "sum",
        value: 3550,
        row_count: 5,
        valid_value_count: 4,
        null_count: 1,
      };

      const insights = generateBusinessInsights(result);

      expect(
        insights.find((item) => item.id === "kpi-calculated-value")
          ?.description
      ).toContain("3,550");

      expect(
        insights.find((item) => item.id === "kpi-null-values")
      ).toBeDefined();
    });
  });

  describe("Descriptive statistics", () => {
    it("reports central tendency, range, variability, and missing observations", () => {
      const result: AnalyticsExecutionResult = {
        dataset_id: "test-dataset",
        operation: "descriptive",
        column: "Revenue",
        row_count: 5,
        valid_value_count: 4,
        null_count: 1,
        statistics: {
          mean: 25,
          median: 20,
          minimum: 10,
          maximum: 40,
          standard_deviation: 12.91,
        },
      };

      const insights = generateBusinessInsights(result);
      const ids = insights.map((item) => item.id);

      expect(ids).toContain("descriptive-central-tendency");
      expect(ids).toContain("descriptive-range");
      expect(ids).toContain("descriptive-variability");
      expect(ids).toContain("descriptive-null-values");
    });

    it("reports when no valid observations are available", () => {
      const result: AnalyticsExecutionResult = {
        dataset_id: "test-dataset",
        operation: "descriptive",
        column: "Revenue",
        row_count: 3,
        valid_value_count: 0,
        null_count: 3,
        statistics: {
          mean: 0,
          median: 0,
          minimum: 0,
          maximum: 0,
          standard_deviation: null,
        },
      };

      const insights = generateBusinessInsights(result);

      expect(insights).toHaveLength(1);
      expect(insights[0].id).toBe("descriptive-no-valid-values");
      expect(insights[0].category).toBe("data_quality");
      expect(insights[0].description).toContain("Revenue");
    });
  });

  describe("Trend analysis", () => {
    it("identifies an increase between the first and last valid periods", () => {
      const result: AnalyticsExecutionResult = {
        dataset_id: "test-dataset",
        operation: "trend",
        column: "Revenue",
        date_column: "TransactionDate",
        aggregation: "sum",
        interval: "month",
        points: [
          {
            period: "2026-01",
            value: 100,
            row_count: 2,
            valid_value_count: 2,
            null_count: 0,
          },
          {
            period: "2026-02",
            value: 150,
            row_count: 2,
            valid_value_count: 2,
            null_count: 0,
          },
        ],
      };

      const insights = generateBusinessInsights(result);

      expect(
        insights.find((item) => item.id === "trend-direction")?.title
      ).toBe("Increase across observed endpoints");
    });

    it("reports missing measure values across returned periods", () => {
      const result: AnalyticsExecutionResult = {
        dataset_id: "test-dataset",
        operation: "trend",
        column: "Revenue",
        date_column: "TransactionDate",
        aggregation: "sum",
        interval: "month",
        points: [
          {
            period: "2026-01",
            value: 100,
            row_count: 2,
            valid_value_count: 1,
            null_count: 1,
          },
          {
            period: "2026-02",
            value: null,
            row_count: 1,
            valid_value_count: 0,
            null_count: 1,
          },
        ],
      };

      const insights = generateBusinessInsights(result);

      expect(
        insights.find((item) => item.id === "trend-null-values")
          ?.description
      ).toContain("2 null measure values");
    });
  });

  describe("Segment comparison", () => {
    it("reports segment extremes and missing values", () => {
      const result: AnalyticsExecutionResult = {
        dataset_id: "test-dataset",
        operation: "segment_comparison",
        column: "Revenue",
        aggregation: "sum",
        segment_by: "Channel",
        segments: [
          {
            group: "Online",
            value: 900,
            row_count: 3,
            valid_value_count: 2,
            null_count: 1,
          },
          {
            group: "Retail",
            value: 600,
            row_count: 2,
            valid_value_count: 2,
            null_count: 0,
          },
        ],
      };

      const insights = generateBusinessInsights(result);
      const ids = insights.map((item) => item.id);

      expect(ids).toContain("segment-highest");
      expect(ids).toContain("segment-lowest");
      expect(ids).toContain("segment-null-values");
    });
  });

  describe("Correlation analysis", () => {
    it("reports a small sample and sampled chart when applicable", () => {
      const result: AnalyticsExecutionResult = {
        dataset_id: "test-dataset",
        operation: "correlation",
        column: "Revenue",
        second_column: "Units",
        correlation: 0.82,
        observation_count: 5,
        strength: "strong",
        direction: "positive",
        points: [
          { x: 10, y: 20 },
          { x: 20, y: 30 },
        ],
        sampled: true,
      };

      const insights = generateBusinessInsights(result);
      const ids = insights.map((item) => item.id);

      expect(ids).toContain("correlation-result");
      expect(ids).toContain("correlation-small-sample");
      expect(ids).toContain("correlation-sampled-chart");
      expect(ids).toContain("correlation-interpretation");
    });
  });
});

describe("getBusinessInsightSummary", () => {
  it("returns correct counts for all insight categories", () => {
    const result: AnalyticsExecutionResult = {
      dataset_id: "test-dataset",
      operation: "kpi",
      column: "Revenue",
      aggregation: "sum",
      value: 500,
      row_count: 3,
      valid_value_count: 2,
      null_count: 1,
    };

    const insights = generateBusinessInsights(result);
    const summary = getBusinessInsightSummary(insights);

    expect(summary.finding).toBeGreaterThan(0);
    expect(summary.next_question).toBeGreaterThan(0);
    expect(summary.data_quality).toBeGreaterThan(0);

    expect(
      Object.values(summary).reduce(
        (total, count) => total + count,
        0
      )
    ).toBe(insights.length);
  });
});

describe("Business insight edge cases", () => {
  describe("Grouped KPI edge cases", () => {
    it("reports equal values when all valid groups have the same result", () => {
      const result: AnalyticsExecutionResult = {
        dataset_id: "test-dataset",
        operation: "kpi",
        column: "Revenue",
        aggregation: "sum",
        group_by: "Region",
        groups: [
          {
            group: "North",
            value: 500,
            row_count: 2,
            valid_value_count: 2,
            null_count: 0,
          },
          {
            group: "South",
            value: 500,
            row_count: 3,
            valid_value_count: 3,
            null_count: 0,
          },
        ],
      };

      const insights = generateBusinessInsights(result);

      expect(
        insights.find((item) => item.id === "kpi-equal-groups")
      ).toBeDefined();

      expect(
        insights.find((item) => item.id === "kpi-highest-group")
      ).toBeUndefined();
    });

    it("reports when no group has a valid result", () => {
      const result: AnalyticsExecutionResult = {
        dataset_id: "test-dataset",
        operation: "kpi",
        column: "Revenue",
        aggregation: "sum",
        group_by: "Region",
        groups: [
          {
            group: "North",
            value: null,
            row_count: 2,
            valid_value_count: 0,
            null_count: 2,
          },
        ],
      };

      const insights = generateBusinessInsights(result);

      expect(
        insights.find((item) => item.id === "kpi-no-valid-groups")
      ).toBeDefined();

      expect(
        insights.find((item) => item.id === "kpi-group-null-values")
      ).toBeDefined();
    });
  });

  describe("Trend edge cases", () => {
    const createTrendResult = (
      firstValue: number | null,
      lastValue: number | null
    ): AnalyticsExecutionResult => ({
      dataset_id: "test-dataset",
      operation: "trend",
      column: "Revenue",
      date_column: "TransactionDate",
      aggregation: "sum",
      interval: "month",
      points: [
        {
          period: "2026-01",
          value: firstValue,
          row_count: 2,
          valid_value_count: firstValue === null ? 0 : 2,
          null_count: 0,
        },
        {
          period: "2026-02",
          value: lastValue,
          row_count: 2,
          valid_value_count: lastValue === null ? 0 : 2,
          null_count: 0,
        },
      ],
    });

    it("identifies a decrease between valid endpoints", () => {
      const insights = generateBusinessInsights(
        createTrendResult(200, 100)
      );

      expect(
        insights.find((item) => item.id === "trend-direction")?.title
      ).toBe("Decrease across observed endpoints");
    });

    it("identifies equal endpoint values", () => {
      const insights = generateBusinessInsights(
        createTrendResult(100, 100)
      );

      expect(
        insights.find((item) => item.id === "trend-direction")?.title
      ).toBe("Equal endpoint values");
    });

    it("reports when no valid trend values exist", () => {
      const insights = generateBusinessInsights(
        createTrendResult(null, null)
      );

      expect(
        insights.find((item) => item.id === "trend-no-valid-values")
      ).toBeDefined();
    });
  });

  describe("Segment comparison edge cases", () => {
    it("reports equal values across valid segments", () => {
      const result: AnalyticsExecutionResult = {
        dataset_id: "test-dataset",
        operation: "segment_comparison",
        column: "Revenue",
        aggregation: "sum",
        segment_by: "Channel",
        segments: [
          {
            group: "Online",
            value: 700,
            row_count: 2,
            valid_value_count: 2,
            null_count: 0,
          },
          {
            group: "Retail",
            value: 700,
            row_count: 2,
            valid_value_count: 2,
            null_count: 0,
          },
        ],
      };

      const insights = generateBusinessInsights(result);

      expect(
        insights.find((item) => item.id === "segment-equal-values")
      ).toBeDefined();

      expect(
        insights.find((item) => item.id === "segment-highest")
      ).toBeUndefined();
    });

    it("reports when no valid segment results exist", () => {
      const result: AnalyticsExecutionResult = {
        dataset_id: "test-dataset",
        operation: "segment_comparison",
        column: "Revenue",
        aggregation: "sum",
        segment_by: "Channel",
        segments: [],
      };

      const insights = generateBusinessInsights(result);

      expect(
        insights.find((item) => item.id === "segment-no-valid-results")
      ).toBeDefined();
    });
  });

  describe("Correlation edge cases", () => {
    const createCorrelationResult = (
      correlation: number,
      strength: string
    ): AnalyticsExecutionResult => ({
      dataset_id: "test-dataset",
      operation: "correlation",
      column: "Revenue",
      second_column: "Units",
      correlation,
      observation_count: 25,
      strength,
      direction:
        correlation > 0
          ? "positive"
          : correlation < 0
            ? "negative"
            : "none",
      points: [],
      sampled: false,
    });

    it("reports negative linear association", () => {
      const insights = generateBusinessInsights(
        createCorrelationResult(-0.75, "strong")
      );

      expect(
        insights.find((item) => item.id === "correlation-result")
          ?.description
      ).toContain("negative linear association");

      expect(
        insights.find((item) => item.id === "correlation-small-sample")
      ).toBeUndefined();
    });

    it("reports no linear direction when correlation is zero", () => {
      const insights = generateBusinessInsights(
        createCorrelationResult(0, "none")
      );

      expect(
        insights.find((item) => item.id === "correlation-result")
          ?.description
      ).toContain("no linear direction");
    });
  });

  describe("Insight summary edge cases", () => {
    it("returns zero counts for an empty insight list", () => {
      expect(getBusinessInsightSummary([])).toEqual({
        finding: 0,
        interpretation: 0,
        next_question: 0,
        data_quality: 0,
      });
    });
  });
});