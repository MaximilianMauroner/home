const DAY_MS = 86_400_000;

export type Family = "gpt" | "opus";

export interface Release {
  family: Family;
  label: string;
  /** Short label for chart points. */
  short: string;
  date: string;
  /** Launch list prices in dollars per million tokens. */
  input: number;
  cached: number;
  output: number;
  note?: string;
}

// Launch list prices from OpenAI and Anthropic pricing pages and model announcements, checked 14 October 2026.
export const releases: Release[] = [
  { family: "gpt", label: "GPT-5", short: "5", date: "2025-08-07", input: 1.25, cached: 0.125, output: 10 },
  { family: "gpt", label: "GPT-5.1", short: "5.1", date: "2025-11-13", input: 1.25, cached: 0.125, output: 10 },
  { family: "gpt", label: "GPT-5.2", short: "5.2", date: "2025-12-11", input: 1.75, cached: 0.175, output: 14 },
  { family: "gpt", label: "GPT-5.3 Codex", short: "5.3", date: "2026-02-05", input: 1.75, cached: 0.175, output: 14 },
  { family: "gpt", label: "GPT-5.4", short: "5.4", date: "2026-03-05", input: 2.5, cached: 0.25, output: 15 },
  { family: "gpt", label: "GPT-5.5", short: "5.5", date: "2026-04-23", input: 5, cached: 0.5, output: 30 },
  { family: "gpt", label: "GPT-5.6 Sol", short: "5.6", date: "2026-07-09", input: 5, cached: 0.5, output: 30, note: "cut to $4 / $20 on 21 Aug" },
  { family: "gpt", label: "GPT-6 Sol", short: "6", date: "2026-09-22", input: 2, cached: 0.2, output: 10 },
  { family: "gpt", label: "GPT-6.1 Sol", short: "6.1", date: "2026-09-29", input: 2, cached: 0.1, output: 10, note: "cache reads at 5%" },
  { family: "opus", label: "Opus 4.1", short: "4.1", date: "2025-08-05", input: 15, cached: 1.5, output: 75 },
  { family: "opus", label: "Opus 4.5", short: "4.5", date: "2025-11-24", input: 5, cached: 0.5, output: 25 },
  { family: "opus", label: "Opus 4.6", short: "4.6", date: "2026-02-05", input: 5, cached: 0.5, output: 25 },
  { family: "opus", label: "Opus 4.7", short: "4.7", date: "2026-04-16", input: 5, cached: 0.5, output: 25, note: "new tokenizer, ~30% more tokens" },
  { family: "opus", label: "Opus 4.8", short: "4.8", date: "2026-05-28", input: 5, cached: 0.5, output: 25 },
  { family: "opus", label: "Opus 5", short: "5", date: "2026-07-24", input: 5, cached: 0.5, output: 25 },
  { family: "opus", label: "Opus 5.5", short: "5.5", date: "2026-09-22", input: 4, cached: 0.2, output: 20, note: "cache reads at 5%" },
];

export const familyLabels: Record<Family, string> = { gpt: "GPT", opus: "Opus" };

/**
 * Share of each token kind in my recovered history (token price article snapshot, 8 October 2026).
 * Kept as numbers so client scripts don't load the snapshot; tests/subscription-parity.test.ts checks them against it.
 */
export const mixes = {
  gpt: { fresh: 0.031942, cached: 0.96524, output: 0.002818, write5m: 0, write1h: 0 },
  opus: { fresh: 0.000599, cached: 0.955523, output: 0.002291, write5m: 0.037911, write1h: 0.003676 },
};

/** What each kind of token adds to the price of a million tokens of my mix. Cache writes cost 1.25× (5 min) or 2× (1 h) input. */
export function mixParts({ family, input, cached, output }: Release) {
  const mix = mixes[family];
  return {
    cacheReads: mix.cached * cached,
    cacheWrites: (mix.write5m * 1.25 + mix.write1h * 2) * input,
    freshInput: mix.fresh * input,
    output: mix.output * output,
  };
}

/** Dollars per million tokens of my own token mix, at the release's launch prices. */
export function mixPrice(release: Release) {
  const { cacheReads, cacheWrites, freshInput, output } = mixParts(release);
  return cacheReads + cacheWrites + freshInput + output;
}

export const time = (date: string) => Date.parse(date);

export const familyReleases = (family: Family) => releases.filter((release) => release.family === family);

/** Snapshot date of the token pricing article; trends end here. */
export const NOW = "2026-10-08";

/** Mix price of the newest release out on a date. */
export function flagshipPrice(family: Family, date: string) {
  const current = familyReleases(family).findLast((release) => time(release.date) <= time(date));
  if (!current) throw new Error(`No ${family} release on ${date}`);
  return mixPrice(current);
}

/** Average daily log change of the flagship mix price from a date until NOW. */
function since(family: Family, date: string) {
  const days = (time(NOW) - time(date)) / DAY_MS;
  return Math.log(flagshipPrice(family, NOW) / flagshipPrice(family, date)) / days;
}

/** The per-token trend runs from GPT-5 and Opus 4.1 until NOW, about 14 months. */
const TOKEN_TREND_START = "2025-08-07";

