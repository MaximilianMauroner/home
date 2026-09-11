import { describe, expect, test } from "vitest";

import { approachAnimationDuration } from "../src/components/tools/PhotoJourney/JourneyMap";
import { trackStats, type Track } from "../src/components/tools/PhotoJourney/gpx";

describe("Photo Journey map timing and recording budgets", () => {
  test("keeps timeline and MapLibre animation units in milliseconds", () => {
    expect(approachAnimationDuration(3_000, 1)).toBe(3_000);
    expect(approachAnimationDuration(3_000, 2)).toBe(1_500);
  });

  test("handles recording-sized arrays without spread argument limits", () => {
    const points = Array.from({ length: 20_000 }, (_, index) => ({ latitude: 45, longitude: 11 + index / 1_000, elevation: index % 2 ? 100 : 101, time: index * 1_000 }));
    const track: Track = { points, segmentStarts: [0] };
    const stats = trackStats(track);
    expect(stats.pointCount).toBe(points.length);
    expect(stats.start?.valueOf()).toBe(0);
    expect(stats.end?.valueOf()).toBe((points.length - 1) * 1_000);
  });
});
