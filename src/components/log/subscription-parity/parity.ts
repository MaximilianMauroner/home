import { axisTitles, trends, type Family, type Trend } from "./history";

const DAY_MS = 86_400_000;
export const MONTH_DAYS = 365.25 / 12;
/** Price snapshot date from the token pricing article. */
export const BASELINE = Date.UTC(2026, 9, 8);
export const CHART_DAYS = 1461; // 4 years, so the slower Claude crossings stay visible

export interface Plan {
  family: Family;
  fee: number;
  /** Full monthly limit priced at API list rates (SemiAnalysis, 5 October 2026). */
  limitValue: number;
  /** Separate monthly API credits, counted as fully used. */
  credit?: number;
}

const plus: Plan = { family: "gpt", fee: 20, limitValue: 211 };
const pro200: Plan = { family: "gpt", fee: 200, limitValue: 2084 };
const claudePro: Plan = { family: "opus", fee: 20, limitValue: 1178 };
const max20: Plan = { family: "opus", fee: 200, limitValue: 11726 };

export const rows: { name: string; group?: string; tag?: string; note?: string; plans: Plan[] }[] = [
  { group: "ChatGPT", name: "Plus $20", tag: "mine", plans: [plus] },
  { name: "Pro $100", plans: [{ family: "gpt", fee: 100, limitValue: 1055 }] },
  { name: "Pro $200", tag: "mine", plans: [pro200] },
  // Not tested by SemiAnalysis: assumes the same value per dollar as Pro $200.
  { name: "Pro $500", tag: "estimate", plans: [{ family: "gpt", fee: 500, limitValue: 5210 }] },
  { group: "Claude", name: "Pro $20", tag: "mine", plans: [claudePro] },
  { name: "Max 5x $100", plans: [{ family: "opus", fee: 100, limitValue: 5725 }] },
  { name: "Max 20x $200", plans: [max20] },
  { name: "Max 20x, API credits used", plans: [{ ...max20, credit: 200 }] },
  { group: "Together", name: "My $240", note: "Pro $200 + Plus $20 + Claude Pro $20", plans: [pro200, plus, claudePro] },
];

export const series = [
  { name: "ChatGPT Pro $200", className: "sp-chatgpt", plans: [pro200] },
  { name: "Claude Max 20x $200", className: "sp-claude", plans: [max20] },
  { name: "My $240", className: "sp-mine", plans: [pro200, plus, claudePro] },
];

export const horizons = [
  { label: "Today", days: 0 },
  { label: "Year-end", days: 84 },
  { label: "6 months", days: 182 },
  { label: "1 year", days: 365 },
  { label: "2 years", days: 731 },
];

export interface Scenario {
  /** Which cost trend the future follows. */
  trend: Trend;
  /** Share of each limit actually used. */
  use: number;
  /** Whether the per-task trends count the Max effort runs. */
  includeMax: boolean;
}

export const defaultScenario: Scenario = { trend: "perTask", use: 1, includeMax: false };

export function apiValue(plans: Plan[], days: number, { trend, use, includeMax }: Scenario) {
  return plans.reduce((sum, plan) => {
    const priceFactor = Math.exp(trends[trend](plan.family, includeMax) * days);
    return sum + plan.limitValue * use * priceFactor + (plan.credit ?? 0);
  }, 0);
}

export const fee = (plans: Plan[]) => plans.reduce((sum, plan) => sum + plan.fee, 0);

export const ratio = (plans: Plan[], days: number, scenario: Scenario) =>
  apiValue(plans, days, scenario) / fee(plans);

/** Days until the limit is worth its fee: 0 if it already is, null if it never gets there. */
export function parityDays(plans: Plan[], scenario: Scenario) {
  const target = fee(plans);
  if (apiValue(plans, 0, scenario) <= target) return 0;
  // What is left once every falling price has reached zero.
  const floor = plans.reduce((sum, plan) => {
    const steady = trends[scenario.trend](plan.family, scenario.includeMax) >= 0 ? plan.limitValue * scenario.use : 0;
    return sum + steady + (plan.credit ?? 0);
  }, 0);
  if (floor >= target) return null;
  let low = 0;
  let high = 365;
  while (apiValue(plans, high, scenario) > target) high *= 2;
  for (let step = 0; step < 60; step++) {
    const middle = (low + high) / 2;
    if (apiValue(plans, middle, scenario) > target) low = middle;
    else high = middle;
  }
  return high;
}

export const monthLabel = (days: number) =>
  new Date(BASELINE + days * DAY_MS).toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

export const ratioText = (value: number) =>
  value < 0.01 ? "<0.01×" : `${value.toFixed(value >= 10 ? 1 : 2)}×`;

export function parityText(days: number | null) {
  if (days === null) return "Never";
  if (days === 0) return "Already";
  if (days > 3652) return "10+ yrs";
  return `${(days / MONTH_DAYS).toFixed(1)} mo`;
}

