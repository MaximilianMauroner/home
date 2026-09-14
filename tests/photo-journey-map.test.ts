import { describe, expect, test } from "vitest";

import {
  approachAnimationDuration,
  cameraFrameForPoints,
  checkpointMarkerPhotoIndex,
  interpolateJourneyBearing,
  interpolateJourneyCamera,
  isUserMapMovement,
  journeyCameraBearing,
  journeyCameraPitch,
  previousRecordedLeg,
  routeTipForPlacement,
  suppressedMarkerIndexes,
  TERRAIN_PITCH,
} from "../src/components/tools/PhotoJourney/JourneyMap";
import type { RecordedLeg } from "../src/components/tools/PhotoJourney/route-progress";
import {
  trackStats,
  type Track,
} from "../src/components/tools/PhotoJourney/gpx";

describe("Photo Journey map timing and recording budgets", () => {
  test("uses the current photo for an active grouped checkpoint marker", () => {
    const checkpoint = { photoIndex: 11, photoIndices: [11, 12, 13] };
    expect(checkpointMarkerPhotoIndex(checkpoint, 12, true)).toBe(12);
    expect(checkpointMarkerPhotoIndex(checkpoint, 12, false)).toBe(11);
  });

  test("keeps timeline and MapLibre animation units in milliseconds", () => {
    expect(approachAnimationDuration(3_000, 1)).toBe(3_000);
    expect(approachAnimationDuration(3_000, 2)).toBe(1_500);
  });

  test("shows a time-resolved GPX pause position but not an unmatched photo", () => {
    const pausePosition = { latitude: 46.47, longitude: 11.6014 };
    expect(
      routeTipForPlacement({
        photoId: "paused",
        source: "track",
        coordinates: pausePosition,
        recordingGap: true,
      }),
    ).toEqual(pausePosition);
    expect(
      routeTipForPlacement({ photoId: "unknown", source: "none" }),
    ).toBeUndefined();
  });

  test("scales only the remaining phase time after a pause or speed change", () => {
    const remainingTimelineMs = 1_800;
    expect(approachAnimationDuration(remainingTimelineMs, 0.75)).toBe(2_400);
    expect(approachAnimationDuration(remainingTimelineMs, 1)).toBe(1_800);
    expect(approachAnimationDuration(remainingTimelineMs, 1.5)).toBe(1_200);
    expect(approachAnimationDuration(remainingTimelineMs, 2)).toBe(900);
    // Changing speed halfway through a leg uses what is left, never the original 3,000 ms.
    expect(approachAnimationDuration(1_500, 2)).toBe(750);
  });

  test("handles recording-sized arrays without spread argument limits", () => {
    const points = Array.from({ length: 20_000 }, (_, index) => ({
      latitude: 45,
      longitude: 11 + index / 1_000,
      elevation: index % 2 ? 100 : 101,
      time: index * 1_000,
    }));
    const track: Track = { points, segmentStarts: [0] };
    const stats = trackStats(track);
    expect(stats.pointCount).toBe(points.length);
    expect(stats.start?.valueOf()).toBe(0);
    expect(stats.end?.valueOf()).toBe((points.length - 1) * 1_000);
  });

  test("distinguishes programmatic camera updates from user movement", () => {
    expect(isUserMapMovement({})).toBe(false);
    expect(isUserMapMovement({ originalEvent: new Event("wheel") })).toBe(true);
  });

  test("derives camera composition from geometry, viewport, and drawer padding", () => {
    const points = [
      { latitude: 48, longitude: 16 },
      { latitude: 48.005, longitude: 16.01 },
    ];
    const first = cameraFrameForPoints(
      points,
      { width: 1200, height: 700 },
      70,
      18,
      { top: 0, right: 480, bottom: 0, left: 0 },
    );
    const second = cameraFrameForPoints(
      points,
      { width: 1200, height: 700 },
      70,
      18,
      { top: 0, right: 480, bottom: 0, left: 0 },
    );
    expect(first).toEqual(second);
    expect(first.zoom).toBeGreaterThan(10);
  });

  test("tilts local terrain and preserves flat, globe, and reduced-motion views", () => {
    expect(journeyCameraPitch("terrain", false, false)).toBe(45);
    expect(journeyCameraPitch("online", false, false)).toBe(0);
    expect(journeyCameraPitch("offline", false, false)).toBe(0);
    expect(journeyCameraPitch("terrain", true, false)).toBe(0);
    expect(journeyCameraPitch("terrain", false, true)).toBe(0);
  });

  test("faces terrain travel along the route while flat and reduced views stay north-up", () => {
    const eastbound = [
      { latitude: 48, longitude: 16 },
      { latitude: 48, longitude: 16.01 },
    ];
    expect(journeyCameraBearing(eastbound, "terrain", false)).toBeCloseTo(
      90,
      1,
    );
    expect(journeyCameraBearing(eastbound, "online", false)).toBe(0);
    expect(journeyCameraBearing(eastbound, "terrain", true)).toBe(0);
    expect(journeyCameraBearing([eastbound[0]], "terrain", false)).toBe(0);
  });

  test("interpolates headings across the shortest deterministic turn", () => {
    expect(interpolateJourneyBearing(170, -170, 0)).toBe(170);
    expect(interpolateJourneyBearing(170, -170, 0.25)).toBe(175);
    expect(interpolateJourneyBearing(170, -170, 0.5)).toBe(180);
    expect(interpolateJourneyBearing(170, -170, 1)).toBe(190);
  });

  test("blends camera center and zoom without crossing the long side of the globe", () => {
    expect(
      interpolateJourneyCamera(
        { center: [0, 0], zoom: 10 },
        { center: [8, 4], zoom: 14 },
        0.25,
      ),
    ).toEqual({ center: [2, 1], zoom: 11 });
    expect(
      interpolateJourneyCamera(
        { center: [179, 10], zoom: 12 },
        { center: [-179, 14], zoom: 14 },
        0.5,
      ),
    ).toEqual({ center: [180, 12], zoom: 13 });
  });

  test("does not rewind the camera across an unanimated route gap", () => {
    const point = (longitude: number) => ({
      latitude: 48,
      longitude,
      time: longitude * 1_000,
    });
    const leg = (from: number, to: number): RecordedLeg => ({
      points: [point(from), point(to)],
      drawable: [point(from), point(to)],
      cumulativeKm: [0, 1],
      distanceKm: 1,
      segmentIndex: 0,
    });
    const first = leg(0, 1);
    const active = leg(1, 2);
    expect(
      previousRecordedLeg([undefined, first, undefined, active], 3, active),
    ).toBeUndefined();
    expect(previousRecordedLeg([undefined, first, active], 2, active)).toBe(
      first,
    );
  });

  test("marks the last verified trail point when a photo is not matched", () => {
    const point = { latitude: 48, longitude: 16 };
    expect(
      routeTipForPlacement({
        photoId: "matched",
        source: "track",
        coordinates: point,
      }),
    ).toEqual(point);
    expect(
      routeTipForPlacement({
        photoId: "unmatched",
        source: "carried",
        coordinates: point,
      }),
    ).toEqual(point);
    expect(
      routeTipForPlacement({
        photoId: "ambiguous",
        source: "carried",
        coordinates: point,
        ambiguous: true,
      }),
    ).toBeUndefined();
  });

  test.each([
    { width: 1200, height: 700, right: 480, bottom: 0 },
    { width: 390, height: 600, right: 0, bottom: 312 },
    { width: 390, height: 600, right: 0, bottom: 432 },
  ])(
    "fits tilted route corners outside the drawer at $width × $height with bottom $bottom",
    (layout) => {
      const padding = {
        top: 0,
        left: 0,
        right: layout.right,
        bottom: layout.bottom,
      };
      const points = [
        { latitude: 46.5, longitude: 11.5 },
        { latitude: 46.52, longitude: 11.55 },
        { latitude: 46.5, longitude: 11.55 },
        { latitude: 46.52, longitude: 11.5 },
      ];
      const view = cameraFrameForPoints(
        points,
        layout,
        70,
        18,
        padding,
        TERRAIN_PITCH,
      );
      const worldY = (latitude: number) =>
        (1 - Math.asinh(Math.tan((latitude * Math.PI) / 180)) / Math.PI) / 2;
      const worldSize = 512 * 2 ** view.zoom;
      const distance = layout.height * 1.5;
      const radians = (TERRAIN_PITCH * Math.PI) / 180;
      for (const point of points) {
        const dx = ((point.longitude - view.center[0]) / 360) * worldSize;
        const dy =
          (worldY(point.latitude) - worldY(view.center[1])) * worldSize;
        const perspective = distance / (distance - dy * Math.sin(radians));
        const x = (layout.width - padding.right) / 2 + dx * perspective;
        const y =
          (layout.height - padding.bottom) / 2 +
          dy * Math.cos(radians) * perspective;
        expect(x).toBeGreaterThanOrEqual(70 - 1e-6);
        expect(x).toBeLessThanOrEqual(layout.width - padding.right - 70 + 1e-6);
        expect(y).toBeGreaterThanOrEqual(70 - 1e-6);
        expect(y).toBeLessThanOrEqual(
          layout.height - padding.bottom - 70 + 1e-6,
        );
      }
    },
  );

  test("keeps degenerate tilted frames finite", () => {
    for (const points of [[], [{ latitude: 46.5, longitude: 11.5 }]]) {
      const view = cameraFrameForPoints(
        points,
        { width: 390, height: 600 },
        70,
        15,
        undefined,
        TERRAIN_PITCH,
      );
      expect(view.center.every(Number.isFinite)).toBe(true);
      expect(Number.isFinite(view.zoom)).toBe(true);
      expect(view.zoom).toBeLessThanOrEqual(15);
    }
  });

  test("suppresses colliding markers with priority order preserved", () => {
    const boxes = [
      { left: 0, top: 0, right: 40, bottom: 40 },
      { left: 20, top: 20, right: 60, bottom: 60 },
      { left: 200, top: 200, right: 240, bottom: 240 },
    ];
    expect([...suppressedMarkerIndexes(boxes)]).toEqual([1]);
  });

  test("handles a dense 400-marker collision pass", () => {
    const boxes = Array.from({ length: 400 }, (_, index) => ({
      left: (index % 20) * 50,
      top: Math.floor(index / 20) * 50,
      right: (index % 20) * 50 + 24,
      bottom: Math.floor(index / 20) * 50 + 24,
    }));
    expect(suppressedMarkerIndexes(boxes).size).toBe(0);
  });
});
