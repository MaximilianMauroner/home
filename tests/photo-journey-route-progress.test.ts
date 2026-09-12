import { describe, expect, test } from "vitest";

import { baseStyle, visibleRouteSegments } from "../src/components/tools/PhotoJourney/JourneyMap";
import { buildRouteStory, recordedLegFrame, routePrefix } from "../src/components/tools/PhotoJourney/route-progress";
import { placementLegEligibility } from "../src/components/tools/PhotoJourney/timeline";
import type { Track } from "../src/components/tools/PhotoJourney/gpx";
import type { Placement } from "../src/components/tools/PhotoJourney/track";

function placement(
  photoId: string,
  instant: number,
  trackCoordinates: { latitude: number; longitude: number },
  extra: Partial<Placement> = {},
): Placement {
  return {
    photoId,
    instant,
    recordingId: "walk",
    gapSeconds: 0,
    source: "photo",
    coordinates: { latitude: trackCoordinates.latitude + 0.01, longitude: trackCoordinates.longitude + 0.01 },
    trackCoordinates,
    ...extra,
  };
}

describe("Photo Journey recorded route presentation", () => {
  const points = [
    { latitude: 48, longitude: 16, time: 0 },
    { latitude: 48.05, longitude: 16.05, time: 1_000 },
    { latitude: 48.1, longitude: 16.1, time: 2_000 },
    { latitude: 49, longitude: 17, time: 86_400_000 },
    { latitude: 49.1, longitude: 17.1, time: 86_401_000 },
  ];
  const disconnected: Track = { points, segmentStarts: [0, 3] };

  test("reveals one exact forward segment while keeping selected photo GPS separate", () => {
    const placements = [placement("a", 0, points[0]), placement("b", 2_000, points[2])];
    const eligibility = placementLegEligibility(placements, ["2025-03-14", "2025-03-14"])!;
    const story = buildRouteStory(disconnected, placements, eligibility);
    expect(story.legs[1]?.points).toEqual(points.slice(0, 3));
    const halfway = visibleRouteSegments(story, 1, "approach", 0.5, true);
    expect(halfway.completed).toEqual([]);
    expect(halfway.current).toHaveLength(1);
    expect(halfway.current[0][0]).toEqual(points[0]);
    expect(halfway.current[0].at(-1)).not.toEqual(points[2]);
    expect(visibleRouteSegments(story, 1, "hold", 1, true).completed).toHaveLength(1);
  });

  test("never reveals untraveled recording context or its sample points", () => {
    const placements = [placement("a", 0, points[0]), placement("b", 2_000, points[2])];
    const story = buildRouteStory(disconnected, placements, [false, true]);

    expect(visibleRouteSegments(story, 0, "hold", 0, false)).toEqual({
      completed: [],
      current: [],
    });
    expect(visibleRouteSegments(story, 1, "complete", 1, true).completed).toEqual([
      story.legs[1]?.drawable,
    ]);
    expect(baseStyle().layers.map((layer) => layer.id)).not.toContain("route-points");
    expect(baseStyle().layers.map((layer) => layer.id)).not.toContain("route-context");
  });

  test("uses one route frame for the line tip and bounded camera window", () => {
    const placements = [placement("a", 0, points[0]), placement("b", 2_000, points[2])];
    const leg = buildRouteStory(disconnected, placements, [false, true]).legs[1]!;
    const frame = recordedLegFrame(leg, 0.5, 0.05, 0.1);
    expect(frame.tip).toEqual(frame.revealed.at(-1));
    expect(frame.window.length).toBeGreaterThan(1);
    expect(frame.travelledKm).toBeCloseTo(leg.distanceKm / 2);
  });

  test("does not join disconnected days, reversed manual order, or untimed runs", () => {
    const acrossGap = [placement("a", 2_000, points[2]), placement("b", 86_400_000, points[3])];
    expect(buildRouteStory(disconnected, acrossGap, [false, true]).legs[1]).toBeUndefined();

    const reversed = [placement("b", 2_000, points[2]), placement("a", 0, points[0])];
    const reversedEligibility = placementLegEligibility(reversed, ["2025-03-14", "2025-03-14"])!;
    expect(buildRouteStory(disconnected, reversed, reversedEligibility).legs[1]).toBeUndefined();

    const untimed: Track = {
      points: [points[0], { latitude: 48.02, longitude: 16.02 }, points[2]],
      segmentStarts: [0],
    };
    const placements = [placement("a", 0, points[0]), placement("b", 2_000, points[2])];
    expect(buildRouteStory(untimed, placements, [false, true]).legs[1]).toBeUndefined();
  });

  test("rejects ambiguous duplicate geometry instead of guessing a source", () => {
    const duplicate: Track = {
      points: [...points.slice(0, 3), ...points.slice(0, 3)],
      segmentStarts: [0, 3],
    };
    const placements = [placement("a", 0, points[0]), placement("b", 2_000, points[2])];
    expect(buildRouteStory(duplicate, placements, [false, true]).legs[1]).toBeUndefined();
  });

  test("keeps singleton context and reveals antimeridian progress on the short arc", () => {
    const prefix = routePrefix([
      { latitude: 0, longitude: 179, time: 0 },
      { latitude: 0, longitude: -179, time: 1_000 },
    ], 0.5);
    expect(prefix).toEqual([
      { latitude: 0, longitude: 179, time: 0 },
      { latitude: 0, longitude: 180, elevation: undefined, time: 500 },
    ]);
    expect(buildRouteStory({ points: [points[0]], segmentStarts: [0] }, [], []).context).toEqual([[points[0]]]);
  });
});
