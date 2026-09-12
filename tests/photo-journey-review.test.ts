import { describe, expect, test } from "vitest";
import { normalizeMetadata } from "../src/components/tools/PhotoJourney/metadata";
import { reviewCounts, reviewItems } from "../src/components/tools/PhotoJourney/review";
import type { JourneyPhoto } from "../src/components/tools/PhotoJourney/types";
import { resolvePlacementsForRecordings, type Placement } from "../src/components/tools/PhotoJourney/track";

function photo(id: string): JourneyPhoto {
  const file = new File([id], `${id}.jpg`);
  return { id, name: id, file, url: id, thumbnailUrl: id, importOrder: 0, metadata: normalizeMetadata(file, {}, 1, 1) };
}

describe("photo review queue", () => {
  test("separates small GPS differences, conflicts, inferred positions, and unresolved photos", () => {
    const photos = ["close", "far", "no-gps", "no-time", "missing"].map(photo);
    const placements: Placement[] = [
      { photoId: "close", source: "track", instant: 0, discrepancyM: 60 },
      { photoId: "far", source: "track", instant: 0, discrepancyM: 61, conflict: true },
      { photoId: "no-gps", source: "track", instant: 0 },
      { photoId: "no-time", source: "photo" },
      { photoId: "missing", source: "carried", instant: 0 },
    ];
    expect(reviewCounts(reviewItems(photos, placements, {}))).toEqual({
      "needs-review": 3, conflicts: 1, inferred: 3, unlocated: 1, time: 1, all: 5,
    });
  });

  test("an explicit source choice clears a GPS conflict without losing its measured difference", () => {
    const photos = [photo("a")];
    const placements: Placement[] = [{ photoId: "a", source: "track", instant: 0, discrepancyM: 240, conflict: true }];
    for (const choice of ["photo", { source: "track", recordingId: "walk" }] as const) {
      const [item] = reviewItems(photos, placements, { a: choice });
      expect(item.conflict).toBe(false);
      expect(item.difference).toBe(true);
      expect(item.needsReview).toBe(false);
    }
    expect(reviewItems(photos, placements, {})[0].conflict).toBe(true);
  });

  test("overlapping or unavailable recordings remain flagged despite a saved choice", () => {
    const photos = [photo("a"), photo("b")];
    const placements: Placement[] = [
      { photoId: "a", source: "photo", instant: 0, ambiguous: true },
      { photoId: "b", source: "photo", instant: 0, choiceUnavailable: true },
    ];
    expect(reviewCounts(reviewItems(photos, placements, { a: "track", b: "track" })).conflicts).toBe(2);
  });

  test("uses stable photo IDs when capture sorting changes the queue", () => {
    const a = photo("a"), b = photo("b");
    const placements: Placement[] = [
      { photoId: "b", source: "photo", instant: 0, discrepancyM: 100 },
      { photoId: "a", source: "photo", instant: 1, discrepancyM: 100 },
    ];
    const items = reviewItems([b, a], placements, { a: "photo" });
    expect(items.filter((item) => item.conflict).map((item) => item.photo.id)).toEqual(["b"]);
  });

  test("a photo with GPS but no capture time still needs time review", () => {
    const a = photo("a");
    a.metadata.coordinates = { latitude: 46, longitude: 11 };
    const placements = resolvePlacementsForRecordings([a], []);
    expect(reviewCounts(reviewItems([a], placements, {}))).toMatchObject({ time: 1, unlocated: 0, "needs-review": 1 });
  });
});
