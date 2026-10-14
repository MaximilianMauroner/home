// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import dayjs from "dayjs";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import AgeCalculator from "../src/components/home/AgeCalculator";

let root: Root;
let container: HTMLDivElement;
let notifyIntersection: (visible: boolean) => void;
const disconnect = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-09T12:00:00Z"));
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback) {
        notifyIntersection = (isIntersecting) =>
          callback(
            [{ isIntersecting } as IntersectionObserverEntry],
            this as unknown as IntersectionObserver,
          );
      }
      observe() {}
      disconnect = disconnect;
    },
  );
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  vi.useRealTimers();
});

const currentAge = () =>
  dayjs().diff(dayjs("2000-03-13T04:00:00Z"), "year", true).toFixed(9);
const mount = () =>
  act(() =>
    root.render(createElement(AgeCalculator, { initialAge: "26.000000000" })),
  );

test("visible age uses the same formula and updates every 50 ms", () => {
  mount();
  expect(container.textContent).toBe(currentAge());
  const initial = container.textContent;
  act(() => vi.advanceTimersByTime(49));
  expect(container.textContent).toBe(initial);
  act(() => vi.advanceTimersByTime(1));
  expect(container.textContent).toBe(currentAge());
  expect(container.textContent).not.toBe(initial);
});

test("offscreen age stops work and catches up immediately on return", () => {
  mount();
  act(() => notifyIntersection(false));
  const before = container.textContent;
  act(() => vi.advanceTimersByTime(60000));
  expect(container.textContent).toBe(before);
  expect(vi.getTimerCount()).toBe(0);
  act(() => notifyIntersection(true));
  expect(container.textContent).toBe(currentAge());
  act(() => vi.advanceTimersByTime(50));
  expect(container.textContent).toBe(currentAge());
});

test("a hidden tab stays paused until both the tab and profile are visible", () => {
  mount();
  vi.spyOn(document, "hidden", "get").mockReturnValue(true);
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  const before = container.textContent;
  act(() => vi.advanceTimersByTime(60000));
  expect(container.textContent).toBe(before);
  act(() => notifyIntersection(false));
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  expect(vi.getTimerCount()).toBe(0);
  act(() => notifyIntersection(true));
  expect(container.textContent).toBe(currentAge());
});

test("unmount cancels work and releases the observer and visibility listener", () => {
  mount();
  act(() => root.unmount());
  expect(disconnect).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  expect(vi.getTimerCount()).toBe(0);
});

test("without IntersectionObserver, visible age still updates", () => {
  vi.stubGlobal("IntersectionObserver", undefined);
  mount();
  act(() => vi.advanceTimersByTime(50));
  expect(container.textContent).toBe(currentAge());
});
