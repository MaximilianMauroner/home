// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import TableOfContents from "../src/components/content/TableOfContents";

const headings = [
  { depth: 2, slug: "first", text: "First section" },
  { depth: 2, slug: "second", text: "Second section" },
  { depth: 3, slug: "third", text: "Third section" },
];

describe("mobile table of contents sheet", () => {
  let root: Root;
  let page: HTMLElement;
  let outsideButton: HTMLButtonElement;
  let alreadyInert: HTMLElement;
  let desktopListeners: Set<(event: MediaQueryListEvent) => void>;

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    desktopListeners = new Set();
    vi.stubGlobal("matchMedia", (query: string) => ({
      media: query,
      matches: false,
      addEventListener: (_: string, listener: (e: MediaQueryListEvent) => void) =>
        desktopListeners.add(listener),
      removeEventListener: (_: string, listener: (e: MediaQueryListEvent) => void) =>
        desktopListeners.delete(listener),
    }));
    Element.prototype.scrollIntoView = vi.fn();
    window.location.hash = "";
    document.body.style.overflow = "clip";

    // Page shape: header, then main with the island and article content.
    document.body.innerHTML = `
      <header><a href="/">home</a></header>
      <aside inert><a href="/elsewhere">already inert</a></aside>
      <main><div id="island"></div><button id="behind">Behind</button></main>
      ${headings.map((h) => `<h2 id="${h.slug}">${h.text}</h2>`).join("")}`;
    page = document.querySelector("main")!;
    outsideButton = document.querySelector("#behind")!;
    alreadyInert = document.querySelector("aside")!;
    root = createRoot(document.querySelector("#island")!);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
    document.body.style.overflow = "";
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const render = () =>
    act(async () =>
      root.render(
        createElement(TableOfContents, {
          headingsArr: headings,
          family: "blog",
          mobileInline: true,
        }),
      ),
    );
  const trigger = () =>
    document.querySelector<HTMLButtonElement>(
      'button[aria-controls="mobile-table-of-contents"]',
    )!;
  const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');
  const open = async () => {
    await render();
    trigger().focus();
    await act(async () => trigger().click());
    return dialog()!;
  };
  const press = (key: string, shiftKey = false) => {
    const event = new KeyboardEvent("keydown", {
      key,
      shiftKey,
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      (document.activeElement ?? document.body).dispatchEvent(event);
    });
    return event;
  };
  const expectReleased = () => {
    expect(dialog()).toBeNull();
    expect(document.body.style.overflow).toBe("clip");
    expect(document.querySelectorAll("[inert]").length).toBe(1);
    expect(alreadyInert.hasAttribute("inert")).toBe(true);
  };

  test("opens as a named modal dialog with an inert background", async () => {
    const sheet = await open();

    expect(sheet.getAttribute("aria-modal")).toBe("true");
    expect(
      document.getElementById(sheet.getAttribute("aria-labelledby")!)
        ?.textContent,
    ).toBe("On this page");
    expect(sheet.querySelector("nav")?.getAttribute("aria-label")).toBe(
      "Table of contents",
    );
    // Focus starts on the current heading's link.
    expect(document.activeElement).toBe(
      sheet.querySelector('[aria-current="location"]'),
    );
    expect(document.body.style.overflow).toBe("hidden");

    expect(document.querySelector("header")!.hasAttribute("inert")).toBe(true);
    expect(outsideButton.hasAttribute("inert")).toBe(true);
    expect(trigger().closest("[inert]")).not.toBeNull();
    expect(sheet.closest("[inert]")).toBeNull();
    expect(page.hasAttribute("inert")).toBe(false);
  });

  test("wraps Tab and Shift+Tab inside the sheet", async () => {
    const sheet = await open();
    const focusable = [
      ...sheet.querySelectorAll<HTMLElement>("a[href], button"),
    ];
    const [first, last] = [focusable[0], focusable.at(-1)!];
    expect(first.getAttribute("aria-label")).toBe("Close table of contents");
    expect(last.textContent).toBe("Third section");

    last.focus();
    expect(press("Tab").defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);

    expect(press("Tab", true).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(last);

    // Between the ends, the browser moves focus normally.
    focusable[1].focus();
    expect(press("Tab").defaultPrevented).toBe(false);

    // Focus that has left the sheet is brought back in.
    outsideButton.removeAttribute("inert");
    outsideButton.focus();
    expect(press("Tab").defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);
  });

  test("Escape closes, restores the page and returns focus", async () => {
    await open();
    press("Escape");

    expectReleased();
    expect(document.activeElement).toBe(trigger());
  });

  test("close button and backdrop close the sheet", async () => {
    const sheet = await open();
    await act(async () =>
      sheet
        .querySelector<HTMLButtonElement>(
          'button[aria-label="Close table of contents"]',
        )!
        .click(),
    );
    expectReleased();
    expect(document.activeElement).toBe(trigger());

    await act(async () => trigger().click());
    const backdrop = dialog()!.previousElementSibling as HTMLElement;
    expect(backdrop.getAttribute("aria-hidden")).toBe("true");
    expect(backdrop.tabIndex).toBe(-1);
    await act(async () => backdrop.click());
    expectReleased();
  });

  test("a heading link closes the sheet, then navigates to the heading", async () => {
    const sheet = await open();
    const link = [...sheet.querySelectorAll("a")].find(
      (a) => a.textContent === "Second section",
    )!;
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    await act(async () => link.dispatchEvent(click));

    expect(click.defaultPrevented).toBe(true);
    expectReleased();
    expect(window.location.hash).toBe("#second");
    expect(document.activeElement).not.toBe(trigger());

    // Choosing the current hash again still scrolls to the heading.
    await act(async () => trigger().click());
    const again = [...dialog()!.querySelectorAll("a")].find(
      (a) => a.textContent === "Second section",
    )!;
    vi.mocked(Element.prototype.scrollIntoView).mockClear();
    await act(async () => again.click());
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1);
    expect(vi.mocked(Element.prototype.scrollIntoView).mock.contexts[0]).toBe(
      document.getElementById("second"),
    );
  });

  test("reaching the desktop breakpoint closes the sheet", async () => {
    await open();
    expect(desktopListeners.size).toBe(1);
    act(() =>
      desktopListeners.forEach((listener) =>
        listener({ matches: true } as MediaQueryListEvent),
      ),
    );

    expectReleased();
    expect(desktopListeners.size).toBe(0);
  });

  test("unmounting while open releases the page and listeners", async () => {
    await open();
    await act(async () => root.unmount());
    root = createRoot(document.createElement("div"));

    expectReleased();
    expect(desktopListeners.size).toBe(0);
    expect(press("Tab").defaultPrevented).toBe(false);
  });
});
