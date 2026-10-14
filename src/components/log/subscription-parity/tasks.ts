import { NOW, axisTitles, time, type Family } from "./history";
import { taskRuns as measuredRuns } from "./task-data";

const DAY_MS = 86_400_000;

export type Lab = "OpenAI" | "Anthropic";

/** One model at one effort setting, as Artificial Analysis ran it. */
export interface TaskRun {
  model: string;
  lab: Lab;
  effort: string;
  date: string;
  /** Artificial Analysis Intelligence Index: roughly the share of its tasks the model gets right, in percent. */
  intelligence: number;
  /** Dollars per task to run the index at list prices. */
  costPerTask: number;
}

/**
 * Max effort is tuned for benchmark scores rather than everyday use, so by default the analysis only uses
 * Low to Xhigh and models without effort settings. Each chart has a switch to add the Max runs back.
 */
const withoutMax = measuredRuns.filter((run) => run.effort !== "Max");
export const runsFor = (includeMax: boolean) => (includeMax ? measuredRuns : withoutMax);
export const maxRunCount = measuredRuns.length - withoutMax.length;

/** A failed task still costs money, so the cost of a task is spread over the tasks the model gets right. */
export const costPerSolvedTask = ({ costPerTask, intelligence }: TaskRun) => costPerTask / (intelligence / 100);

export const labClass = (lab: Lab) => (lab === "OpenAI" ? "sp-chatgpt" : "sp-claude");

export const labs: Lab[] = ["OpenAI", "Anthropic"];

/** The highest-scoring effort setting of a model. */
export function topRun(model: string, runs: TaskRun[]) {
  const modelRuns = runs.filter((run) => run.model === model);
  if (!modelRuns.length) throw new Error(`No task runs for ${model}`);
  return modelRuns.reduce((best, run) => (run.intelligence > best.intelligence ? run : best));
}

/** Each family's newest model, from the first one Artificial Analysis measured the cost of. Opus 4.8 only has a Max run. */
export const flagships: Record<Family, string[]> = {
  gpt: ["GPT-5.5", "GPT-5.6 Sol", "GPT-6 Sol", "GPT-6.1 Sol"],
  opus: ["Claude Opus 4.8", "Claude Opus 5", "Claude Opus 5.5"],
};

/** The level for "same capability": as good as the first flagship with a measured cost. */
export const capabilityModel = "GPT-5.5";

/** Each time any model and effort setting at least as capable as `capabilityModel` got cheaper per solved task than every earlier one. */
export function cheapestSteps(runs: TaskRun[]) {
  const level = topRun(capabilityModel, runs).intelligence;
  const steps: { run: TaskRun; cost: number }[] = [];
  for (const run of runs) {
    const cost = costPerSolvedTask(run);
    if (run.intelligence >= level && (!steps.length || cost < steps[steps.length - 1].cost)) steps.push({ run, cost });
  }
  return steps;
}

const flagshipSteps = (family: Family, runs: TaskRun[]) =>
  flagships[family]
    .filter((model) => runs.some((run) => run.model === model))
    .map((model) => {
      const run = topRun(model, runs);
      return { run, cost: costPerSolvedTask(run) };
    });

/** Average daily log change of a cost from the first step until NOW. */
function trendOf(steps: { run: TaskRun; cost: number }[]) {
  const first = steps[0];
  const days = (time(NOW) - time(first.run.date)) / DAY_MS;
  return Math.log(steps[steps.length - 1].cost / first.cost) / days;
}

export const flagshipTaskTrend = (family: Family, includeMax: boolean) => trendOf(flagshipSteps(family, runsFor(includeMax)));
export const capabilityTaskTrend = (includeMax: boolean) => trendOf(cheapestSteps(runsFor(includeMax)));

export const TASK_HEIGHT = 360;
const PAD = { left: 48, right: 100, top: 30, bottom: 44 };
/** The chart starts with the first flagship that has a measured cost; older small models are only in the table. */
const START = time("2026-04-01");
const END = time(NOW) + 4 * DAY_MS;
const LOW = 0.01;
const HIGH = 30;
const COST_TICKS = [
  { cost: 0.01, label: "$0.01" },
  { cost: 0.1, label: "$0.10" },
  { cost: 1, label: "$1" },
  { cost: 10, label: "$10" },
];
const MONTH_TICKS = ["2026-04-01", "2026-05-01", "2026-06-01", "2026-07-01", "2026-08-01", "2026-09-01", "2026-10-01"];

