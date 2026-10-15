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

  test("runs straight down the station spine", () => {
    const route = createTimelineFlightPath([
      { x: 500, y: -300 },
      { x: 500, y: 0 },
      { x: 500, y: 4000 },
    ]);
    for (const point of route.samples) expect(point.x).toBeCloseTo(500, 6);
    expect(route.length).toBeCloseTo(4300);
  });

  test("passes exactly through each point of the dock-to-station route", () => {
    const route = [
      { x: 960, y: -420 },
      { x: 640, y: 96 },
      { x: 880, y: 220 },
      { x: 880, y: 6200 },
      { x: 880, y: 6460 },
    ];
    const flight = createTimelineFlightPath(route);
    for (const point of route) {
      const sample = flight.samples.find(
        (sample) => sample.x === point.x && sample.y === point.y,
      );
      expect(sample).toBeDefined();
      expect(pointAtFlightDistance(flight.samples, sample!.distance)).toEqual(
        point,
      );
    }
    expect(
      flight.samples
        .slice(1)
        .every(
          (point, index) => point.distance > flight.samples[index].distance,
        ),
    ).toBe(true);
  });
});
