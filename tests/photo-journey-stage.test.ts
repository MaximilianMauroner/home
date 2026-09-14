import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

import JourneyStage from "../src/components/tools/PhotoJourney/JourneyStage";
import { journeySummary } from "../src/components/tools/PhotoJourney/journey-data";
import { buildRouteStory } from "../src/components/tools/PhotoJourney/route-progress";
import {
  buildTimeline,
  timelineAt,
  type JourneyStop,
} from "../src/components/tools/PhotoJourney/timeline";
import type { JourneyPhoto } from "../src/components/tools/PhotoJourney/types";
import type { Placement } from "../src/components/tools/PhotoJourney/track";

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

  test("shows local photo time and live hike progress independent of the viewer timezone", () => {
    const start = Date.parse("2026-08-19T07:00:00Z");
    const track = {
      points: [
        {
          latitude: 46.5,
          longitude: 11.7,
          elevation: 1_000,
          time: start,
        },
        {
          latitude: 46.51,
          longitude: 11.72,
          elevation: 1_015,
          time: start + 300_000,
        },
        {
          latitude: 46.53,
          longitude: 11.76,
          elevation: 1_030,
          time: start + 600_000,
        },
      ],
      segmentStarts: [0],
    };
    const localPhotos = photos.map((photo, index) => ({
      ...photo,
      metadata: {
        ...photo.metadata,
        capturedAtWallClock: `2026-08-19T09:${index ? "10" : "00"}:00`,
      },
    }));
    const placements: Placement[] = [
      {
        photoId: "0",
        source: "track",
        coordinates: track.points[0],
        instant: start,
        offsetMinutes: 120,
        gapSeconds: 0,
        recordingSampleTime: start,
      },
      {
        photoId: "1",
        source: "track",
        coordinates: track.points[2],
        instant: start + 600_000,
        offsetMinutes: 120,
        gapSeconds: 0,
        recordingSampleTime: start + 600_000,
      },
    ];
    const routeStory = buildRouteStory(track, placements, [false, true]);
    const stop = timeline.stops[1];
    const approachMarkup = renderToStaticMarkup(
      createElement(JourneyStage, {
        photos: localPhotos,
        stops,
        track,
        routeStory,
        placements,
        summary: journeySummary(localPhotos, placements),
        activeIndex: 1,
        state: timelineAt(stop.start + stop.approachDuration / 2, timeline),
        timeline,
        playing: true,
        reducedMotion: false,
        mapMode: "offline",
        title: "Test journey",
        timezone: "UTC",
        speed: 1,
        seekVersion: 0,
        onPause: vi.fn(),
        onSelect: vi.fn(),
        onContinue: vi.fn(),
      }),
    );
    const photoMarkup = renderToStaticMarkup(
      createElement(JourneyStage, {
        photos: localPhotos,
        stops,
        track,
        routeStory,
        placements,
        summary: journeySummary(localPhotos, placements),
        activeIndex: 1,
        state: timelineAt(stop.revealEnd + 1, timeline),
        timeline,
        playing: false,
        reducedMotion: false,
        mapMode: "offline",
        title: "Test journey",
        timezone: "UTC",
        speed: 1,
        seekVersion: 0,
        onPause: vi.fn(),
        onSelect: vi.fn(),
        onContinue: vi.fn(),
      }),
    );

    expect(approachMarkup).toContain('aria-label="Current hike progress"');
    expect(approachMarkup).toContain("Local time");
    expect(approachMarkup).toContain("Time since start");
    expect(approachMarkup).toContain("Elevation gain");
    expect(approachMarkup).toContain("Avg. pace");
    expect(approachMarkup).toContain('data-compact="false"');
    expect(photoMarkup).toContain("09:10 AM");
    expect(photoMarkup).not.toContain("07:10 AM");
    expect(photoMarkup).toContain('aria-label="Current hike progress"');
    expect(photoMarkup).toContain('data-compact="true"');
    expect(photoMarkup).toContain('class="pj-elevation-profile"');
  });
});
