// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";
import PhotoCheckpointDrawer from "../src/components/tools/PhotoJourney/PhotoCheckpointDrawer";
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
    document.body.innerHTML = "";
    vi.restoreAllMocks();
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
        expanded: false, width: 400, height: 600, manuallyOpened: true, closed: false,
        originalStatus: "error", placement: { photoId: photo.id, source: "carried", coordinates: { latitude: 48, longitude: 16 } }, located: false,
        onBrowse: vi.fn(), onClose: close, onInteract: vi.fn(), onExpandedChange: vi.fn(),
      }));
    });
    expect(container.textContent).toContain("Unlocated photo");
    expect(container.textContent).toContain("Original unavailable; showing preview.");
    expect(container.querySelector(".pj-drawer-preview")).not.toBeNull();
    expect(container.querySelector(".pj-drawer-original")).toBeNull();
    await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    expect(close).toHaveBeenCalledOnce();
  });
});
