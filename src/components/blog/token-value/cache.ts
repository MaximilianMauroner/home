// Counterfactual for GPT-6.1 Sol at the source CSV's base API rates.
// Output keeps its observed share; only the input cache-hit share changes.
export function cachePrice(
  cachedInputShare: number,
  outputShare: number,
  inputRate: number,
  cachedRate: number,
  outputRate: number,
) {
  const share = Math.min(1, Math.max(0, cachedInputShare));
  return (
    (1 - outputShare) * (inputRate * (1 - share) + cachedRate * share) +
    outputShare * outputRate
  );
}
