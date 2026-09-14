import { describe, expect, test } from "vitest";
import {
  projectVideoPoint,
  videoBounds,
  VIDEO_HEIGHT,
  VIDEO_OUTPUT_RESOLUTIONS,
  VIDEO_WIDTH,
} from "../src/components/tools/PhotoJourney/video-export";
import type { Track } from "../src/components/tools/PhotoJourney/gpx";

describe("Photo Journey MP4 layout", () => {
  test("prefers 4K and never falls below 1080p", () => {
    expect(VIDEO_OUTPUT_RESOLUTIONS).toEqual([
      { width: 3840, height: 2160, label: "4K" },
      { width: 1920, height: 1080, label: "1080p" },
    ]);
  });

  test("keeps an antimeridian route compact", () => {
    const track: Track = {
      points: [
        { latitude: 10, longitude: 179 },
        { latitude: 11, longitude: -179 },
      ],
      segmentStarts: [0],
    };
    const bounds = videoBounds(track, [])!;

    expect(bounds.maxLongitude - bounds.minLongitude).toBe(2);
    for (const point of track.points) {
      const projected = projectVideoPoint(point, bounds);
      expect(projected.x).toBeGreaterThan(VIDEO_WIDTH * 0.6);
      expect(projected.x).toBeLessThan(VIDEO_WIDTH);
      expect(projected.y).toBeGreaterThan(0);
      expect(projected.y).toBeLessThan(VIDEO_HEIGHT);
    }
  });

  test("uses GPX bounds instead of off-route camera coordinates", () => {
    const track: Track = {
      points: [
        { latitude: 46, longitude: 11 },
        { latitude: 46.1, longitude: 11.1 },
      ],
      segmentStarts: [0],
    };
    const bounds = videoBounds(track, [
      {
        photoId: "photo",
        source: "track",
        coordinates: { latitude: 46, longitude: 11 },
        trackCoordinates: { latitude: 46, longitude: 11 },
        discrepancyM: 50_000,
      },
    ])!;

    expect(bounds).toMatchObject({
      minLatitude: 46,
      maxLatitude: 46.1,
      minLongitude: 11,
      maxLongitude: 11.1,
    });
  });
});
