// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";
import { usePlayback } from "../src/components/tools/PhotoJourney/usePlayback";
import type { Placement } from "../src/components/tools/PhotoJourney/track";
import type { JourneyPhoto } from "../src/components/tools/PhotoJourney/types";

function photo(id: string, capturedAt: string): JourneyPhoto {
  return {
    id,
    file: new File([id], `${id}.jpg`, { type: "image/jpeg" }),
    url: `blob:${id}`,
    thumbnailUrl: `blob:${id}:thumb`,
    name: id,
    importOrder: Number(id),
    metadata: { capturedAt: new Date(capturedAt), modifiedAtLabel: "", dimensions: "1 × 1", fileSize: "1 B", fileType: "JPEG", details: [] },
  };
}

describe("Photo Journey playback commands", () => {
  let root: Root | undefined;
  afterEach(async () => {
    await act(async () => root?.unmount());
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  test("manual selection while playing lands paused in the requested photo hold", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const photos = [photo("0", "2026-01-01T10:00:00Z"), photo("1", "2026-01-01T10:10:00Z")];
    const placements: Placement[] = photos.map((entry, index) => ({
      photoId: entry.id,
      source: "photo",
      coordinates: { latitude: 48 + index * 0.01, longitude: 16 + index * 0.01 },
      instant: entry.metadata.capturedAt!.getTime(),
    }));
    let playback!: ReturnType<typeof usePlayback>;
    function Harness() {
      playback = usePlayback(photos, placements, { dayKeys: ["2026-01-01", "2026-01-01"] });
      return null;
    }
    const container = document.createElement("div");
    document.body.append(container);
    await act(async () => { root = createRoot(container); root.render(createElement(Harness)); });
    await act(async () => playback.toggle());
    expect(playback.playing).toBe(true);
    await act(async () => playback.select(1));
    expect(playback.playing).toBe(false);
    expect(playback.state).toMatchObject({ photoIndex: 1, checkpointPhotoIndex: 1, phase: "hold" });
  });
});