/**
 * Daily log change of the cost per solved task from the Artificial Analysis task data (tasks.ts), until NOW:
 * each family's newest model at its top effort since the first one with a measured cost, and the cheapest
 * setting at GPT-5.5 level since GPT-5.5, without and with the Max effort runs. Kept as numbers so client
 * scripts don't load the task data; tests/subscription-parity.test.ts checks them.
 */
export const TASK_TRENDS = {
  withoutMax: { gpt: -0.013015, opus: -0.006093, capability: -0.018619 },
  withMax: { gpt: -0.009467, opus: 0.000465, capability: -0.018619 },
};

const taskTrends = (includeMax: boolean) => TASK_TRENDS[includeMax ? "withMax" : "withoutMax"];

export const trends = {
  flat: () => 0,
  /** Price of my token mix on the newest model. */
  perToken: (family: Family) => since(family, TOKEN_TREND_START),
  /** Cost per solved task on the newest model. */
  perTask: (family: Family, includeMax: boolean) => taskTrends(includeMax)[family],
  /** Cost per solved task at the same capability, from either lab, for both families. */
  sameCapability: (_family: Family, includeMax: boolean) => taskTrends(includeMax).capability,
};

export type Trend = keyof typeof trends;

export const trendNames: Trend[] = ["flat", "perToken", "perTask", "sameCapability"];

export const HISTORY_HEIGHT = 296;
const PAD = { left: 48, right: 34, top: 36, bottom: 44 };
const START = time("2025-07-15");
const END = time(NOW) + 12 * DAY_MS;
const PRICE_TICKS = [0.1, 0.2, 0.5, 1, 2];
const DATE_TICKS = ["2025-09-01", "2025-12-01", "2026-03-01", "2026-06-01", "2026-09-01"];

export const dateLabel = (date: string) =>
  new Date(time(date)).toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

/** Axis titles for the charts: the y title sits above the plot, the x title under the tick labels. */
export const axisTitles = (left: number, right: number, height: number, yTitle: string, xTitle: string) =>
  `<text class="sp-axis-title" x="0" y="12">${yTitle}</text>` +
  `<text class="sp-axis-title" x="${(left + right) / 2}" y="${height - 4}" text-anchor="middle">${xTitle}</text>`;

/** Inner SVG for the release history at a given pixel width: newest-flagship price over time, log scale. */
export function historyChartMarkup(width: number) {
  const right = width - PAD.right;
  const bottom = HISTORY_HEIGHT - PAD.bottom;
  const x = (date: string) => PAD.left + ((time(date) - START) / (END - START)) * (right - PAD.left);
  const y = (price: number) => {
    const share = (Math.log(price) - Math.log(0.1)) / (Math.log(3) - Math.log(0.1));
    return bottom - share * (bottom - PAD.top);
  };
  const parts = [axisTitles(PAD.left, right, HISTORY_HEIGHT, "Price per million tokens of my mix, log scale", "Launch date")];
  for (const price of PRICE_TICKS) {
    parts.push(`<path class="sp-grid" d="M${PAD.left} ${y(price)}H${right}"/>`);
    parts.push(`<text class="sp-tick" x="${PAD.left - 6}" y="${y(price) + 4}" text-anchor="end">$${price < 1 ? price.toFixed(2) : price}</text>`);
  }
  let labelEnd = 0;
  for (const date of DATE_TICKS) {
    const label = dateLabel(date);
    const halfWidth = (label.length * 6.6) / 2;
    if (x(date) - halfWidth < labelEnd + 8) continue;
    labelEnd = x(date) + halfWidth;
    parts.push(`<text class="sp-tick" x="${x(date)}" y="${bottom + 20}" text-anchor="middle">${label}</text>`);
  }
  for (const [family, className] of [["opus", "sp-claude"], ["gpt", "sp-chatgpt"]] as const) {
    const list = familyReleases(family);
    // The price holds until the next release, so the line steps.
    let d = `M${x(list[0].date)} ${y(mixPrice(list[0]))}`;
    for (const release of list.slice(1)) d += `H${x(release.date)}V${y(mixPrice(release))}`;
    d += `H${x(NOW)}`;
    parts.push(`<path class="sp-line ${className}" d="${d}"/>`);
    let lastLabelEnd = -Infinity;
    list.forEach((release, index) => {
      const cx = x(release.date);
      const cy = y(mixPrice(release));
      const next = list[index + 1];
      // Steps are vertical at the release date, so labels sit just right of the point where the line is flat.
      // A release one week before the next one puts its label on the left instead.
      const crowded = next && x(next.date) - cx < 26;
      // GPT stays below Opus the whole time, so GPT labels go under the line and Opus labels above it.
      const labelY = family === "gpt" ? cy + 16 : cy - 8;
      const anchor = crowded ? ` text-anchor="end"` : "";
      parts.push(`<circle class="sp-dot ${className}" cx="${cx}" cy="${cy}" r="4"/>`);
      // On narrow charts, skip a label that would overlap the previous one. The table lists every release.
      const labelWidth = release.short.length * 6.6;
      const labelStart = crowded ? cx - 5 - labelWidth : cx + 5;
      if (labelStart < lastLabelEnd + 4) return;
      lastLabelEnd = labelStart + labelWidth;
      parts.push(`<text class="sp-point ${className}" x="${crowded ? cx - 5 : cx + 5}" y="${labelY}"${anchor}>${release.short}</text>`);
    });
  }
  return parts.join("");
}
