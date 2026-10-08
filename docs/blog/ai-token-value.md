# AI token-value post

The post is `src/content/blog/008-the-price-tag-isnt-the-cost-of-ai.mdx`.
Its six Astro figures are in `src/components/blog/token-value/`. They extend
the existing Read/Open night article shell and use its theme colors, Geist
reading type, and JetBrains Mono measurements. `visuals.css` is scoped to these
figures. No new global tokens or compatibility fallbacks were added.

## Figures and controls

- `Opening.astro`: a 100-square mosaic shows cache reads as ember squares.
  The button excludes cache reads from the displayed count and restores them.
  Cached fills fade over 180 ms while square positions stay fixed and the count
  updates immediately. The squares approximate percentages; the count uses the exact snapshot.
- `Usage.astro`: four visible buttons choose a form that suits each measure.
  The figure uses the article column without another card or inset padding.
  Tokens use horizontal bars with cache, fresh-input, write, and output segments.
  Total API dollars use a contribution strip and a compact ranked list. The strip
  shows the three largest values plus all other priced entries. Its denominator
  and every list share use the low-bound value of **all priced rows**, including
  models outside the nine main rows.
  Cost per million uses dots on one zero-based dollar scale, currently $0–$1.50.
  Dots mark the low bound; range marks and numeric labels retain the high bound.
  The ceiling rounds up from the largest high-bound price to the next $0.50.
  These are workload prices, not advertised input rates.
  Benchmark value uses a numbered leaderboard, best first. Prices are dollars
  per **BILLION tokens** per selected score point; the unit heading, recorded price,
  benchmark score, six-decimal tooltips, and `aria-describedby` remain visible
  or accessible. `VALUE KING` marks the lowest ratio among scored main models.
  Combined is the default benchmark choice. Its native selector also offers all
  six individual measures. Luna wins in this snapshot. Incomplete models stay
  visible and unranked. Build-time comparison templates hold the small formatted
  values needed by the client; the full source snapshot remains server-side.
  The first three views sort largest to smallest; the ratio sorts lowest first.
  DOM order follows the visible ranking. Rank badges compare the preceding
  measure, not changes over time. Cost-per-million up is red and down green;
  best-value up is green and down red. Volume changes remain neutral.
  A legend and accessible badge descriptions explain those meanings.
  Reordering uses a 280 ms transform with batched position reads. A new choice
  cancels an interrupted move; reduced motion skips the effect. Selecting the
  current view preserves its badges. The exact-count table retains all 22 rows.
  Controls wrap into two columns at 600px; the dollar list becomes one column.
- `Capability.astro`: native selectors choose a benchmark, cost-per-score or
  absolute-score view, and inspect a model
  release. This figure sits directly in the article, without an inner card or
  padding. Separate full-width Sol, Luna, Astra, and Opus rows use equally spaced release
  steps, explicitly labeled as release order rather than elapsed time. Each point
  has its own ratio label and aligned model name and exact release date. Labels
  use fixed-size HTML type so they stay readable at narrow widths. Vertical
  ranges preserve both price bounds in the cost view. Multi-release families
  state their endpoint change. Improved scores and lower cost-per-score are
  green; regressions are red. All absolute scores share a zero-based 0–100 scale.
  Luna includes GPT-5.6 Luna and GPT-6 Luna. Astra has one recorded release;
  its cost view shows score and absolute prices instead of a spurious 100-to-100
  trend, and its score view shows one unconnected point.
  The inspector shows the evaluated setting, score, recorded price,
  and normalized ratio, and highlights the selected point. All seven comparison
  comparisons in both views and their endpoint summaries are rendered by Astro.
  Release selection carries between views and benchmarks when that release is eligible.
  A benchmark switch fades the new panel from 72% opacity over 160 ms; inspecting
  a release does the same for its details. Selections and data change immediately,
  hidden-panel animations are cancelled, and initialization does not animate.
  Source dates and calculation notes stay inside the benchmark disclosure.
  The inspector keeps the specific SciCode score comparison without repeating
  the article's general limits below every selected release.
- `ScoreComparison.astro`: a compact table compares the three Sol releases
  across six measures and the combined score. Benchmarks are rows so the table
  needs only four columns at narrow widths. Values come from the same snapshot
  and score calculation as the interactive charts.
- `CacheReceipt.astro`: a native range control and three presets change the
  input cache-read share for GPT-6.1 Sol. The receipt shows a one-billion-token
  scenario, the uncached comparison, and tokens available for a $100 API budget.
  Presets expose their selected state with `aria-pressed` and a visible border.
  Their meter changes use a 240 ms horizontal transform from the current visible
  length. Slider input updates directly and cancels preset motion. Numbers update
  immediately. Reduced motion skips the added effects and cancels active script
  animations; the mosaic has a matching CSS media rule.
  Rates and assumptions are in a closed native `details` disclosure. The slider
  still references the method paragraph with `aria-describedby`.
