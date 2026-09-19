import { describe, expect, test } from "vitest";

import {
  PROJECT_SCHEMA_VERSION,
  createProjectManifest,
  parseProjectManifest,
  restoreProjectManifest,
  serializeProjectManifest,
} from "../src/components/tools/PhotoJourney/project-file";
import type {
  JourneyPhoto,
  JourneyRecording,
} from "../src/components/tools/PhotoJourney/types";

function photo(
  id: string,
  fileName: string,
  bytes = "photo",
  lastModified = 0,
): JourneyPhoto {
  const file = new File([bytes], fileName, {
    type: "image/jpeg",
    lastModified,
  });
  return {
    id,
    file,
    name: fileName,
    url: `blob:${id}`,
    thumbnailUrl: `blob:${id}-thumbnail`,
    importOrder: 0,
    metadata: {
      dimensions: "1 × 1",
      fileSize: `${file.size} B`,
      fileType: "JPEG",
      modifiedAtLabel: "-",
      details: [],
    },
  };
}

function recording(
  id: string,
  digest: string,
  included: boolean,
): JourneyRecording {
  return {
    id,
    digest,
    included,
    file: new File([], `${id}.gpx`),
    name: id,
    track: { points: [], segmentStarts: [] },
    importOrder: 0,
    warnings: [],
  };
}

