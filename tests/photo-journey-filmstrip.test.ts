// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import JourneyFilmstrip from "../src/components/tools/PhotoJourney/JourneyFilmstrip";
import type { JourneyPhoto } from "../src/components/tools/PhotoJourney/types";

const photo = (id: string, capturedAtWallClock?: string): JourneyPhoto => ({
  id,
  name: `${id}.jpg`,
  file: new File(["photo"], `${id}.jpg`),
  url: `blob:${id}`,
  thumbnailUrl: `blob:${id}-preview`,
  importOrder: 0,
  metadata: {
    capturedAtWallClock,
    modifiedAtLabel: "",
    dimensions: "",
    fileSize: "",
    fileType: "JPEG",
    details: [],
  },
});

describe("Travel Album filmstrip", () => {
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

  test("groups by corrected trip date without rearranging a manually ordered journey", async () => {
    const photos = [
      photo("first", "2026-06-19 12:00:00"),
      photo("second", "2026-06-19 12:00:00"),
      photo("third", "2026-06-19 12:00:00"),
      photo("unknown"),
    ];
    await act(async () =>
      root.render(
        createElement(JourneyFilmstrip, {
          photos,
          timezone: "America/Los_Angeles",
          activeIndex: 1,
          onSelect: vi.fn(),
          placements: [
            {
              photoId: "first",
              source: "track",
              instant: Date.parse("2026-06-19T06:30:00Z"),
            },
            {
              photoId: "second",
              source: "track",
              instant: Date.parse("2026-06-19T08:30:00Z"),
            },
            {
              photoId: "third",
              source: "track",
              instant: Date.parse("2026-06-19T06:35:00Z"),
            },
            { photoId: "unknown", source: "none" },
          ],
        }),
      ),
    );
    const labels = Array.from(
      container.querySelectorAll("h3"),
      (entry) => entry.textContent,
    );
    expect(labels).toHaveLength(4);
    expect(labels[0]).toBe(labels[2]);
    expect(labels[0]).not.toBe(labels[1]);
    expect(labels[3]).toBe("Undated");
    expect(
      Array.from(container.querySelectorAll("button"), (entry) =>
        entry.getAttribute("aria-label"),
      ),
    ).toEqual([
      "Show photo 1: first.jpg",
      "Show photo 2: second.jpg",
      "Show photo 3: third.jpg",
      "Show photo 4: unknown.jpg",
    ]);
    expect(
      container
        .querySelector("[aria-current='true']")
        ?.getAttribute("data-index"),
    ).toBe("1");
  });

  test("clicks and keyboard navigation select photos and keep focus in the strip", async () => {
    const select = vi.fn();
    await act(async () =>
      root.render(
        createElement(JourneyFilmstrip, {
          photos: [photo("first"), photo("second"), photo("third")],
          timezone: "UTC",
          activeIndex: 0,
          onSelect: select,
        }),
      ),
    );
    const buttons = container.querySelectorAll("button");
    await act(async () => buttons[1].click());
    expect(select).toHaveBeenLastCalledWith(1);
    buttons[1].focus();
    await act(async () =>
      buttons[1].dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
      ),
    );
    expect(select).toHaveBeenLastCalledWith(2);
    expect(document.activeElement).toBe(buttons[2]);
    await act(async () =>
      buttons[2].dispatchEvent(
        new KeyboardEvent("keydown", { key: "Home", bubbles: true }),
      ),
    );
    expect(select).toHaveBeenLastCalledWith(0);
    expect(document.activeElement).toBe(buttons[0]);
  });

  test("reveals the active thumbnail by scrolling only the strip", async () => {
    const photos = [photo("first"), photo("second")];
    const render = async (activeIndex: number) =>
      act(async () =>
        root.render(
          createElement(JourneyFilmstrip, {
            photos,
            timezone: "UTC",
            activeIndex,
            onSelect: vi.fn(),
          }),
        ),
      );
    await render(0);
    const strip = container.querySelector<HTMLDivElement>(".pj-filmstrip")!;
    const second = container.querySelectorAll("button")[1];
    vi.spyOn(strip, "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, 0, 200, 100),
    );
    vi.spyOn(second, "getBoundingClientRect").mockReturnValue(
      new DOMRect(250, 0, 70, 50),
    );
    strip.scrollLeft = 0;
    await render(1);
    expect(strip.scrollLeft).toBe(128);
    expect(document.activeElement).toBe(document.body);
  });
});
