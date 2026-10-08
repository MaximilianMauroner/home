import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { cachePrice } from "../src/components/blog/token-value/cache";
import {
  benchmarks,
  effectivePrice,
  benchmarkValue,
  benchmarkScore,
  metrics,
  mainModels,
  totalTokens,
  trend,
  uncachedPrice,
  usage,
} from "../src/components/blog/token-value/model";

describe("AI token-value source and calculations", () => {
  test("retains every source row and all token categories, including unpriced usage", () => {
    const csv = readFileSync(
      new URL(
        "../public/data/ai-token-value/all-model-token-value.csv",
        import.meta.url,
      ),
      "utf8",
    );
    const lines = csv.trim().split(/\r?\n/).slice(1);
    expect(usage).toHaveLength(lines.length);
    lines.forEach((line, index) => {
      // The first eight CSV columns contain no quoted or comma-bearing values.
      const [
        id,
        uncached,
        cached,
        write5m,
        write1h,
        writeUnknown,
        output,
        total,
      ] = line.split(",");
      expect(usage[index]).toMatchObject({
        id,
        uncached: Number(uncached),
        cached: Number(cached),
        write5m: Number(write5m),
        write1h: Number(write1h),
        writeUnknown: Number(writeUnknown),
        output: Number(output),
        total: Number(total),
      });
      expect(Number(total)).toBe(
        Number(uncached) +
          Number(cached) +
          Number(write5m) +
          Number(write1h) +
          Number(writeUnknown) +
          Number(output),
      );
    });
    expect(totalTokens).toBe(76_854_645_378);
    expect(
      mainModels.reduce((sum, row) => sum + row.total, 0) / totalTokens,
    ).toBeCloseTo(0.9598519);
    expect(usage.filter((row) => effectivePrice(row) === null)).toHaveLength(3);
  });

  test("keeps output in the uncached comparison and does not invent a price for unpriced entries", () => {
    const row = usage.find((row) => row.id === "gpt-6.1-sol")!;
    expect(uncachedPrice(row)).toBeCloseTo(2.027398);
    expect(effectivePrice(row)).toBeCloseTo(0.1992816);
    const unpriced = usage.find((row) => row.valueLow === null)!;
    expect(uncachedPrice(unpriced)).toBeNull();
    expect(effectivePrice(unpriced)).toBeNull();
  });

  test("preserves uncertainty and uses a new baseline when earlier benchmark scores are missing", () => {
    const ids = [
      "claude-opus-4-5-20251101",
      "claude-opus-4-6",
      "claude-opus-5",
      "claude-opus-5-5",
    ];
    const intelligence = trend(ids, "intelligence");
    expect(intelligence[0].low).toBe(100);
    expect(intelligence[0].high).toBeGreaterThan(120);
    const terminal = trend(ids, "terminal");
    expect(terminal.map((row) => row.id)).toEqual(ids.slice(2));
    expect(terminal[0].low).toBe(100);
    expect(benchmarks.find((row) => row.id === ids[0])?.terminal).toBeNull();
  });

  test("ranks recorded cost per AA Index point and preserves price bounds without inventing scores", () => {
    const ranked = mainModels.flatMap((row) => {
      const value = benchmarkValue(row, "intelligence");
      return value ? [{ id: row.id, ...value }] : [];
    }).toSorted((a, b) => a.low - b.low);
    expect(ranked.map((row) => row.id)).toEqual([
      "gpt-5.6-luna", "gpt-6.1-sol", "gpt-6-sol", "claude-opus-5-5",
      "gpt-5.6-sol", "claude-opus-5", "claude-opus-4-6",
      "gpt-6-astra", "claude-opus-4-5-20251101",
    ]);
    expect(ranked[0].low).toBeCloseTo(0.000882753425, 12);
    expect(ranked[0].score).toBeCloseTo(37.324423969, 8);
    expect(ranked[0].high).toBeLessThan(ranked[1].low);
    expect(ranked.at(-1)!.high).toBeGreaterThan(ranked.at(-1)!.low);
    expect(benchmarkValue(usage.find((row) => row.id === "gpt-5.5")!, "intelligence")).toBeNull();
    const sol = usage.find((row) => row.id === "gpt-6.1-sol")!;
    expect(benchmarkValue({
      ...sol, valueLow: null, valueHigh: null, inputPrice: null, outputPrice: null,
    }, "intelligence")).toBeNull();
  });

  test("captures a falling price-to-score ratio even when the newest SciCode score regresses", () => {
    const points = trend(
      ["gpt-5.6-sol", "gpt-6-sol", "gpt-6.1-sol"],
      "scicode",
    );
    expect(points[2].score).toBeLessThan(points[1].score);
    expect(points[2].low).toBeLessThan(points[1].low);
    expect(
      trend(["gpt-5.6-sol", "gpt-6-sol", "gpt-6.1-sol"], "intelligence")[2].low,
    ).toBeCloseTo(32.52, 1);
  });

  test("gives each normalized benchmark equal weight despite different score scales", () => {
    const sol = benchmarks.find((row) => row.id === "gpt-6.1-sol")!;
    const zero = { ...sol, intelligence: 0, terminal: 0, scicode: 0, hle: 0, critpt: 0, lcr: 0 };
    expect(benchmarkScore(zero, "combined")).toBe(0);
    // A top score in either measure contributes exactly one sixth of 100.
    expect(benchmarkScore({ ...zero, terminal: 59.5959595959596 }, "combined")).toBeCloseTo(100 / 6, 10);
    expect(benchmarkScore({ ...zero, lcr: 84.6666666666667 }, "combined")).toBeCloseTo(100 / 6, 10);
    expect(benchmarkScore(sol, "combined")).toBeCloseTo(91.2508965185, 8);
    expect(benchmarkScore({ ...sol, scicode: null }, "combined")).toBeNull();
  });

  test("defaults to combined value and leaves incomplete models unranked without losing their individual scores", () => {
    expect(metrics[0].id).toBe("combined");
    const ranked = mainModels.flatMap((row) => {
      const value = benchmarkValue(row);
      return value ? [{ id: row.id, ...value }] : [];
    }).toSorted((a, b) => a.low - b.low);
    expect(ranked.map((row) => row.id)).toEqual([
      "gpt-5.6-luna", "gpt-6.1-sol", "gpt-6-sol", "claude-opus-5-5",
      "gpt-5.6-sol", "claude-opus-5", "gpt-6-astra",
    ]);
    const opus = usage.find((row) => row.id === "claude-opus-4-5-20251101")!;
    expect(benchmarkValue(opus)).toBeNull();
    expect(benchmarkValue(opus, "terminal")).toBeNull();
    const hle = benchmarkValue(opus, "hle")!;
    expect(hle.score).toBeCloseTo(30.1204819277, 8);
    expect(hle.high).toBeGreaterThan(hle.low);
  });

  test("uses complete-score baselines for combined trends and retains the expanded individual comparisons", () => {
    const sol = trend(["gpt-5.6-sol", "gpt-6-sol", "gpt-6.1-sol"], "combined");
    expect(sol.map((row) => row.low)).toEqual([100, 48.257145189598, 33.660752619925695]);
    const ids = ["claude-opus-4-5-20251101", "claude-opus-4-6", "claude-opus-5", "claude-opus-5-5"];
    expect(trend(ids, "combined").map((row) => row.id)).toEqual(ids.slice(2));
    for (const metric of ["hle", "critpt", "lcr"] as const) {
      expect(trend(ids, metric).map((row) => row.id)).toEqual(ids);
    }
  });

  test("shows Luna's mixed score changes separately from its falling workload cost", () => {
    const ids = ["gpt-5.6-luna", "gpt-6-luna"];
    const combined = trend(ids, "combined");
    expect(combined.map((row) => row.id)).toEqual(ids);
    expect(combined[0].score).toBeCloseTo(65.2092812961, 8);
    expect(combined[1].score).toBeCloseTo(65.0627640035, 8);
    expect(combined[1].score).toBeLessThan(combined[0].score);
    expect(combined[1].low).toBeCloseTo(48.6562914023, 8);
    for (const metric of ["intelligence", "terminal", "scicode"] as const) {
      const points = trend(ids, metric);
      expect(points[1].score).toBeGreaterThan(points[0].score);
    }
    const astra = trend(["gpt-6-astra"], "combined");
    expect(astra).toHaveLength(1);
    expect(astra[0].score).toBeCloseTo(92.9371659659, 8);
    expect(astra[0].priceLow).toBeCloseTo(1.4008798687, 8);
  });

  test("uses the observed token proportions at base rates and keeps output at full price at both slider endpoints", () => {
    const row = usage.find((row) => row.id === "gpt-6.1-sol")!;
    const outputShare = row.output / row.total;
    const observedShare = row.cached / (row.total - row.output);
    const priceAt = (share: number) =>
      cachePrice(share, outputShare, 2, 0.1, 10);
    expect(priceAt(observedShare)).toBeCloseTo(0.1992019949, 8);
    // The receipt excludes the recovered long-context premium in the CSV value.
    expect(effectivePrice(row)! - priceAt(observedShare)).toBeCloseTo(
      0.0000796109,
      8,
    );
    expect(priceAt(0)).toBeCloseTo(uncachedPrice(row)!, 8);
    expect(priceAt(1)).toBeCloseTo(
      0.1 * (1 - outputShare) + 10 * outputShare,
      8,
    );
    expect(priceAt(1)).toBeGreaterThan(0.1);
    expect(priceAt(0.5)).toBeCloseTo((priceAt(0) + priceAt(1)) / 2, 8);
    expect(priceAt(-1)).toBe(priceAt(0));
    expect(priceAt(2)).toBe(priceAt(1));
  });
});
