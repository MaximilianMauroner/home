import { describe, expect, test } from "vitest";
import { burstPhotoProgress, journeyMotion, journeyTravelZoom, smoothProgress } from "../src/components/tools/PhotoJourney/motion";
import { buildTimeline, BURST_HOLD_DURATION, BURST_TRANSITION_DURATION, DEPARTURE_DURATION, photoHoldTime, timelineAt } from "../src/components/tools/PhotoJourney/timeline";
import type { JourneyPhoto } from "../src/components/tools/PhotoJourney/types";

const photos = Array.from({ length: 3 }, (_, index): JourneyPhoto => ({
  id: String(index), name: `Photo ${index}`, file: {} as File, url: `blob:${index}`, thumbnailUrl: `blob:thumb-${index}`, importOrder: index,
  metadata: { capturedAt: new Date(2025, 0, 1, 12, 0, index), coordinates: { latitude: 48, longitude: 16 }, modifiedAtLabel: "", dimensions: "100 × 100", fileSize: "1 KB", fileType: "JPEG", details: [] },
}));
const timeline = buildTimeline(photos);
const stop = timeline.stops[0];
const motionAt = (elapsed: number, reduced = false) => journeyMotion(timelineAt(elapsed, timeline), reduced);

describe("Photo Journey motion", () => {
  test("reveals the photo quickly and keeps it through departure", () => {
    expect(motionAt(stop.revealStart)).toMatchObject({ drawer: 1, image: 0, photoTransition: 0, checkpoint: 0 });
    const overlap = motionAt(stop.revealStart + 260);
    expect(overlap.drawer).toBe(1);
    expect(overlap.image).toBeGreaterThan(0);
    expect(overlap.image).toBeLessThan(1);
    expect(overlap.photoTransition).toBeGreaterThan(0);
    expect(overlap.photoTransition).toBeLessThan(1);
    expect(motionAt(stop.revealEnd)).toMatchObject({ drawer: 1, image: 1, checkpoint: 1 });
    expect(motionAt(stop.departureStart)).toMatchObject({ drawer: 1, checkpoint: 1 });
    expect(motionAt(stop.end - 0.01).drawer).toBe(1);
    expect(motionAt(stop.end).drawer).toBe(0);
  });

  test("keeps the previous photo over most of the next linear route leg", () => {
    const base = timelineAt(stop.revealStart, timeline);
    const sample = (progress: number) => journeyMotion({
      ...base,
      phase: "approach",
      phaseProgress: progress,
      currentLegProgress: progress,
      phaseDuration: 1_000,
      phaseRemaining: 1_000 * (1 - progress),
    }, false);
    expect(sample(0.5)).toMatchObject({ drawer: 1, image: 1, leg: 0.5 });
    expect(sample(0.82).drawer).toBe(1);
    expect(sample(0.95).drawer).toBe(1);
  });

  test("samples the same state after seeking backward and holds photos still", () => {
    const sample = motionAt(stop.revealStart + 620);
    motionAt(stop.end);
    expect(motionAt(stop.revealStart + 620)).toEqual(sample);
    expect(motionAt(stop.revealEnd + 100)).toMatchObject({ drawer: 1, image: 1, checkpoint: 1 });
    expect(motionAt(stop.departureStart - 100)).toMatchObject({ drawer: 1, image: 1, checkpoint: 1 });
  });

  test("crossfades only within a burst transition, including backward seeks", () => {
    const start = stop.revealEnd + BURST_HOLD_DURATION;
    const sample = (elapsed: number) => burstPhotoProgress(timelineAt(elapsed, timeline), 1, false);
    expect(sample(start)).toBeCloseTo(0);
    expect(sample(start + BURST_TRANSITION_DURATION / 2)).toBeCloseTo(0.5);
    expect(sample(start + BURST_TRANSITION_DURATION)).toBe(1);
    expect(sample(start + BURST_TRANSITION_DURATION / 2)).toBeCloseTo(0.5);
    expect(burstPhotoProgress(timelineAt(start, timeline), 1, true)).toBe(1);
  });

  test("reduced motion shows settled content immediately and no drawer on cards", () => {
    expect(motionAt(stop.revealStart, true)).toMatchObject({ drawer: 1, image: 1, checkpoint: 1 });
    expect(motionAt(stop.departureStart + DEPARTURE_DURATION / 2, true).drawer).toBe(1);
    expect(motionAt(stop.end, true)).toMatchObject({ drawer: 0, card: 1 });
    expect(motionAt(stop.dayStart, true)).toMatchObject({ drawer: 0, card: 1 });
  });

  test("directly selecting any burst photo lands on its fully visible image", () => {
    photos.forEach((_, index) => {
      const state = timelineAt(photoHoldTime(stop, index), timeline);
      expect(state.photoIndex).toBe(index);
      expect(burstPhotoProgress(state, index, false)).toBe(1);
    });
  });

  test("day cards hide repositioning, then uncover the map; the ending remains visible", () => {
    expect(motionAt(stop.dayStart)).toMatchObject({ card: 0, cardBackdrop: 1 });
    expect(motionAt(stop.start - 0.01).cardBackdrop).toBeLessThan(0.00001);
    expect(motionAt(stop.end).card).toBe(0);
    expect(motionAt(timeline.totalDuration - 0.01).card).toBe(1);
    expect(motionAt(timeline.totalDuration).card).toBe(1);
  });

  test("photo-only flights start and end at the hold zoom without an arrival snap", () => {
    for (const stopZoom of [13, 15]) {
      expect(journeyTravelZoom(0, stopZoom, 6)).toBe(stopZoom);
      expect(journeyTravelZoom(1, stopZoom, 6)).toBe(stopZoom);
      expect(journeyTravelZoom(0.5, stopZoom, 6)).toBe(6);
      expect(journeyTravelZoom(0.999, stopZoom, 6)).toBeCloseTo(stopZoom, 3);
      expect(journeyTravelZoom(0.5, stopZoom, 18)).toBe(stopZoom);
    }
    const values = Array.from({ length: 101 }, (_, index) => smoothProgress(index / 100));
    expect(values).toEqual([...values].sort((a, b) => a - b));
    expect(smoothProgress(0.001)).toBeLessThan(0.00001);
    expect(smoothProgress(0.999)).toBeGreaterThan(0.99999);
  });
});
