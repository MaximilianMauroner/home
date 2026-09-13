// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";
import PhotoCheckpointDrawer, { checkpointReadout } from "../src/components/tools/PhotoJourney/PhotoCheckpointDrawer";
import type { JourneyPhoto } from "../src/components/tools/PhotoJourney/types";

const photo: JourneyPhoto = {
  id: "unlocated",
  file: new File(["photo"], "photo.jpg", { type: "image/jpeg" }),
  url: "blob:original",
  thumbnailUrl: "blob:preview",
  name: "Unlocated portrait",
  importOrder: 0,
  metadata: { modifiedAtLabel: "", dimensions: "800 × 1200", fileSize: "5 B", fileType: "JPEG", details: [] },
};

describe("Photo checkpoint drawer", () => {
  let root: Root | undefined;
  afterEach(async () => {
    await act(async () => root?.unmount());
    root = undefined;
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  test("shows an exact hike checkpoint readout when the recording provides it", () => {
    const located = {
      ...photo,
      metadata: { ...photo.metadata, capturedAtLabel: "2026-08-19 11:17:40", altitude: 1_812.4 },
    };
    expect(checkpointReadout(located, {
      photoId: located.id,
      source: "track",
      elevation: 1_825.2,
      recordingDistanceKm: 8.42,
    })).toEqual({
      time: "11:17:40",
      date: "2026-08-19",
      fallback: "2026-08-19 11:17:40",
      metrics: [
        { label: "Elevation", value: "1,825 m" },
        { label: "Trail distance", value: "8.4 km" },
      ],
    });
  });

  test("labels an unlocated photo, preserves the preview on failure, and handles Escape", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const close = vi.fn();
    const container = document.createElement("div");
    document.body.append(container);
    await act(async () => {
      root = createRoot(container);
      root.render(createElement(PhotoCheckpointDrawer, {
        photos: [photo], activePhotoId: photo.id, progress: 1, imageProgress: 1,
        expanded: false, cinematic: false, width: 400, height: 600, manuallyOpened: true, closed: false,
        originalStatus: "error", placement: { photoId: photo.id, source: "carried", coordinates: { latitude: 48, longitude: 16 } }, located: false,
        onBrowse: vi.fn(), onClose: close, onInteract: vi.fn(), onExpandedChange: vi.fn(),
      }));
    });
    expect(container.textContent).not.toContain("Unlocated photo");
    expect(container.textContent).toContain("Photo at this stop");
    expect(container.textContent).toContain("Photo details");
    expect(container.textContent).toContain(photo.name);
    expect(container.textContent).toContain("Original unavailable; showing preview.");
    expect(container.querySelector(".pj-drawer-preview")).not.toBeNull();
    expect(container.querySelector(".pj-drawer-original")).toBeNull();
    await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    expect(close).toHaveBeenCalledOnce();
  });

  test("keeps only the outgoing preview during a burst dissolve and releases it on arrival", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const container = document.createElement("div");
    document.body.append(container);
    const next = { ...photo, id: "next", thumbnailUrl: "blob:next-preview", url: "blob:next-original", name: "Next photo" };
    const render = async (photoProgress: number) => act(async () => {
      root ??= createRoot(container);
      root.render(createElement(PhotoCheckpointDrawer, {
        photos: [photo, next], activePhotoId: next.id, progress: 1, imageProgress: 1, photoProgress,
        expanded: false, cinematic: true, width: 400, height: 600, manuallyOpened: false, closed: false,
        originalStatus: "ready", located: true,
        onBrowse: vi.fn(), onClose: vi.fn(), onInteract: vi.fn(), onExpandedChange: vi.fn(),
      }));
    });
    await render(0.5);
    expect(container.querySelector(".pj-drawer-previous")?.getAttribute("src")).toBe(photo.thumbnailUrl);
    expect(container.querySelector<HTMLElement>(".pj-drawer-image")?.style.opacity).toBe("0.5");
    expect(container.querySelector(".pj-drawer-original")?.getAttribute("src")).toBe(next.url);
    await render(1);
    expect(container.querySelector(".pj-drawer-previous")).toBeNull();
    expect(container.querySelector(".pj-drawer-preview")?.getAttribute("alt")).toBe(next.name);
  });
});
