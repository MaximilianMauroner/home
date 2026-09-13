import { describe, expect, test } from "vitest";

import {
  buildTimeline,
  distanceKm,
  cameraFor,
  inferredRouteSegments,
  locatedPoints,
  placementLegEligibility,
  recordedApproachDuration,
  routeSegments,
  timelineAt,
} from "../src/components/tools/PhotoJourney/timeline";
import {
  journeyStops,
  resolvePlacements,
} from "../src/components/tools/PhotoJourney/track";
import { legSpansGlobe } from "../src/components/tools/PhotoJourney/JourneyMap";
import type { JourneyPhoto } from "../src/components/tools/PhotoJourney/types";
import type { Placement } from "../src/components/tools/PhotoJourney/track";

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

/** Where the stops land with no track loaded: each photo's own fix, carried forward when missing. */
function stopsFor(photos: JourneyPhoto[]) {
  return journeyStops(resolvePlacements(photos));
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
  test("publishes exact phase boundaries for reveal, hold, departure, and ending", () => {
    const timeline = buildTimeline([photo(48, 16)]);
    const stop = timeline.stops[0];
    expect(timelineAt(stop.revealStart, timeline)).toMatchObject({
      phase: "reveal",
      phaseStart: stop.revealStart,
      phaseEnd: stop.revealEnd,
      phaseProgress: 0,
      currentLegProgress: 1,
    });
    expect(timelineAt(stop.revealEnd, timeline).phase).toBe("hold");
    expect(timelineAt(stop.departureStart, timeline)).toMatchObject({
      phase: "departure",
      phaseStart: stop.departureStart,
      phaseEnd: stop.end,
      panelVisible: true,
    });
    const middle = timelineAt(stop.departureStart + (stop.end - stop.departureStart) / 2, timeline);
    expect(middle.phaseProgress).toBe(0.5);
    expect(middle.phaseRemaining).toBe(middle.phaseDuration / 2);
    expect(timelineAt(stop.end, timeline).phase).toBe("outro");
    expect(timelineAt(timeline.totalDuration, timeline)).toMatchObject({
      phase: "complete",
      phaseProgress: 1,
      phaseRemaining: 0,
    });
  });

  test("only marks same-source, forward, within-day recording legs as structurally eligible", () => {
    const placement = (photoId: string, instant: number, recordingId = "walk"): Placement => ({
      photoId,
      instant,
      recordingId,
      recordingSegmentId: "0:0",
      recordingDistanceKm: instant / 1000,
      gapSeconds: 0,
      source: "photo",
      coordinates: { latitude: instant, longitude: instant },
      trackCoordinates: { latitude: instant + 1, longitude: instant + 1 },
    });
    const forward = [placement("a", 1), placement("b", 2)];
    expect(placementLegEligibility(forward, ["2025-03-14", "2025-03-14"])).toEqual([false, true]);
    expect(placementLegEligibility(forward, ["2025-03-14", "2025-03-15"])).toEqual([false, false]);
    expect(placementLegEligibility([forward[1], forward[0]], ["2025-03-14", "2025-03-14"])).toEqual([true, false]);
    expect(placementLegEligibility([forward[0], placement("b", 2, "bike")], ["2025-03-14", "2025-03-14"])).toEqual([false, true]);
    expect(placementLegEligibility([forward[0], placement("b", 2, "bike")], ["2025-03-14", "2025-03-15"])).toEqual([false, false]);
    expect(placementLegEligibility([forward[0], { ...forward[1], ambiguous: true }], ["2025-03-14", "2025-03-14"])).toEqual([false, false]);
  });
  test("uses actual recorded distance for calm entry and consistent leg timing", () => {
    expect(recordedApproachDuration(0, true)).toBe(0);
    expect(recordedApproachDuration(2, true)).toBe(7_600);
    expect(recordedApproachDuration(20, true)).toBe(18_000);
    expect(recordedApproachDuration(2, false)).toBe(3_000);
    expect(recordedApproachDuration(20, false)).toBe(18_000);
  });
  test("groups days and collapses same-minute nearby bursts", () => {
    const photos = [photo(48, 16), photo(48, 16), photo(49, 17)];
    photos[0].metadata.capturedAt = new Date("2024-03-14T12:00:01Z");
    photos[1].metadata.capturedAt = new Date("2024-03-14T12:00:50Z");
    photos[2].metadata.capturedAt = new Date("2024-03-15T12:00:00Z");
    const timeline = buildTimeline(photos);
    expect(timeline.stops).toHaveLength(2);
    expect(timeline.stops[0].burst).toBe(true);
    expect(timeline.stops[0].photoIndices).toEqual([0, 1]);
    expect(timelineAt(timeline.stops[1].dayStart, timeline)).toMatchObject({
      phase: "day",
      dayChange: true,
      phaseStart: timeline.stops[1].dayStart,
      phaseEnd: timeline.stops[1].start,
    });
    expect(timelineAt(timeline.stops[1].dayStart, timeline).dayLabel).toContain("Day 2");
  });
  test("splits a moving burst before its hidden recorded progress accumulates", () => {
    const photos = [photo(48, 16), photo(48, 16), photo(48, 16)];
    const timeline = buildTimeline(
      photos,
      photos.map((entry) => entry.metadata.coordinates),
      [0, 10_000, 20_000],
      {
        recordingIds: ["walk", "walk", "walk"],
        recordingSegmentIds: ["walk:0", "walk:0", "walk:0"],
        recordingDistancesKm: [0, 0.04, 0.08],
      },
    );
    expect(timeline.stops.map((stop) => stop.photoIndices)).toEqual([[0, 1], [2]]);
  });
  test("times legs by the real gap on the tour when shutter instants are known", () => {
    const pair = [photo(48, 16), photo(48.1, 16.1)];
    const positions = pair.map((entry) => entry.metadata.coordinates);
    const flat = buildTimeline(pair, positions);
    const twoHours = buildTimeline(pair, positions, [0, 2 * 3_600_000]);
    expect(twoHours.stops[1].approachDuration).toBeGreaterThan(flat.stops[1].approachDuration);
    const twoDays = buildTimeline(pair, positions, [0, 48 * 3_600_000]);
    expect(twoDays.stops[1].approachDuration).toBeLessThanOrEqual(6000);
    // Without instants the distance formula still rules.
    expect(flat.stops[1].approachDuration).toBeLessThanOrEqual(3000);
  });
  test("uses resolved instants for nearby burst grouping", () => {
    const pair = [photo(48, 16), photo(48, 16)];
    const timeline = buildTimeline(pair, pair.map((entry) => entry.metadata.coordinates), [0, 30_000]);
    expect(timeline.stops).toHaveLength(1);
    expect(timeline.stops[0].burst).toBe(true);
    expect(timeline.stops[0].photoIndices).toEqual([0, 1]);
    expect(timelineAt(timeline.stops[0].revealEnd + 1_250, timeline).photoIndex).toBe(1);
  });
  test("derives checkpoint, drawer, and image substages from the reveal clock", () => {
    const timeline = buildTimeline([photo(48, 16)]);
    const stop = timeline.stops[0];
    expect(timelineAt(stop.revealStart, timeline)).toMatchObject({ checkpointProgress: 0, drawerProgress: 0, imageProgress: 0 });
    expect(timelineAt(stop.revealStart + 130, timeline).checkpointProgress).toBe(0.5);
    expect(timelineAt(stop.revealStart + 169, timeline).drawerProgress).toBe(0.5);
    expect(timelineAt(stop.revealStart + 291.2, timeline).imageProgress).toBeCloseTo(0.5);
  });
  test("does not group bursts across recording or location boundaries", () => {
    const pair = [photo(48, 16), photo(48, 16)];
    const positions = pair.map((entry) => entry.metadata.coordinates);
    expect(buildTimeline(pair, positions, [0, 30_000], { recordingIds: ["a", "b"] }).stops).toHaveLength(2);
    expect(buildTimeline(pair, positions, [0, 30_000], { recordingIds: ["a", "a"], recordingSegmentIds: ["0:0", "0:1"] }).stops).toHaveLength(2);
    expect(buildTimeline(pair, positions, [0, 30_000], { located: [true, false] }).stops).toHaveLength(2);
    expect(buildTimeline(pair, positions, [0, 30_000], {
      recordingIds: ["a", "a"], recordingSegmentIds: ["0:0", "0:0"], recordingDistancesKm: [0.1, 0.3],
    }).stops).toHaveLength(2);
  });
  test("travels into a grouped visit and keeps its last image through departure", () => {
    const photos = [photo(48, 16), photo(48.01, 16.01), photo(48.01, 16.01), photo(48.01, 16.01), photo(48.02, 16.02)];
    const timeline = buildTimeline(
      photos,
      photos.map((entry) => entry.metadata.coordinates),
      [0, 600_000, 610_000, 620_000, 1_200_000],
      {
        legEligibility: [false, true, true, true, true],
        recordingIds: Array(5).fill("walk"),
        recordingSegmentIds: Array(5).fill("0:0"),
        recordingDistancesKm: [0, 0.2, 0.2, 0.2, 0.4],
        located: Array(5).fill(true),
      },
    );
    expect(timeline.stops.map((stop) => stop.photoIndices)).toEqual([[0], [1, 2, 3], [4]]);
    expect(timeline.stops[1].approachDuration).toBeGreaterThan(0);
    expect(timeline.legEligibility).toEqual([false, true, true, true, true]);
    const grouped = timeline.stops[1];
    expect(timelineAt(grouped.departureStart - 1, timeline).photoIndex).toBe(3);
    expect(timelineAt(grouped.departureStart, timeline).photoIndex).toBe(3);
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

  test("locates a late stop in a 400-photo timeline", () => {
    const photos = Array.from({ length: 400 }, (_, index) => photo(48 + index / 10_000, 16));
    const timeline = buildTimeline(photos);
    const late = timeline.stops[390];
    expect(timelineAt(late.revealEnd, timeline)).toMatchObject({
      photoIndex: 390,
      checkpointIndex: 390,
      phase: "hold",
    });
  });

  test("carries the last known position across photos without GPS", () => {
    const stops = stopsFor([
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
    const stops = stopsFor([photo(), photo(48.2, 16.37)]);
    expect(stops[0].coordinates).toBeUndefined();
    expect(cameraFor(stops, 0)).toBeUndefined();
  });

  test("holds still rather than flying to 0°, 0° on a photo without GPS", () => {
    const stops = stopsFor([photo(48.2, 16.37), photo()]);
    const move = cameraFor(stops, 1);
    expect(move).toEqual({ center: { latitude: 48.2, longitude: 16.37 } });
    expect(move?.from).toBeUndefined();
  });

  test("reports the leg it is leaving when the location changes", () => {
    const stops = stopsFor([photo(48.2, 16.37), photo(40.71, -74)]);
    expect(cameraFor(stops, 1)).toEqual({
      center: { latitude: 40.71, longitude: -74 },
      from: { latitude: 48.2, longitude: 16.37 },
    });
  });

  test("does not draw a false line across the antimeridian", () => {
    const segments = routeSegments(
      locatedPoints(stopsFor([photo(0, 179), photo(0, -179)])),
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
    expect(locatedPoints(stopsFor([photo(1, 1), photo(), photo(2, 2)]))).toEqual([
      { latitude: 1, longitude: 1 },
      { latitude: 2, longitude: 2 },
    ]);
  });

  test("splits inferred photo connections at missing fixes and day boundaries", () => {
    const stops = stopsFor([
      photo(1, 1),
      photo(2, 2),
      photo(),
      photo(3, 3),
      photo(4, 4),
      photo(5, 5),
    ]);
    expect(inferredRouteSegments(stops, [false, false, false, false, false, true])).toEqual([
      [{ latitude: 1, longitude: 1 }, { latitude: 2, longitude: 2 }],
      [{ latitude: 3, longitude: 3 }, { latitude: 4, longitude: 4 }],
    ]);
  });

  test("sends only long legs to the globe projection", () => {
    // Vienna to New York: ~6 800 km, arcs instead of smearing.
    expect(
      legSpansGlobe([
        { latitude: 48.2, longitude: 16.37 },
        { latitude: 40.71, longitude: -74 },
      ]),
    ).toBe(true);
    // A Dolomites day: stays on Mercator.
    expect(
      legSpansGlobe([
        { latitude: 46.46, longitude: 11.56 },
        { latitude: 46.48, longitude: 11.66 },
      ]),
    ).toBe(false);
    expect(legSpansGlobe([])).toBe(false);
  });
});
