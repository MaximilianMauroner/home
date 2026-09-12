import { DISCREPANCY_LIMIT_M, type Placement, type PlacementChoice } from "./track";
import type { JourneyPhoto } from "./types";

export const REVIEW_FILTERS = [
  ["needs-review", "Needs review"],
  ["conflicts", "Location conflicts"],
  ["inferred", "From recording"],
  ["unlocated", "Unlocated"],
  ["time", "Unresolved times"],
  ["all", "All photos"],
] as const;
export type ReviewFilter = typeof REVIEW_FILTERS[number][0];

export function reviewItems(
  photos: readonly JourneyPhoto[],
  placements: readonly Placement[],
  choices: Readonly<Record<string, PlacementChoice>>,
) {
  return photos.map((photo, index) => {
    const placement = placements[index];
    const difference = (placement?.discrepancyM ?? 0) > DISCREPANCY_LIMIT_M;
    const conflict = Boolean(placement?.ambiguous || placement?.choiceUnavailable || (difference && !choices[photo.id]));
    const unlocated = placement?.source !== "photo" && placement?.source !== "track";
    const time = placement?.instant === undefined;
    return { photo, placement, index, difference, conflict, unlocated, time,
      inferred: placement?.source === "track", needsReview: conflict || unlocated || time };
  });
}
export type ReviewItem = ReturnType<typeof reviewItems>[number];

export function matchesReview(item: ReviewItem, filter: ReviewFilter) {
  switch (filter) {
    case "needs-review": return item.needsReview;
    case "conflicts": return item.conflict;
    case "inferred": return item.inferred;
    case "unlocated": return item.unlocated;
    case "time": return item.time;
    case "all": return true;
  }
}

export function reviewCounts(items: readonly ReviewItem[]) {
  return Object.fromEntries(REVIEW_FILTERS.map(([filter]) => [filter, items.filter((item) => matchesReview(item, filter)).length])) as Record<ReviewFilter, number>;
}
