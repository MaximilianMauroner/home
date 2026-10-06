export const layers = [
  {
    id: "static",
    name: "Types / static analysis",
    catchRate: 20,
    phase: "Before deploy",
    catches:
      "A timestamp passed where a customer-local date is required, if those are distinct types.",
    misses:
      "Valid strings and valid comparisons that implement the wrong meaning of ‘today’.",
  },
  {
    id: "tests",
    name: "Unit / integration tests",
    catchRate: 60,
    phase: "Before deploy",
    catches:
      "A test just before local midnight, with the expected result taken from the customer's rule.",
    misses:
      "Fixtures and expected values that come from the same UTC helper as the code.",
  },
  {
    id: "review",
    name: "Code review (human or AI)",
    catchRate: 30,
    phase: "Before deploy",
    catches:
      "A reviewer tracing ‘valid through today’ back to the customer's timezone, or an AI pass asked which timezone each date belongs to.",
    misses:
      "A clean implementation of a requirement the reviewer also reads as UTC. Same for a model that only sees the diff.",
  },
  {
    id: "staging",
    name: "Staging / end-to-end",
    catchRate: 50,
    phase: "Before deploy",
    catches:
      "A full checkout using a Los Angeles account and a controlled clock near midnight.",
    misses:
      "UTC-only accounts, daytime smoke tests, and staging data unlike the affected users.",
  },
  {
    id: "runtime",
    name: "Canary / runtime checks",
    catchRate: 70,
    phase: "After deploy",
    catches:
      "An unexpected rise in rejected valid coupons in the affected timezone, with someone able to stop rollout.",
    misses:
      "A small canary without that timezone, or a business error that never shows up as an HTTP 500.",
  },
];

/** Cumulative survival under the article's independence assumption. Rates are percentages. */
export function survivalProbabilities(catchRates: readonly number[]) {
  let survival = 1;
  return catchRates.map((catchRate) => {
    survival *= 1 - catchRate / 100;
    return survival;
  });
}

export function percent(probability: number) {
  const percentage = probability * 100;
  if (percentage > 0 && percentage < 0.0001) return "<0.0001%";
  return `${Number(percentage.toFixed(4))}%`;
}

export function formatProduct(catchRates: readonly number[]) {
  const misses = catchRates.map((rate) => (1 - rate / 100).toFixed(2));
  const probability = survivalProbabilities(catchRates).at(-1) ?? 1;
  const decimal = probability.toFixed(8).replace(/0+$/, "").replace(/\.$/, "");
  return `${misses.join(" × ")} = ${decimal}`;
}
