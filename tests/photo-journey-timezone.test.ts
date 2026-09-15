import { describe, expect, test } from "vitest";

import {
  inferJourneyOffsetMinutes,
  inferJourneyTimezone,
} from "../src/components/tools/PhotoJourney/journey-timezone";
import type {
  JourneyPhoto,
  JourneyRecording,
} from "../src/components/tools/PhotoJourney/types";

function photo(
  latitude?: number,
  longitude?: number,
  utcOffsetMinutes?: number,
): JourneyPhoto {
  return {
    id: "photo",
    name: "photo",
    file: { size: 1 } as File,
    url: "blob:original",
    thumbnailUrl: "blob:preview",
    importOrder: 0,
    metadata: {
      coordinates:
        latitude === undefined || longitude === undefined
          ? undefined
          : { latitude, longitude },
      utcOffsetMinutes,
      modifiedAtLabel: "-",
      dimensions: "1 × 1",
      fileSize: "1 KB",
      fileType: "JPEG",
      details: [],
    },
  };
}

function recording(
  included: boolean,
  points: JourneyRecording["track"]["points"],
): JourneyRecording {
  return {
    id: "recording",
    name: "recording",
    digest: "digest",
    file: { size: 1 } as File,
    importOrder: 0,
    included,
    warnings: [],
    track: { points, segmentStarts: points.length ? [0] : [] },
  };
}

describe("journey timezone inference", () => {
  test("uses GPX geography when a photo has no timezone or GPS", () => {
    expect(
      inferJourneyTimezone(
        [photo()],
        [
          recording(true, [
            { latitude: 46.4708, longitude: 11.5521 },
            { latitude: 46.4817, longitude: 11.5657 },
          ]),
        ],
      ),
    ).toBe("Europe/Rome");
  });

  test("uses geotagged photos when no recording is available", () => {
    expect(inferJourneyTimezone([photo(40.7128, -74.006)], [])).toBe(
      "America/New_York",
    );
  });

  test("ignores excluded recordings", () => {
    expect(
      inferJourneyTimezone(
        [],
        [recording(false, [{ latitude: 35.6762, longitude: 139.6503 }])],
      ),
    ).toBeUndefined();
  });

  test("inherits a dominant explicit offset when location data is unavailable", () => {
    expect(
      inferJourneyOffsetMinutes([
        photo(undefined, undefined, 120),
        photo(undefined, undefined, 120),
        photo(undefined, undefined, 60),
        photo(),
      ]),
    ).toBe(120);
  });

  test("does not guess between equally represented offsets", () => {
    expect(
      inferJourneyOffsetMinutes([
        photo(undefined, undefined, 120),
        photo(undefined, undefined, 60),
      ]),
    ).toBeUndefined();
  });
});
