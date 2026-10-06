import { describe, expect, test } from "vitest";
import {
  formatProduct,
  percent,
  survivalProbabilities,
} from "../src/components/blog/swiss-cheese/model";

describe("independent defect survival", () => {
  test("separates deployment escape from later runtime detection", () => {
    const probabilities = survivalProbabilities([20, 60, 30, 50, 70]);
    expect(probabilities.map((value) => Math.round(value * 10_000))).toEqual([
      8000, 3200, 2240, 1120, 336,
    ]);
    expect(percent(probabilities[3])).toBe("11.2%");
    expect(percent(probabilities[4])).toBe("3.36%");
  });
  test("a perfect layer stops all later survivors without numeric errors", () => {
    expect(survivalProbabilities([0, 100, 30, 0])).toEqual([1, 0, 0, 0]);
  });
  test("does not report a small positive survival probability as zero", () => {
    const [, , , , probability] = survivalProbabilities([99, 99, 99, 99, 99]);
    expect(percent(probability)).toBe("<0.0001%");
    expect(percent(0)).toBe("0%");
  });
  test("formats initial, reset, and extreme products without scientific notation", () => {
    expect(formatProduct([20, 60, 30, 50])).toBe(
      "0.80 × 0.40 × 0.70 × 0.50 = 0.112",
    );
    expect(formatProduct([99, 99, 99, 99])).toBe(
      "0.01 × 0.01 × 0.01 × 0.01 = 0.00000001",
    );
    expect(formatProduct([100, 60, 30, 50])).toBe(
      "0.00 × 0.40 × 0.70 × 0.50 = 0",
    );
  });
  test("ineffective layers let all defects through", () => {
    expect(survivalProbabilities([0, 0, 0, 0, 0])).toEqual([1, 1, 1, 1, 1]);
  });
  test("compares strengthening tests with adding an independent check", () => {
    expect(survivalProbabilities([20, 65, 30, 50]).at(-1)).toBeCloseTo(0.098);
    expect(survivalProbabilities([20, 60, 30, 50, 50]).at(-1)).toBeCloseTo(
      0.056,
    );
  });
});