export const chartRuns = (includeMax: boolean) => runsFor(includeMax).filter((run) => time(run.date) >= START);

export const dollarText = (value: number) => `$${value < 0.1 ? value.toFixed(3) : value < 10 ? value.toFixed(2) : value.toFixed(1)}`;

const monthLabel = (date: string) => new Date(time(date)).toLocaleString("en-US", { month: "short", timeZone: "UTC" });

/** Inner SVG for the cost per solved task chart, and the dot positions for hover lookups. */
export function taskChartMarkup(width: number, includeMax: boolean) {
  const runs = runsFor(includeMax);
  const right = width - PAD.right;
  const bottom = TASK_HEIGHT - PAD.bottom;
  const x = (date: string) => PAD.left + ((time(date) - START) / (END - START)) * (right - PAD.left);
  const y = (cost: number) => bottom - ((Math.log(cost) - Math.log(LOW)) / (Math.log(HIGH) - Math.log(LOW))) * (bottom - PAD.top);
  const parts = [axisTitles(PAD.left, right, TASK_HEIGHT, "Cost per solved task, log scale", "Release date, 2026")];
  for (const { cost, label } of COST_TICKS) {
    parts.push(`<path class="sp-grid" d="M${PAD.left} ${y(cost)}H${right}"/>`);
    parts.push(`<text class="sp-tick" x="${PAD.left - 6}" y="${y(cost) + 4}" text-anchor="end">${label}</text>`);
  }
  for (const date of MONTH_TICKS) {
    parts.push(`<text class="sp-tick" x="${x(date)}" y="${bottom + 20}" text-anchor="middle">${monthLabel(date)}</text>`);
  }
  // Every setting is a quiet dot; the lines and their steps carry the story.
  const points = chartRuns(includeMax).map((run) => ({ run, cx: x(run.date), cy: y(costPerSolvedTask(run)) }));
  for (const { run, cx, cy } of points) parts.push(`<circle class="sp-market-dot ${labClass(run.lab)}" cx="${cx}" cy="${cy}" r="3"/>`);

  // Newest GPT and the GPT-5.5 level start at the same point, so GPT is drawn last to stay visible until they split.
  const lines = [
    { label: `${capabilityModel} level`, className: "sp-level", steps: cheapestSteps(runs) },
    { label: "Newest Opus", className: "sp-claude", steps: flagshipSteps("opus", runs) },
    { label: "Newest GPT", className: "sp-chatgpt", steps: flagshipSteps("gpt", runs) },
  ];
  const ends = lines.map((line) => {
    const { steps } = line;
    let d = `M${x(steps[0].run.date)} ${y(steps[0].cost)}`;
    for (const { run, cost } of steps.slice(1)) d += `H${x(run.date)}V${y(cost)}`;
    d += `H${x(NOW)}`;
    // A halo in the page color keeps the line readable where it crosses dots.
    parts.push(`<path class="sp-task-halo" d="${d}"/><path class="sp-task-line ${line.className}" d="${d}"/>`);
    for (const { run, cost } of steps) parts.push(`<circle class="sp-task-step ${line.className}" cx="${x(run.date)}" cy="${y(cost)}" r="4.5"/>`);
    const last = steps[steps.length - 1].cost;
    return { ...line, last, lineY: y(last), labelY: y(last) };
  });
  // Two-line labels need about 28px; a label moved off its line gets a short leader.
  ends.sort((a, b) => a.labelY - b.labelY);
  ends.forEach((end, index) => {
    if (index) end.labelY = Math.max(end.labelY, ends[index - 1].labelY + 28);
    const labelX = x(NOW) + 10;
    if (Math.abs(end.labelY - end.lineY) > 2) parts.push(`<path class="sp-grid" d="M${x(NOW) + 5} ${end.lineY}L${labelX - 3} ${end.labelY}"/>`);
    parts.push(`<text class="sp-task-label" x="${labelX}" y="${end.labelY - 2}">${end.label}</text>`);
    parts.push(`<text class="sp-tick" x="${labelX}" y="${end.labelY + 12}">${dollarText(end.last)}</text>`);
  });
  return { markup: parts.join(""), points };
}
