import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

import JourneyStage from "../src/components/tools/PhotoJourney/JourneyStage";
import { journeySummary } from "../src/components/tools/PhotoJourney/journey-data";
import {
  buildTimeline,
  timelineAt,
  type JourneyStop,
} from "../src/components/tools/PhotoJourney/timeline";
import type { JourneyPhoto } from "../src/components/tools/PhotoJourney/types";

const photos = [
  { latitude: 46.5, longitude: 11.7 },
  { latitude: 46.53, longitude: 11.76 },
].map(
  (coordinates, index): JourneyPhoto => ({
    id: String(index),
    name: `photo-${index}.jpg`,
    file: {} as File,
    url: `blob:photo-${index}`,
    thumbnailUrl: `blob:thumb-${index}`,
    dominantColor: index ? "#3b172c" : "#17323b",
    importOrder: index,
    metadata: {
      capturedAt: new Date(2026, 8, 14, 8, index * 10),
      coordinates,
      modifiedAtLabel: "",
      dimensions: "",
      fileSize: "",
      fileType: "JPEG",
      details: [],
    },
  }),
);
const positions = photos.map((photo) => photo.metadata.coordinates);
const timeline = buildTimeline(
  photos,
  positions,
  photos.map((photo) => photo.metadata.capturedAt!.getTime()),
  {
    legEligibility: [false, true],
    recordedLegDistancesKm: [undefined, 5],
  },
);
const stops: JourneyStop[] = photos.map((photo) => ({
  photoId: photo.id,
  coordinates: photo.metadata.coordinates,
  located: true,
}));

function renderAt(elapsed: number) {
  return renderToStaticMarkup(
    createElement(JourneyStage, {
      photos,
      stops,
      placements: [],
      summary: journeySummary(photos),
      activeIndex: 1,
      state: timelineAt(elapsed, timeline),
      timeline,
      playing: true,
      reducedMotion: false,
      mapMode: "offline",
      title: "Test journey",
      speed: 1,
      seekVersion: 0,
      onPause: vi.fn(),
      onSelect: vi.fn(),
      onContinue: vi.fn(),
    }),
  );
}

describe("Photo Journey stage presentation", () => {
  test("shows only the route while approaching a photo stop", () => {
    const stop = timeline.stops[1];
    const markup = renderAt(stop.start + stop.approachDuration / 2);

    expect(markup).toContain('data-route-only="true"');
    expect(markup).toContain("Following recorded trail");
    expect(markup).not.toContain('aria-label="Current photo"');
  });

  test("reveals the destination photo with a consistent matte", () => {
    const stop = timeline.stops[1];
    const markup = renderAt(
      stop.revealStart + (stop.revealEnd - stop.revealStart) / 2,
    );

    expect(markup).toContain('data-route-only="false"');
    expect(markup).toContain('aria-label="Current photo"');
    expect(markup).toContain("pj-album-backdrop");
    expect(markup).toContain("--pj-photo-matte:#3b172c");
    expect(markup).not.toContain("--pj-photo-share");
    expect(markup).toContain("translate3d(");
  });
});
