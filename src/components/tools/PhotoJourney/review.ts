import {
  DISCREPANCY_LIMIT_M,
  placementIsLocated,
  type Placement,
  type PlacementChoice,
} from "./track";
import type { JourneyPhoto } from "./types";

export const REVIEW_FILTERS = [
  ["needs-review", "Needs review"],
  ["conflicts", "Recording checks"],
  ["inferred", "From recording"],
  ["unlocated", "Unlocated"],
  ["time", "Unresolved times"],
  ["all", "All photos"],
] as const;
export type ReviewFilter = (typeof REVIEW_FILTERS)[number][0];

export function reviewItems(
  photos: readonly JourneyPhoto[],
  placements: readonly Placement[],
  _choices: Readonly<Record<string, PlacementChoice>>,
) {
  return photos.map((photo, index) => {
    const placement = placements[index];
    const difference = (placement?.discrepancyM ?? 0) > DISCREPANCY_LIMIT_M;
    // A camera fix that differs from the GPX is diagnostic. Only an unresolved recording
    // selection is a conflict because the recording remains authoritative.
    const conflict = Boolean(
      placement?.ambiguous || placement?.choiceUnavailable,
    );
    const unlocated = !placementIsLocated(placement);
    const time = placement?.instant === undefined;
    return {
      photo,
      placement,
      index,
      difference,
      conflict,
      unlocated,
      time,
      inferred: placement?.source === "track",
      needsReview: conflict || unlocated || time,
    };
  });
}
export type ReviewItem = ReturnType<typeof reviewItems>[number];

export function matchesReview(item: ReviewItem, filter: ReviewFilter) {
  switch (filter) {
    case "needs-review":
      return item.needsReview;
    case "conflicts":
      return item.conflict;
    case "inferred":
      return item.inferred;
    case "unlocated":
      return item.unlocated;
    case "time":
      return item.time;
    case "all":
      return true;
  }
}

export function reviewCounts(items: readonly ReviewItem[]) {
  return Object.fromEntries(
    REVIEW_FILTERS.map(([filter]) => [
      filter,
      items.filter((item) => matchesReview(item, filter)).length,
    ]),
  ) as Record<ReviewFilter, number>;
}
