import { describe, expect, test } from "vitest";
import {
  areSimilarPhotos,
  findSimilarPhotoGroups,
  shownPhotoIds,
} from "../src/components/tools/PhotoJourney/photo-similarity";
import type {
  JourneyPhoto,
  PhotoVisualFeatures,
} from "../src/components/tools/PhotoJourney/types";

const features = (
  value: number,
  hash = "0".repeat(64),
): PhotoVisualFeatures => ({
  signature: Array(64).fill(value),
  differenceHash: hash,
  sharpness: 0.08,
  exposure: 0.8,
  composition: 0.5,
  colorfulness: 0.3,
});

function photo(
  id: string,
  minute: number,
  visualFeatures = features(0.5),
): JourneyPhoto {
  return {
    id,
    file: new File([id], `${id}.jpg`, { type: "image/jpeg" }),
    url: id,
    thumbnailUrl: id,
    name: id,
    importOrder: minute,
    visualFeatures,
    metadata: {
      capturedAt: new Date(Date.UTC(2025, 0, 1, 12, minute)),
      coordinates: { latitude: 48, longitude: 16 },
      dimensions: "100 × 100",
      fileSize: "1 B",
      fileType: "JPEG",
      modifiedAtLabel: "-",
      details: [],
    },
  };
}

describe("Photo Journey similar-photo selection", () => {
  test("requires visual similarity as well as a nearby capture", () => {
    const first = photo("a", 0);
    expect(areSimilarPhotos(first, photo("b", 1))).toBe(true);
    expect(areSimilarPhotos(first, photo("late", 3))).toBe(false);
    expect(
      areSimilarPhotos(
        first,
        photo("different", 1, features(0.9, "1".repeat(64))),
      ),
    ).toBe(false);
  });

  test("uses complete-link groups instead of joining a similarity chain", () => {
    const a = photo("a", 0, features(0.42, "0".repeat(64)));
    const b = photo("b", 1, features(0.5, `${"1".repeat(8)}${"0".repeat(56)}`));
    const c = photo(
      "c",
      2,
      features(0.58, `${"1".repeat(16)}${"0".repeat(48)}`),
    );
    expect(areSimilarPhotos(a, b)).toBe(true);
    expect(areSimilarPhotos(b, c)).toBe(true);
    expect(areSimilarPhotos(a, c)).toBe(false);
    expect(
      findSimilarPhotoGroups([c, b, a]).map((group) => group.photoIds),
    ).toEqual([["a", "b"]]);
  });

  test("shows the recommendation, supports overrides, and restores exact visibility", () => {
    const photos = [photo("a", 0), photo("b", 1), photo("c", 3)];
    const group = {
      id: "a-b",
      photoIds: ["a", "b"],
      recommendedId: "b",
    };
    expect([...shownPhotoIds(photos, [group], {}, {}, false)]).toEqual([
      "b",
      "c",
    ]);
    expect([
      ...shownPhotoIds(
        photos,
        [group],
        { "a-b": { representativeId: "a" } },
        {},
        false,
      ),
    ]).toEqual(["a", "c"]);
    expect(
      shownPhotoIds(photos, [group], {}, { a: true, b: false }, false),
    ).toEqual(new Set(["a", "c"]));
    expect([...shownPhotoIds(photos, [group], {}, {}, true)]).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  test("keeps a new member visible when a saved decision covers only the old group", () => {
    const photos = [
      photo("old-pick", 0),
      photo("old-hidden", 1),
      photo("new", 1),
    ];
    const group = {
      id: "expanded",
      photoIds: photos.map(({ id }) => id),
      recommendedId: "new",
    };
    expect(
      shownPhotoIds(
        photos,
        [group],
        {},
        { "old-pick": true, "old-hidden": false },
        false,
      ),
    ).toEqual(new Set(["old-pick", "new"]));
  });
});