- `RealWork.astro`: the closing comparison uses dumbbells on one zero-based
  dollar axis, currently $0–$12 per million total tokens. The axis ceiling rounds
  the largest uncached price up to a multiple of $4. Hollow dots mark uncached
  prices; solid ember dots and ranges mark the recorded low/high bounds.
  Every model uses the same scale, so the gaps also compare absolute dollars.
  Exact prices and percentage reductions remain labeled because cheaper models
  cluster near zero. The graph sits directly in the article. Prices stack below
  the model at 600px and narrower, preserving the range labels.
  Pricing methods and exclusions are in a closed native `details` disclosure.

Without JavaScript, the mosaic, token bars, all seven capability comparisons in both views, recorded
cache receipt, final price graph, source tables, and captions remain available.
Interactive controls and release inspectors stay hidden. Native `details`
disclosures and scrollable tables still work.

Small local scripts reveal controls and update existing HTML, chart classes,
and scenario meter widths. Results use polite live announcements; controls have labels,
keyboard support, and marker-colored focus outlines. The client does not fetch
benchmark data or include the full snapshot. `model.ts` reads `snapshot.json`
at build time; `format.ts` and `cache.ts` contain the small shared functions
needed by client scripts. Keep data preparation out of client imports.

## Sources and snapshot

- Original CSV: https://tools.mauroner.net/files/rL3tQx0s0aEmeV1j_E4B1zbs9cfDODST/all-model-token-value.csv
- Unchanged public copy: `/data/ai-token-value/all-model-token-value.csv`.
- Benchmark source: https://artificialanalysis.ai/models and the individual
  model URLs stored in `snapshot.json`.
- Retrieved: 8 October 2026. CSV cutoff: 7 October 2026, 21:39:15 UTC.
- AA Intelligence Index version: 4.3.2. Terminal-Bench 4.0, SciCode, Humanity's
  Last Exam, CRITPt, and long-context reasoning are also measured by AA. These
  are not independent replications. AA Index already combines evaluations.

`snapshot.json` retains the token categories, value bounds, base input/output
prices, and benchmark fields used by the article. Token values come directly
from the CSV. Benchmark values come from model records embedded in the public
AA pages, retaining full source precision. Pass fractions for Terminal-Bench, SciCode,
HLE, CRITPt, and long-context reasoning are converted to percentages. The source table links the exact variants.
Opus 4.5 uses Reasoning; Opus 4.6 uses Max; the newer models use Max, with the
source's default fallback for Opus 5.5. Request reasoning settings are absent
from the CSV, so these are proxies rather than matched evaluations.

## Calculations and limits

- Select the nine highest token totals for the chart. The exact-count table
  retains every row, including unpriced ones. Coverage details and the source
  CSV link stay in the article text rather than a chart footer.
- Cached share in the article is cache-read tokens divided by all tokens. This
  differs from the CSV's `cache_pct`, whose denominator is input tokens.
- Effective price is `API value / total tokens * 1,000,000`, retaining low/high
  bounds. It is a current-rate API equivalent, not spend or historical pricing.
- The uncached comparison keeps each model's input/output proportions and
  values all input, including writes, at its base uncached input rate. Output
  uses its base output rate. It is a counterfactual, not measured cache savings.
- The cache receipt is a separate base-rate scenario. It fixes GPT-6.1 Sol's
  observed output share of total tokens and varies cache reads divided by
  **input tokens**, with input defined as total minus output. Rates are $2/M
  fresh input, $0.10/M cached input, and $10/M output. `cachePrice` weights input
  and output separately and clamps the input cache share to 0–1. It omits cache
  writes, long-context premiums, and other uplifts. The exact recorded preset
  gives $199.20 per billion total tokens; the CSV gives $199.28 including the
  recovered premium. This small difference is expected. Preserve the exact
  source share for preset calculations; the native slider uses 0.1 percentage
  point steps, and displayed shares round to that precision.
- Capability ratios divide effective price by a benchmark score. Each family
  and evaluation is normalized to the first available low-bound ratio at 100.
  High values use that same baseline. A point at 50 means half the initial
  price-to-score ratio, not twice the intelligence. Families have separate
  baselines and cannot be compared as absolute rankings.
- The value ranking defaults to recorded price divided by the combined score
  across main models with all six scores. Each measure's highest score among
  the nine main models is 100. Average those six normalized values with equal
  weight. The scale anchors are fixed to this snapshot and do not change when
  the reader switches views. Individual views divide price by the original score.
  `benchmarkValue` retains low/high ratios and returns null
  when the price or score is unavailable. Such entries stay unranked; no score
  estimate is supplied. Winner selection and row order use full precision,
  with ascending low-bound ratios. It is a recorded-workload price-to-score
  ranking, not a ranking of cost per correct answer or a linear intelligence measure.
  Displaying the ratio per billion tokens multiplies it by 1,000 without changing
  any ranking or bar proportions. Winner text uses the same display unit.
