// @vitest-environment jsdom

import type { JSDOM } from "jsdom";
import { act, createElement } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import Stretching from "../src/components/tools/Stretching/Stretching";
import {
  CUSTOM_ROUTINES_KEY,
  DEFAULT_ROUTINES,
  ROUTINE_SELECTOR_KEY,
  STORAGE_KEY,
  TIME_BETWEEN_KEY,
} from "../src/components/tools/Stretching/constants";

// Vitest exposes its DOM instance. Use its storage, not Node's global storage.
declare const jsdom: JSDOM;

let root: Root | undefined;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("localStorage", jsdom.window.localStorage);
  localStorage.clear();
  window.history.replaceState({}, "", "/tools/stretching/");
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = undefined;
  document.body.innerHTML = "";
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("stretching server-to-client restoration", () => {
  test.each([
    ["?view=browser", "browser"],
    ["?view=active", "active"],
    ["?view=content-manager", "content-manager"],
    ["?view=preview&routine=custom_saved", "preview"],
    ["?view=preview&routine=missing", "browser"],
  ])("hydrates %s and preserves saved data", async (search, expectedView) => {
    // The server has no query or saved routines. The first client render must
    // match this markup before its effect restores the real browser state.
    const markup = renderToString(createElement(Stretching));
    const savedRoutine = {
      ...DEFAULT_ROUTINES[0],
      id: "custom_saved",
      name: "Saved evening routine",
    };
    const savedStretches = savedRoutine.stretches.map((stretch) => ({
      ...stretch,
      duration: 47,
    }));
    const saved = {
      [CUSTOM_ROUTINES_KEY]: JSON.stringify([savedRoutine]),
      [ROUTINE_SELECTOR_KEY]: savedRoutine.id,
      [STORAGE_KEY]: JSON.stringify(savedStretches),
      [TIME_BETWEEN_KEY]: "23",
    };
    for (const [key, value] of Object.entries(saved)) localStorage.setItem(key, value);
    window.history.replaceState({}, "", `/tools/stretching/${search}`);
    document.body.innerHTML = `<div id="root">${markup}</div>`;
    const container = document.getElementById("root")!;
    const writes = vi.spyOn(Storage.prototype, "setItem");
    const errors: unknown[] = [];
    const consoleErrors = vi.spyOn(console, "error");

    await act(async () => {
      root = hydrateRoot(container, createElement(Stretching), {
        onRecoverableError: (error) => errors.push(error),
      });
    });

    expect(errors).toEqual([]);
    expect(consoleErrors).not.toHaveBeenCalled();
    expect(new URLSearchParams(window.location.search).get("view")).toBe(expectedView);
    expect(container.querySelector("[data-stretching-view]")?.getAttribute("data-stretching-view"))
      .toBe(expectedView);
    for (const [key, value] of Object.entries(saved)) {
      expect(localStorage.getItem(key)).toBe(value);
      expect(writes.mock.calls.filter(([writtenKey]) => writtenKey === key))
        .toEqual([[key, value]]);
    }
    if (expectedView === "preview") expect(container.textContent).toContain(savedRoutine.name);
    expect(document.body.classList.contains("stretching-focus-mode"))
      .toBe(expectedView === "active" || expectedView === "content-manager");

    await act(async () => {
      window.history.pushState({}, "", "/tools/stretching/?view=browser");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(container.querySelector("[data-stretching-view]")?.getAttribute("data-stretching-view"))
      .toBe("browser");
    expect(document.body.classList.contains("stretching-focus-mode")).toBe(false);
    expect(container.querySelector('[data-stretching-shell="wide"]')).not.toBeNull();
  });
});
