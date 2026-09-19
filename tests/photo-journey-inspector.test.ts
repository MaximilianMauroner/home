// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import Inspector from "../src/components/tools/PhotoJourney/Inspector";
import type {
  JourneyPhoto,
  JourneyRecording,
} from "../src/components/tools/PhotoJourney/types";

function photo(metadata: JourneyPhoto["metadata"]): JourneyPhoto {
  return {
    id: "photo",
    name: "photo.jpg",
    file: new File(["photo"], "photo.jpg", { type: "image/jpeg" }),
    url: "blob:photo",
    thumbnailUrl: "blob:photo-preview",
    importOrder: 0,
    metadata,
  };
}

function recording(id: string, latitude: number): JourneyRecording {
  return {
    id,
    digest: id,
    included: true,
    file: new File([id], `${id}.gpx`),
    name: id,
    importOrder: 0,
    warnings: [],
    track: {
      points: [
        {
          latitude,
          longitude: 11,
          time: Date.parse("2026-09-13T08:00:00Z"),
        },
      ],
      segmentStarts: [0],
    },
  };
}

describe("Photo Journey inspector", () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test("keeps overlap choices available after one recording is selected", async () => {
    const onChoosePlacement = vi.fn();
    const journeyPhoto = photo({
      capturedAtWallClock: "2026-09-13T10:00:00",
      capturedAtLabel: "2026-09-13 10:00:00",
      modifiedAtLabel: "-",
      dimensions: "1 × 1",
      fileSize: "5 B",
      fileType: "JPEG",
      details: [],
    });
    const recordings = [
      recording("Morning walk", 46),
      recording("Morning run", 47),
    ];

    await act(async () =>
      root.render(
        createElement(Inspector, {
          photo: journeyPhoto,
          placement: {
            photoId: journeyPhoto.id,
            source: "track",
            recordingId: recordings[0].id,
            coordinates: { latitude: 46, longitude: 11 },
            instant: Date.parse("2026-09-13T08:00:00Z"),
          },
          index: 0,
          recordings,
          choice: { source: "track", recordingId: recordings[0].id },
          timezone: "Europe/Rome",
          onChoosePlacement,
        }),
      ),
    );

    const buttons = [
      ...container.querySelectorAll<HTMLButtonElement>(
        ".pj-placement-buttons button",
      ),
    ];
    expect(buttons.map((button) => button.textContent)).toEqual([
      "Morning walk",
      "Morning run",
      "Reset choice",
    ]);
    expect(buttons[0].getAttribute("aria-pressed")).toBe("true");
    await act(async () => buttons[1].click());
    expect(onChoosePlacement).toHaveBeenCalledWith("photo", {
      source: "track",
      recordingId: "Morning run",
    });
  });

  test("shows an unmatched photo's own GPS when a GPX is loaded", async () => {
    const journeyPhoto = photo({
      coordinates: { latitude: 40, longitude: 10 },
      place: "Camera place",
      modifiedAtLabel: "-",
      dimensions: "1 × 1",
      fileSize: "5 B",
      fileType: "JPEG",
      details: [],
    });

    await act(async () =>
      root.render(
        createElement(Inspector, {
          photo: journeyPhoto,
          placement: {
            photoId: journeyPhoto.id,
            source: "photo",
            coordinates: journeyPhoto.metadata.coordinates,
          },
          index: 0,
          recordings: [recording("Route", 46)],
        }),
      ),
    );

    expect(container.textContent).toContain("Camera place");
    expect(container.textContent).toContain(
      "its original GPS or a nearby photo location is used when available",
    );
    const facts = [...container.querySelectorAll(".pj-facts > div")].map(
      (entry) => entry.textContent,
    );
    expect(facts).toContain("Coordinates40.0000° N, 10.0000° E");
    expect(facts).toContain("Camera GPS40.0000° N, 10.0000° E");
  });
});