- Dates are model release dates from AA. Lines join sampled model releases;
  they are not historical price changes or dated usage. Opus 4.5 was released
  before the recovered period but is included because it was used in that period.
- No Terminal-Bench 4.0 or SciCode score was reported for Opus 4.5/4.6 in the
  retrieved records. Those panels and the combined panel start at Opus 5.
  HLE, CRITPt, and long-context reasoning scores are available for both older
  models. Their individual comparisons retain the Opus 4.5 baseline.
- No benchmark estimates are supplied for missing scores. Combined scores
  require all six fields; missing values are not zeros or a smaller average.
- Claude recovery starts 4 January 2026 and has a 6–16 June gap. Recovered Codex
  history starts 6 July. Deleted history may be incomplete. The aggregate export
  cannot establish daily trends, comparable provider usage, productivity, or
  cost per successful task.
- CSV value bounds exclude missing Codex API write uplift, speed premiums,
  residency uplifts, tool fees, and missing usage. They are not total uncertainty
  intervals. Claude write lifetime and some Codex request-size/context questions
  account for reported low/high variation.

To update, replace the CSV and numeric snapshot together, keep benchmark versions
consistent, record the retrieval date and settings, and rerun the focused data
checks, normal tests, Astro check/build, and article browser checks. The snapshot
is intentionally fixed; there are no live benchmark requests in the reader's browser.

## Verification and review

The initial implementation passed the normal suite (371 tests). The value-ranking
revision passed six focused source/calculation tests, script type checks, and
Astro check/build (315 files, zero errors or warnings, one existing hint).
The production build used Node 22 with a 3 GiB cgroup memory cap and zero build
swap. Sampled peak group memory was 1,956,155,392 bytes. The generated article
was verified at `.vercel/output/static/blog/008-the-price-tag-isnt-the-cost-of-ai/index.html`.
An existing large-chunk advisory remains outside this article's scope.

Browser checks passed at 320, 390, 768, and 1280 pixels. All 12 transitions
between the four ranking views retain correct DOM order, badges, semantic colors,
conditional details, and winner visibility. Rapid switching settles cleanly;
reduced motion skips movement. The benchmark-section anchor resolves.
Earlier motion checks confirmed direct slider input, correct selected presets,
keyboard activation, and no load effects. Badge contrast checks passed in both
themes (minimum 5.31:1 light, 9.21:1 dark). Script reduced-motion checks used a
temporary media-query getter override; the CSS rule was activated and restored.

The initial finish review returned ship. Later refinements were checked locally;
user aesthetic acceptance remains pending. No new compatibility code was added,
and no nesting or branching check is configured in this repository. CI and
deployment did not run. The authorized Tailscale preview remains running.

The later number-formatting refinement passed the same six focused tests,
the ranking script type check, and browser checks at 320, 390, and 1280 pixels.
Unit descriptions and precise tooltips apply only to the value-ratio view and
clear when switching. Raw ranks and bar proportions are unchanged. Its first guarded build attempt returned 75 while another task owned the
shared slot. After that owner finished, the final Astro check/build passed
with the same 3 GiB, zero-swap guard. Peak group memory was 1,856,061,440 bytes;
the generated article was verified to contain the readable prices and unit heading.

## Tailscale preview

The article cover uses `src/assets/blog/covers/008-context-reuse.webp`.
Three matching context sheets carry a large first-read price tag and smaller
repeat-read tags. This is an editorial metaphor, not a measured chart. The
image follows the existing Open night palette, has no embedded headline,
and uses the standard content image loader with descriptive alt text.
The generated original is 1536 × 1024; the source WebP is about 33 KB.
The adjacent `.webp.json` file records the built-in image generation prompt.

Two independent subagents ranked the cover candidates S, U, T. Both chose
S for its direct cache-reuse metaphor and clarity at small sizes. The saved
alternatives, prompts, review, and verification remain in the existing
`.agents/artifacts/design/token-value-interactive/` exploration. No chart
design alternative was selected in this cover round.

The review preview runs on the coding VM at
`https://coding.tailbc92d.ts.net:8443/`. The article is at
`/blog/008-the-price-tag-isnt-the-cost-of-ai/`.

The Astro server listens on localhost port 43136. Tailscale Serve proxies it
on HTTPS port 8443 within the tailnet. The existing T3 and other proxy routes
remain in place. This is a development preview, not the production website.

Check the current listeners and `tailscale serve status` before reusing these
ports. From this repository, with Node 22 available:

```sh
bun run dev --port 43136
tailscale serve --bg --https=8443 http://localhost:43136
```

Astro manages the background server. It is left running for Max's review.
To stop this preview, disable its proxy and stop this repository's managed
server:

```sh
tailscale serve --https=8443 off
bun astro dev stop
```