describe("Photo Journey project manifest", () => {
  test("round-trips user decisions without runtime IDs or Blob URLs", () => {
    const photos = [photo("runtime-b", "b.jpg"), photo("runtime-a", "a.jpg")];
    const recordings = [
      recording("runtime-walk", "sha256-walk", false),
      recording("runtime-run", "sha256-run", true),
    ];
    const manifest = createProjectManifest({
      title: "Dolomites",
      timezone: "Europe/Rome",
      order: "manual",
      photos,
      recordings,
      offsetMinutesByPhoto: { "runtime-a": 120 },
      recordingChoices: {
        "runtime-b": { source: "track", recordingId: "runtime-run" },
        "runtime-a": "photo",
      },
    });
    const json = serializeProjectManifest(manifest);

    expect(parseProjectManifest(json)).toEqual(manifest);
    expect(manifest).toMatchObject({
      schemaVersion: PROJECT_SCHEMA_VERSION,
      title: "Dolomites",
      timezone: "Europe/Rome",
      order: "manual",
      photos: [
        {
          identity: { fileName: "b.jpg", fileSize: 5, occurrence: 0 },
          selectedRecordingDigest: "sha256-run",
        },
        {
          identity: { fileName: "a.jpg", fileSize: 5, occurrence: 0 },
          clockOffsetMinutes: 120,
        },
      ],
      recordings: [
        { digest: "sha256-walk", included: false },
        { digest: "sha256-run", included: true },
      ],
    });
    expect(json).not.toContain("blob:");
    expect(json).not.toContain("runtime-");
  });

  test("restores order and decisions onto fresh runtime identities", () => {
    const savedPhotos = [
      photo("old-second", "same.jpg"),
      photo("old-first", "same.jpg"),
    ];
    const savedRecordings = [
      recording("old-track", "stable-digest", true),
      recording("old-excluded", "excluded-digest", false),
    ];
    const manifest = createProjectManifest({
      title: "Repeated names",
      timezone: "UTC",
      order: "manual",
      photos: savedPhotos,
      recordings: savedRecordings,
      offsetMinutesByPhoto: { "old-second": -60, "old-first": 90 },
      recordingChoices: {
        "old-first": { source: "track", recordingId: "old-track" },
      },
    });
    // ZIP extraction can replace lastModified and every import creates new object IDs.
    const importedPhotos = [
      photo("new-second", "same.jpg", "photo", 10_000),
      photo("new-first", "same.jpg", "photo", 20_000),
    ];
    const importedRecordings = [
      recording("new-track", "stable-digest", true),
      recording("new-excluded", "excluded-digest", true),
    ];

    const restored = restoreProjectManifest(
      manifest,
      importedPhotos,
      importedRecordings,
    );

    expect(restored.photos.map(({ id }) => id)).toEqual([
      "new-second",
      "new-first",
    ]);
    expect(restored.offsetMinutesByPhoto).toEqual({
      "new-second": -60,
      "new-first": 90,
    });
    expect(restored.recordingChoices).toEqual({
      "new-first": { source: "track", recordingId: "new-track" },
    });
    expect(restored.recordings.map(({ included }) => included)).toEqual([
      true,
      false,
    ]);
    expect(restored).toMatchObject({
      title: "Repeated names",
      timezone: "UTC",
      order: "manual",
      unmatchedPhotoCount: 0,
      unmatchedRecordingCount: 0,
    });
  });

  test("round-trips the presented-photo selection while keeping every original", () => {
    const originals = [photo("a", "a.jpg"), photo("b", "b.jpg")];
    const manifest = createProjectManifest({
      title: "Curated",
      timezone: "UTC",
      order: "capture",
      photos: originals,
      recordings: [],
      shownByPhoto: { a: false, b: true },
      showAllPhotos: false,
    });
    expect(manifest).toMatchObject({
      schemaVersion: 2,
      photoSelectionMode: "automatic",
      photos: [{ shown: false }, { shown: true }],
    });
    const restored = restoreProjectManifest(
      parseProjectManifest(serializeProjectManifest(manifest))!,
      [photo("new-a", "a.jpg"), photo("new-b", "b.jpg")],
      [],
    );
    expect(restored.shownByPhoto).toEqual({ "new-a": false, "new-b": true });
    expect(restored.showAllPhotos).toBe(false);
    expect(restored.photos).toHaveLength(2);
  });

  test("opens version 1 projects with every photo visible", () => {
    const current = createProjectManifest({
      title: "Legacy",
      timezone: "UTC",
      order: "capture",
      photos: [photo("a", "a.jpg")],
      recordings: [],
    });
    const legacy = {
      ...current,
      schemaVersion: 1,
      photoSelectionMode: undefined,
      photos: current.photos.map(({ shown: _shown, ...entry }) => entry),
    };
    const parsed = parseProjectManifest(legacy)!;
    expect(parsed.schemaVersion).toBe(1);
    expect(
      restoreProjectManifest(parsed, [photo("new-a", "a.jpg")], [])
        .showAllPhotos,
    ).toBe(true);
  });

  test("keeps unmatched imports and reports missing saved files", () => {
    const manifest = createProjectManifest({
      title: "Partial",
      timezone: "UTC",
      order: "capture",
      photos: [photo("old", "missing.jpg")],
      recordings: [recording("old-track", "missing-digest", true)],
    });
    const extra = photo("extra", "extra.jpg");
    const restored = restoreProjectManifest(manifest, [extra], []);
    expect(restored.photos).toEqual([extra]);
    expect(restored).toMatchObject({
      unmatchedPhotoCount: 1,
      unmatchedRecordingCount: 1,
    });
  });

  test("rejects malformed, invalid, and unsupported manifests safely", () => {
    const valid = createProjectManifest({
      title: "Safe",
      timezone: "UTC",
      order: "capture",
      photos: [photo("one", "one.jpg")],
      recordings: [],
    });
    expect(parseProjectManifest("not JSON")).toBeUndefined();
    expect(
      parseProjectManifest({ ...valid, schemaVersion: 0 }),
    ).toBeUndefined();
    expect(
      parseProjectManifest({ ...valid, timezone: "Mars/Olympus_Mons" }),
    ).toBeUndefined();
    expect(
      parseProjectManifest({
        ...valid,
        photos: [{ ...valid.photos[0], clockOffsetMinutes: 900 }],
      }),
    ).toBeUndefined();
    expect(
      parseProjectManifest({
        ...valid,
        photos: [
          { ...valid.photos[0], selectedRecordingDigest: "not-present" },
        ],
      }),
    ).toBeUndefined();
    expect(
      parseProjectManifest({
        ...valid,
        photos: [{ ...valid.photos[0], selectedRecordingDigest: "excluded" }],
        recordings: [{ digest: "excluded", included: false }],
      }),
    ).toBeUndefined();
  });
});