export const dollars = (value: number) => `$${value.toFixed(value < 0.02 ? 4 : value < 1 ? 3 : 2)}`;

/** Table body for the selected scenario. Labels are fixed strings from this module. */
export function tableRows(scenario: Scenario) {
  return rows
    .map(({ name, group, tag, note, plans }) => {
      const groupRow = group ? `<tr class="sp-group"><th scope="rowgroup" colspan="${horizons.length + 2}">${group}</th></tr>` : "";
      const label = `${name}${tag ? ` <span class="sp-tag">${tag}</span>` : ""}${note ? `<small>${note}</small>` : ""}`;
      const cells = horizons
        .map(({ days }) => {
          const value = ratio(plans, days, scenario);
          return `<td${value <= 1 ? ' class="sp-below"' : ""}>${ratioText(value)}</td>`;
        })
        .join("");
      const days = parityDays(plans, scenario);
      const when = days && days <= 3652 ? `<small>${monthLabel(days)}</small>` : "";
      return `${groupRow}<tr><th scope="row">${label}</th>${cells}<td class="sp-when">${parityText(days)}${when}</td></tr>`;
    })
    .join("");
}

export const CHART_HEIGHT = 320;
const chartTicks = [1, 2, 3, 4].map((years) => ({ label: `${years} year${years > 1 ? "s" : ""}`, days: Math.round(years * 365.25) }));
const PAD = { left: 40, right: 8, top: 28, bottom: 44 };
/** Top of the ratio axis. Claude Max 20x starts at about 59×; a line that climbs past the top gets a note with its four-year value. */
const CHART_MAX = 64;

/**
 * Inner SVG for the ratio chart at a given pixel width.
 * The y-axis is a square-root scale: a steady price decline draws as a curve that flattens out,
 * and the 1× line keeps enough room to read where each plan crosses it.
 */
export function chartMarkup(width: number, scenario: Scenario) {
  const right = width - PAD.right;
  const bottom = CHART_HEIGHT - PAD.bottom;
  const x = (days: number) => PAD.left + (days / CHART_DAYS) * (right - PAD.left);
  const y = (value: number) => bottom - Math.sqrt(Math.min(CHART_MAX, Math.max(0, value)) / CHART_MAX) * (bottom - PAD.top);
  const parts = [axisTitles(PAD.left, right, CHART_HEIGHT, "API value ÷ fee, square-root scale", "Time from today")];
  for (const value of [60, 40, 20, 10, 5, 1, 0]) {
    const one = value === 1;
    parts.push(`<path class="${one ? "sp-parity" : "sp-grid"}" d="M${PAD.left} ${y(value)}H${right}"/>`);
    parts.push(`<text class="sp-tick${one ? " sp-tick-strong" : ""}" x="${PAD.left - 6}" y="${y(value) + 4}" text-anchor="end">${value}×</text>`);
  }
  parts.push(`<text class="sp-tick" x="${PAD.left}" y="${bottom + 20}">Today</text>`);
  // Labels are 11px mono, about 6.6px per character. Narrow charts skip a label that would overlap the previous one.
  let labelEnd = PAD.left + 5 * 6.6;
  for (const { label, days } of chartTicks) {
    parts.push(`<path class="sp-grid" d="M${x(days)} ${PAD.top}V${bottom}"/>`);
    const halfWidth = (label.length * 6.6) / 2;
    if (x(days) - halfWidth < labelEnd + 8) continue;
    labelEnd = x(days) + halfWidth;
    // The last label would run past the right edge if centered, so it ends at the edge instead.
    const atEdge = x(days) + halfWidth > width;
    parts.push(`<text class="sp-tick" x="${atEdge ? right : x(days)}" y="${bottom + 20}" text-anchor="${atEdge ? "end" : "middle"}">${label}</text>`);
  }
  for (const { className, plans } of series) {
    let d = "";
    for (let step = 0; step <= 160; step++) {
      const days = (CHART_DAYS * step) / 160;
      d += `${step ? "L" : "M"}${x(days).toFixed(1)} ${y(ratio(plans, days, scenario)).toFixed(1)}`;
    }
    parts.push(`<path class="sp-line ${className}" d="${d}"/>`);
    const days = parityDays(plans, scenario);
    if (days && days <= CHART_DAYS) parts.push(`<circle class="sp-dot ${className}" cx="${x(days)}" cy="${y(1)}" r="4.5"/>`);
    const end = ratio(plans, CHART_DAYS, scenario);
    if (end > CHART_MAX) parts.push(`<text class="sp-tick" x="${right}" y="${PAD.top - 8}" text-anchor="end">↑ ${ratioText(end)} by year 4</text>`);
  }
  return { markup: parts.join(""), x, y, toDays: (px: number) => ((px - PAD.left) / (right - PAD.left)) * CHART_DAYS, top: PAD.top, bottom };
}
