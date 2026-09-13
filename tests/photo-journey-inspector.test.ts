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
      capturedAtWallClock: "2026-09-13T08:00:00",
      utcOffsetMinutes: 0,
      capturedAtLabel: "2026-09-13 08:00:00 +00:00",
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

  test("shows camera GPS as diagnostic data when a GPX photo cannot be matched", async () => {
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
          placement: { photoId: journeyPhoto.id, source: "none" },
          index: 0,
          recordings: [recording("Route", 46)],
        }),
      ),
    );

    expect(container.textContent).toContain("Not matched to recording");
    expect(container.textContent).toContain(
      "it stays unplaced while a GPX recording is included",
    );
    const facts = [...container.querySelectorAll(".pj-facts > div")].map(
      (entry) => entry.textContent,
    );
    expect(facts).toContain("CoordinatesNo GPS in this photo");
    expect(facts).toContain("Camera GPS40.0000° N, 10.0000° E");
  });
});
