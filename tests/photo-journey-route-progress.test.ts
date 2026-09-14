import { describe, expect, test } from "vitest";

import {
  baseStyle,
  visibleRouteSegments,
} from "../src/components/tools/PhotoJourney/JourneyMap";
import {
  buildRouteStory,
  recordedLegCameraFrame,
  recordedLegFrame,
  routePrefix,
} from "../src/components/tools/PhotoJourney/route-progress";
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
    recordingSegmentId: "0:0",
    recordingDistanceKm: instant / 1000,
    gapSeconds: 0,
    source: "photo",
    coordinates: {
      latitude: trackCoordinates.latitude + 0.01,
      longitude: trackCoordinates.longitude + 0.01,
    },
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
    const placements = [
      placement("a", 0, points[0]),
      placement("b", 2_000, points[2]),
    ];
    const eligibility = placementLegEligibility(placements, [
      "2025-03-14",
      "2025-03-14",
    ])!;
    const story = buildRouteStory(disconnected, placements, eligibility);
    expect(story.legs[1]?.points).toEqual(points.slice(0, 3));
    const halfway = visibleRouteSegments(story, 1, "approach", 0.5, true);
    expect(halfway.completed).toEqual([]);
    expect(halfway.current).toHaveLength(1);
    expect(halfway.current[0][0]).toEqual(points[0]);
    expect(halfway.current[0].at(-1)).not.toEqual(points[2]);
    expect(
      visibleRouteSegments(story, 1, "hold", 1, true).completed,
    ).toHaveLength(1);
  });

  test("keeps the full GPX separate from traveled progress and omits sample dots", () => {
    const placements = [
      placement("a", 0, points[0]),
      placement("b", 2_000, points[2]),
    ];
    const story = buildRouteStory(disconnected, placements, [false, true]);

    expect(visibleRouteSegments(story, 0, "hold", 0, false)).toEqual({
      completed: [],
      current: [],
    });
    expect(
      visibleRouteSegments(story, 1, "complete", 1, true).completed,
    ).toEqual([story.legs[1]?.drawable]);
    expect(baseStyle().layers.map((layer) => layer.id)).not.toContain(
      "route-points",
    );
    const layers = baseStyle().layers.map((layer) => layer.id);
    expect(layers.indexOf("route-context")).toBeGreaterThan(-1);
    expect(layers.indexOf("route-context")).toBeLessThan(
      layers.indexOf("route-completed"),
    );
    expect(story.context).toEqual([
      points.slice(0, 3).filter((_, index) => index !== 1),
      points.slice(3),
    ]);
  });

  test("uses one route frame for the line tip and bounded camera window", () => {
    const placements = [
      placement("a", 0, points[0]),
      placement("b", 2_000, points[2]),
    ];
    const leg = buildRouteStory(disconnected, placements, [false, true])
      .legs[1]!;
    const frame = recordedLegFrame(leg, 0.5, 0.05, 0.1);
    expect(frame.tip).toEqual(frame.revealed.at(-1));
    expect(frame.window.length).toBeGreaterThan(1);
    expect(frame.travelledKm).toBeCloseTo(leg.distanceKm / 2);

    const camera = recordedLegCameraFrame(leg, 0.5, 0.05, 0.1);
    expect(camera).toEqual({
      tip: frame.tip,
      window: frame.window,
      travelledKm: frame.travelledKm,
    });
    expect(camera).not.toHaveProperty("revealed");
  });

  test("animates the GPX prefix before the first photo from its recorded start", () => {
    const placements = [placement("a", 2_000, points[2])];
    const story = buildRouteStory(disconnected, placements, [true]);

    expect(story.legs[0]?.drawable).toEqual(simplified(points.slice(0, 3)));
    expect(
      visibleRouteSegments(story, 0, "approach", 0, true).completed,
    ).toEqual([]);
    expect(
      visibleRouteSegments(story, 0, "approach", 0.5, true).current[0].at(-1),
    ).not.toEqual(points[2]);
    expect(visibleRouteSegments(story, 0, "hold", 1, true).completed).toEqual([
      story.legs[0]!.drawable,
    ]);
  });

  test("recovers the selected sample when a checkpoint repeats the same coordinates", () => {
    const repeated = [
      { latitude: 48, longitude: 16, time: 0 },
      { latitude: 48.01, longitude: 16.01, time: 1_000 },
      { latitude: 48.01, longitude: 16.01, time: 3_000 },
    ];
    const selected = placement("pause", 2_000, repeated[1], {
      gapSeconds: 1,
      recordingSampleTime: 1_000,
    });
    const story = buildRouteStory(
      { points: repeated, segmentStarts: [0] },
      [selected],
      [true],
    );

    expect(story.legs[0]?.points).toEqual(repeated.slice(0, 2));
    expect(visibleRouteSegments(story, 0, "hold", 1, false).completed).toEqual([
      story.legs[0]!.drawable,
    ]);
  });

  test("shows recorded progress within the first grouped checkpoint", () => {
    const nearby = [
      points[0],
      { latitude: 48.0001, longitude: 16.0001, time: 2_000 },
    ];
    const placements = [
      placement("a", 0, nearby[0]),
      placement("b", 2_000, nearby[1]),
    ];
    const story = buildRouteStory(
      { points: nearby, segmentStarts: [0] },
      placements,
      [false, true],
    );

    for (const phase of ["reveal", "hold", "departure"] as const) {
      expect(
        visibleRouteSegments(story, 0, phase, 1, false, undefined, 1),
      ).toEqual({
        completed: [story.legs[1]!.drawable],
        current: [],
      });
    }
    expect(
      visibleRouteSegments(story, 0, "approach", 0.5, false, undefined, 1),
    ).toEqual({
      completed: [],
      current: [],
    });
  });

  test("keeps a checkpoint's known progress when its incoming GPX leg is unavailable", () => {
    const nearby = [
      points[0],
      { latitude: 48.0001, longitude: 16.0001, time: 2_000 },
    ];
    const placements = [
      placement("a", -1, nearby[0], { gapSeconds: 0.001 }),
      placement("b", 0, nearby[0]), // Two photos resolve to the same sample: no incoming movement.
      placement("c", 2_000, nearby[1]),
    ];
    const story = buildRouteStory(
      { points: nearby, segmentStarts: [0] },
      placements,
      [false, true, true],
    );
    expect(story.legs[1]).toBeUndefined();
    expect(story.legs[2]).toBeDefined();

    for (const phase of ["reveal", "hold", "departure"] as const) {
      expect(
        visibleRouteSegments(story, 1, phase, 1, true, undefined, 2).completed,
      ).toEqual([story.legs[2]!.drawable]);
    }
    expect(
      visibleRouteSegments(story, 1, "complete", 1, true, undefined, 2)
        .completed,
    ).toEqual([story.legs[2]!.drawable]);
  });

  test("does not mark an unavailable leg complete without animating it", () => {
    const placements = [
      placement("a", 0, points[0]),
      placement("b", 2_000, points[2]),
    ];
    const story = buildRouteStory(disconnected, placements, [false, false]);

    expect(story.legs[1]).toBeUndefined();
    expect(visibleRouteSegments(story, 1, "hold", 1, false).completed).toEqual(
      [],
    );
  });

  test("does not join disconnected days, reversed manual order, or untimed runs", () => {
    const acrossGap = [
      placement("a", 2_000, points[2]),
      placement("b", 86_400_000, points[3]),
    ];
    expect(
      buildRouteStory(disconnected, acrossGap, [false, true]).legs[1],
    ).toBeUndefined();

    const reversed = [
      placement("b", 2_000, points[2]),
      placement("a", 0, points[0]),
    ];
    const reversedEligibility = placementLegEligibility(reversed, [
      "2025-03-14",
      "2025-03-14",
    ])!;
    expect(
      buildRouteStory(disconnected, reversed, reversedEligibility).legs[1],
    ).toBeUndefined();

    const untimed: Track = {
      points: [points[0], { latitude: 48.02, longitude: 16.02 }, points[2]],
      segmentStarts: [0],
    };
    const placements = [
      placement("a", 0, points[0]),
      placement("b", 2_000, points[2]),
    ];
    expect(
      buildRouteStory(untimed, placements, [false, true]).legs[1],
    ).toBeUndefined();
  });

  test("rejects ambiguous duplicate geometry instead of guessing a source", () => {
    const duplicate: Track = {
      points: [...points.slice(0, 3), ...points.slice(0, 3)],
      segmentStarts: [0, 3],
    };
    const placements = [
      placement("a", 0, points[0]),
      placement("b", 2_000, points[2]),
    ];
    expect(
      buildRouteStory(duplicate, placements, [false, true]).legs[1],
    ).toBeUndefined();
  });

  test("keeps singleton context and reveals antimeridian progress on the short arc", () => {
    const prefix = routePrefix(
      [
        { latitude: 0, longitude: 179, time: 0 },
        { latitude: 0, longitude: -179, time: 1_000 },
      ],
      0.5,
    );
    expect(prefix).toEqual([
      { latitude: 0, longitude: 179, time: 0 },
      { latitude: 0, longitude: 180, elevation: undefined, time: 500 },
    ]);
    expect(
      buildRouteStory({ points: [points[0]], segmentStarts: [0] }, [], [])
        .context,
    ).toEqual([[points[0]]]);
  });
});

function simplified(points: Track["points"]) {
  const track: Track = { points, segmentStarts: points.length ? [0] : [] };
  return buildRouteStory(track, [], []).context[0];
}
