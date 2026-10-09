// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { beginTimelineScroll } from "../src/components/home/scrollToTimeline";

let cleanup = () => {};
let section: HTMLElement;

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
    window.setTimeout(() => callback(performance.now()), 16),
  );
  vi.stubGlobal("cancelAnimationFrame", (id: number) =>
    window.clearTimeout(id),
  );
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  section = document.createElement("section");
  section.tabIndex = -1;
  section.scrollIntoView = vi.fn();
  document.body.append(section);
});

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

test("manual input cancels navigation even before the expansion frame paints", () => {
  cleanup = beginTimelineScroll(section, false);
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "PageDown" }));
  vi.advanceTimersByTime(2000);
  expect(section.scrollIntoView).not.toHaveBeenCalled();
});

test.each(["wheel", "touchstart"])(
  "%s stops active smooth scrolling and releases listeners",
  (input) => {
    cleanup = beginTimelineScroll(section, false);
    vi.advanceTimersByTime(16);
    window.dispatchEvent(new Event(input));
    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 0,
      left: 0,
      behavior: "instant",
    });
    window.dispatchEvent(new Event(input));
    expect(window.scrollTo).toHaveBeenCalledTimes(1);
  },
);

test("reduced motion navigates without smooth scrolling and focuses the section", () => {
  cleanup = beginTimelineScroll(section, true);
  vi.advanceTimersByTime(16);
  expect(section.scrollIntoView).toHaveBeenCalledWith({
    behavior: "auto",
    block: "start",
  });
  expect(document.activeElement).toBe(section);
});
