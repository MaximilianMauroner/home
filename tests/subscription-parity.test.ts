import { expect, test } from "vitest";

import { usage } from "../src/components/blog/token-value/model";
import { TASK_TRENDS, mixes, mixPrice, releases } from "../src/components/log/subscription-parity/history";
import { capabilityTaskTrend, flagshipTaskTrend, flagships, runsFor, topRun } from "../src/components/log/subscription-parity/tasks";
import { defaultScenario, parityDays, rows } from "../src/components/log/subscription-parity/parity";

test("token mixes match the token price snapshot", () => {
  for (const [family, provider] of [["gpt", "codex"], ["opus", "claude"]] as const) {
    const list = usage.filter((row) => row.provider === provider);
    const total = list.reduce((sum, row) => sum + row.total, 0);
    const share = (pick: (row: (typeof list)[number]) => number) => list.reduce((sum, row) => sum + pick(row), 0) / total;
    const mix = mixes[family];
    expect(mix.fresh).toBeCloseTo(share((row) => row.uncached), 5);
    expect(mix.cached).toBeCloseTo(share((row) => row.cached), 5);
    expect(mix.output).toBeCloseTo(share((row) => row.output), 5);
    expect(mix.write5m).toBeCloseTo(share((row) => row.write5m + row.writeUnknown), 5);
    expect(mix.write1h).toBeCloseTo(share((row) => row.write1h), 5);
  }
});

test("mix prices match the snapshot for releases priced there", () => {
  // The snapshot has current prices. GPT-5.6 Sol launched higher and was cut in August, so it is left out.
  const snapshotIds: Record<string, string> = {
    "GPT-5.4": "gpt-5.4",
    "GPT-5.5": "gpt-5.5",
    "GPT-6 Sol": "gpt-6-sol",
    "GPT-6.1 Sol": "gpt-6.1-sol",
    "Opus 4.5": "claude-opus-4-5-20251101",
    "Opus 5.5": "claude-opus-5-5",
  };
  for (const release of releases.filter(({ label }) => label in snapshotIds)) {
    const row = usage.find(({ id }) => id === snapshotIds[release.label])!;
    expect(row.inputPrice).toBe(release.input);
    expect(row.outputPrice).toBe(release.output);
  }
  expect(mixPrice(releases.find(({ label }) => label === "GPT-5")!)).toBeCloseTo(
    mixPrice(releases.find(({ label }) => label === "GPT-6.1 Sol")!),
    3,
  );
});

test("parity follows the cost trends", () => {
  const plan = (name: string) => rows.find((row) => row.name === name)!.plans;
  // Per token, GPT on my mix costs the same as at GPT-5, so ChatGPT plans stay far above 1×.
  expect(parityDays(plan("Pro $200"), { ...defaultScenario, trend: "perToken" })).toBeGreaterThan(3652);
  // Per solved task the newest GPT got about 9× cheaper since April and the newest Opus about 1.6× since July.
  expect(parityDays(plan("Pro $200"), defaultScenario)).toBeLessThan(365);
  expect(parityDays(plan("Max 20x $200"), defaultScenario)).toBeGreaterThan(parityDays(plan("Pro $200"), defaultScenario)!);
  expect(parityDays(plan("Max 20x, API credits used"), defaultScenario)).toBeNull();
  expect(parityDays(plan("Pro $200"), { ...defaultScenario, trend: "flat" })).toBeNull();
  // With the Max runs, the newest Opus got more expensive per solved task, so Claude plans never get there.
  expect(parityDays(plan("Max 20x $200"), { ...defaultScenario, includeMax: true })).toBeNull();
  // A fixed capability gets cheap much faster than the newest models.
  expect(parityDays(plan("Pro $200"), { ...defaultScenario, trend: "sameCapability" })).toBeLessThan(parityDays(plan("Pro $200"), defaultScenario)!);
});

test("the stored task trends match the task data", () => {
  for (const includeMax of [false, true]) {
    const stored = TASK_TRENDS[includeMax ? "withMax" : "withoutMax"];
    expect(stored.gpt).toBeCloseTo(flagshipTaskTrend("gpt", includeMax), 5);
    expect(stored.opus).toBeCloseTo(flagshipTaskTrend("opus", includeMax), 5);
    expect(stored.capability).toBeCloseTo(capabilityTaskTrend(includeMax), 5);
  }
});

test("task data release dates agree with the release history", () => {
  const historyLabel = (model: string) => model.replace("Claude ", "");
  for (const model of [...flagships.gpt, ...flagships.opus]) {
    const release = releases.find(({ label }) => label === historyLabel(model));
    if (release) expect(topRun(model, runsFor(true)).date).toBe(release.date);
  }
});
