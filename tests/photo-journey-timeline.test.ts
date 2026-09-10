import { describe, expect, test } from "vitest";

import {
  buildTimeline,
  distanceKm,
  cameraFor,
  locatedPoints,
  resolveStops,
  routeSegments,
  timelineAt,
} from "../src/components/tools/PhotoJourney/timeline";
import type { JourneyPhoto } from "../src/components/tools/PhotoJourney/types";

function photo(latitude?: number, longitude?: number): JourneyPhoto {
  return {
    id: `${latitude}-${longitude}`,
    file: { size: 100 } as File,
    url: "blob:test",
    thumbnailUrl: "blob:test-thumb",
    name: "Test",
    importOrder: 0,
    metadata: {
      coordinates:
        latitude === undefined || longitude === undefined
          ? undefined
          : { latitude, longitude },
      dimensions: "100 × 100",
      fileSize: "1 KB",
      fileType: "JPEG",
      modifiedAtLabel: "Jan 1, 2024",
      details: [],
    },
  };
}

describe("Photo Journey timeline", () => {
  test("opens and closes on the route with variable stop offsets", () => {
    const timeline = buildTimeline([photo(48, 16), photo(40, -74)]);
    expect(timelineAt(0, timeline).phase).toBe("intro");
    const second = timeline.stops[1];
    expect(timelineAt(second.start, timeline).phase).toBe("approach");
    expect(timelineAt(second.revealStart, timeline).panelVisible).toBe(true);
    expect(timelineAt(second.end, timeline).phase).toBe("outro");
    expect(timelineAt(timeline.totalDuration, timeline).phase).toBe(
      "complete",
    );
    expect(second.approachDuration).toBeGreaterThan(2000);
  });
  test("groups days and collapses same-minute nearby bursts", () => {
    const photos = [photo(48, 16), photo(48, 16), photo(49, 17)];
    photos[0].metadata.capturedAt = new Date("2024-03-14T12:00:01Z");
    photos[1].metadata.capturedAt = new Date("2024-03-14T12:00:50Z");
    photos[2].metadata.capturedAt = new Date("2024-03-15T12:00:00Z");
    const timeline = buildTimeline(photos);
    expect(timeline.stops[1].burst).toBe(true);
    expect(timeline.stops[1].approachDuration).toBe(0);
    expect(timeline.stops[1].duration).toBeLessThan(timeline.stops[0].duration);
    expect(timelineAt(timeline.stops[2].dayStart, timeline).dayLabel).toContain(
      "Day 2",
    );
  });
  test("uses great-circle distances across the date line", () => {
    expect(
      distanceKm(
        { latitude: 0, longitude: 179 },
        { latitude: 0, longitude: -179 },
      ),
    ).toBeCloseTo(222.39, 1);
  });
  test("reports no phase for an empty journey", () => {
    expect(timelineAt(0, buildTimeline([]))).toMatchObject({
      phase: "overview",
    });
  });

  test("carries the last known position across photos without GPS", () => {
    const stops = resolveStops([
      photo(48.2, 16.37),
      photo(),
      photo(40.71, -74),
    ]);
    expect(stops[1]).toMatchObject({
      coordinates: { latitude: 48.2, longitude: 16.37 },
      located: false,
    });
    expect(stops[2]).toMatchObject({ located: true });
  });

  test("leaves the map alone until the first position is known", () => {
    const stops = resolveStops([photo(), photo(48.2, 16.37)]);
    expect(stops[0].coordinates).toBeUndefined();
    expect(cameraFor(stops, 0)).toBeUndefined();
  });

  test("holds still rather than flying to 0°, 0° on a photo without GPS", () => {
    const stops = resolveStops([photo(48.2, 16.37), photo()]);
    const move = cameraFor(stops, 1);
    expect(move).toEqual({ center: { latitude: 48.2, longitude: 16.37 } });
    expect(move?.from).toBeUndefined();
  });

  test("reports the leg it is leaving when the location changes", () => {
    const stops = resolveStops([photo(48.2, 16.37), photo(40.71, -74)]);
    expect(cameraFor(stops, 1)).toEqual({
      center: { latitude: 40.71, longitude: -74 },
      from: { latitude: 48.2, longitude: 16.37 },
    });
  });

  test("does not draw a false line across the antimeridian", () => {
    const segments = routeSegments(
      locatedPoints([photo(0, 179), photo(0, -179)]),
    );
    expect(segments).toEqual([
      [
        { latitude: 0, longitude: 179 },
        { latitude: 0, longitude: 180 },
      ],
      [
        { latitude: 0, longitude: -180 },
        { latitude: 0, longitude: -179 },
      ],
    ]);
  });

  test("skips photos without GPS when drawing the route", () => {
    expect(locatedPoints([photo(1, 1), photo(), photo(2, 2)])).toEqual([
      { latitude: 1, longitude: 1 },
      { latitude: 2, longitude: 2 },
    ]);
  });
});
