import { describe, expect, test } from "vitest";
import {
  createTimelineFlightPath,
  pointAtFlightDistance,
} from "../src/components/home/timelineFlightPath";

describe("timeline flight geometry", () => {
  test("keeps the ship at the dock and destination when scrolling beyond the route", () => {
    const dock = { x: 600, y: -350 };
    const destination = { x: 250, y: 12000 };
    const route = createTimelineFlightPath([
      dock,
      { x: 12, y: 20 },
      { x: 800, y: 20 },
      destination,
    ]);
    expect(pointAtFlightDistance(route.samples, -100)).toEqual(dock);
    expect(pointAtFlightDistance(route.samples, route.length + 100)).toEqual(
      destination,
    );
    expect(
      route.samples.every((point) => Number.isFinite(point.distance)),
    ).toBe(true);
  });

  test("preserves travel through each card, including cards in the same row", () => {
    const cards = [
      { x: 12, y: -200 },
      { x: 150, y: 100 },
      { x: 450, y: 100 },
      { x: 150, y: 900 },
    ];
    const route = createTimelineFlightPath(cards);
    for (const card of cards) {
      const sample = route.samples.find(
        (sample) => sample.x === card.x && sample.y === card.y,
      );
      expect(sample).toBeDefined();
      expect(pointAtFlightDistance(route.samples, sample!.distance)).toEqual(
        card,
      );
    }
    expect(
      route.samples
        .slice(1)
        .every(
          (point, index) => point.distance > route.samples[index].distance,
        ),
    ).toBe(true);
  });
});
