import snapshot from "./snapshot.json";
export { money, billions, percent } from "./format";

export const usage = snapshot.usage;
export const benchmarks = snapshot.benchmarks;
export const totalTokens = usage.reduce((sum, row) => sum + row.total, 0);
export const mainModels = usage
  .toSorted((a, b) => b.total - a.total)
  .slice(0, 9);
export const cachedTokens = usage.reduce((sum, row) => sum + row.cached, 0);
export const pricedValue = usage.reduce(
  (sum, row) => sum + (row.valueLow ?? 0),
  0,
);
export const individualMetrics = [
  { id: "intelligence", label: "AA Intelligence Index v4.3.2", shortLabel: "AA", unit: "AA Index point", source: "https://artificialanalysis.ai/models" },
  { id: "terminal", label: "Terminal-Bench 4.0", shortLabel: "Terminal", unit: "Terminal-Bench point", source: "https://artificialanalysis.ai/evaluations/terminalbench-4-0" },
  { id: "scicode", label: "SciCode", shortLabel: "SciCode", unit: "SciCode point", source: "https://artificialanalysis.ai/evaluations/scicode" },
  { id: "hle", label: "Humanity’s Last Exam", shortLabel: "HLE", unit: "HLE point", source: "https://artificialanalysis.ai/evaluations/humanitys-last-exam" },
  { id: "critpt", label: "CRITPt", shortLabel: "CRITPt", unit: "CRITPt point", source: "https://artificialanalysis.ai/evaluations/critpt" },
  { id: "lcr", label: "Long-context reasoning", shortLabel: "LCR", unit: "LCR point", source: "https://artificialanalysis.ai/evaluations/artificial-analysis-long-context-reasoning" },
] as const;
export const metrics = [
  { id: "combined", label: "Combined · equal weight", shortLabel: "Combined", unit: "combined score point" },
  ...individualMetrics,
] as const;
export type Metric = (typeof metrics)[number]["id"];
type BenchmarkScores = Record<(typeof individualMetrics)[number]["id"], number | null>;
const referenceBenchmarks = benchmarks.filter((benchmark) =>
  mainModels.some((row) => row.id === benchmark.id),
);
const scoreScales = individualMetrics.map((metric) => ({
  id: metric.id,
  top: Math.max(...referenceBenchmarks.map((row) => row[metric.id] ?? 0)),
}));

export function benchmarkScore(row: BenchmarkScores, metric: Metric) {
  if (metric !== "combined") return row[metric];
  let total = 0;
  for (const scale of scoreScales) {
    const score = row[scale.id];
    if (score === null || scale.top <= 0) return null;
    total += score / scale.top * 100;
  }
  return total / scoreScales.length;
}

export const families = [
  {
    label: "Sol",
    className: "tv-sol",
    ids: ["gpt-5.6-sol", "gpt-6-sol", "gpt-6.1-sol"],
  },
  {
    label: "Luna",
    className: "tv-luna",
    ids: ["gpt-5.6-luna", "gpt-6-luna"],
  },
  {
    label: "Astra",
    className: "tv-astra",
    ids: ["gpt-6-astra"],
  },
  {
    label: "Opus",
    className: "tv-opus",
    ids: [
      "claude-opus-4-5-20251101",
      "claude-opus-4-6",
      "claude-opus-5",
      "claude-opus-5-5",
    ],
  },
];

export function effectivePrice(
  row: (typeof usage)[number],
  bound: "low" | "high" = "low",
) {
  const value = bound === "low" ? row.valueLow : row.valueHigh;
  return value === null ? null : (value / row.total) * 1_000_000;
}

export function benchmarkValue(row: (typeof usage)[number], metric: Metric = "combined") {
  const benchmark = benchmarks.find((benchmark) => benchmark.id === row.id);
  const low = effectivePrice(row);
  const high = effectivePrice(row, "high");
  if (!benchmark || low === null || high === null) return null;
  const score = benchmarkScore(benchmark, metric);
  if (score === null || score <= 0) return null;
  return {
    score,
    low: low / score,
    high: high / score,
  };
}

export function uncachedPrice(row: (typeof usage)[number]) {
  if (row.inputPrice === null || row.outputPrice === null) return null;
  return (
    ((row.total - row.output) * row.inputPrice + row.output * row.outputPrice) /
    row.total
  );
}

export function trend(ids: string[], metric: Metric) {
  const points = ids.flatMap((id) => {
    const benchmark = benchmarks.find((row) => row.id === id);
    const row = usage.find((row) => row.id === id);
    if (!benchmark || !row) return [];
    const score = benchmarkScore(benchmark, metric);
    const low = effectivePrice(row);
    const high = effectivePrice(row, "high");
    if (score === null || score <= 0 || low === null || high === null)
      return [];
    return [
      {
        ...benchmark,
        score,
        priceLow: low,
        priceHigh: high,
        low: low / score,
        high: high / score,
      },
    ];
  });
  const baseline = points[0]?.low;
  if (!baseline) return [];
  return points.map((point) => ({
    ...point,
    low: (point.low / baseline) * 100,
    high: (point.high / baseline) * 100,
  }));
}
