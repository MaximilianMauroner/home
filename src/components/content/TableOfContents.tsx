import type { HeadingType } from "@/utils/types";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ContentFamily } from "./ContentPreview";

const familyStyles: Record<
  ContentFamily,
  { active: string; ring: string; dot: string }
> = {
  blog: {
    active:
      "border-orange-700 bg-orange-700/10 text-orange-900 dark:border-orange-400 dark:text-orange-200",
    ring: "focus-visible:ring-orange-600 dark:focus-visible:ring-orange-400",
    dot: "bg-orange-700 dark:bg-orange-400",
  },
  log: {
    active:
      "border-emerald-700 bg-emerald-700/10 text-emerald-900 dark:border-lime-300 dark:text-lime-200",
    ring: "focus-visible:ring-emerald-600 dark:focus-visible:ring-lime-300",
    dot: "bg-emerald-700 dark:bg-lime-300",
  },
  snack: {
    active:
      "border-amber-700 bg-amber-700/10 text-amber-950 dark:border-amber-300 dark:text-amber-100",
    ring: "focus-visible:ring-amber-600 dark:focus-visible:ring-amber-300",
    dot: "bg-amber-700 dark:bg-amber-300",
  },
};

/**
 * Marks every element outside `layer` inert, without moving `layer` out of its
 * stacking context. Returns a function that restores only what it changed.
 */
function makeOutsideInert(layer: HTMLElement) {
  const changed: Element[] = [];
  let node: Element = layer;
  while (node !== document.body && node.parentElement) {
    const parent: Element = node.parentElement;
    for (const sibling of parent.children) {
      if (sibling === node || sibling.hasAttribute("inert")) continue;
      sibling.setAttribute("inert", "");
      changed.push(sibling);
    }
    node = parent;
  }
  return () => changed.forEach((element) => element.removeAttribute("inert"));
}

function keepFocusInside(container: HTMLElement, event: KeyboardEvent) {
  const focusable = [
    ...container.querySelectorAll<HTMLElement>("a[href], button:not([disabled])"),
  ];
  const first = focusable[0];
  const last = focusable.at(-1);
  if (!first || !last) return;

  const active = document.activeElement;
  if (!container.contains(active)) {
    event.preventDefault();
    first.focus();
  } else if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

export default function TableOfContents({
  headingsArr,
  family,
  mobileInline = false,
}: {
  headingsArr: HeadingType[];
  family: ContentFamily;
  mobileInline?: boolean;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileLayerRef = useRef<HTMLDivElement>(null);
  const mobileSheetRef = useRef<HTMLDivElement>(null);
  // Heading chosen in the mobile sheet; navigation waits until the sheet has
  // closed and released the page.
  const pendingTargetRef = useRef<string | null>(null);
  const [currentHeading, setCurrentHeading] = useState(
    headingsArr[0]?.slug ?? "",
  );
  const [isDesktopOpen, setIsDesktopOpen] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const handleScroll = useCallback(() => {
    if (headingsArr.length === 0) return;

    const offset = 97;
    let activeHeading = headingsArr[0].slug;

    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 2) {
      activeHeading = headingsArr[headingsArr.length - 1].slug;
    } else if (window.scrollY > 0) {
      for (let index = headingsArr.length - 1; index >= 0; index--) {
        const heading = headingsArr[index];
        const headingElement =
          document.getElementById(heading.slug) ??
          document.querySelector(`[id^="${CSS.escape(heading.slug)}"]`);
        const top = headingElement?.getBoundingClientRect().top;

        if (top !== undefined && top - offset <= 0) {
          activeHeading = heading.slug;
          break;
        }
      }
    }

    setCurrentHeading((current) =>
      current === activeHeading ? current : activeHeading,
    );
  }, [headingsArr]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setIsDesktopOpen(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      document.removeEventListener("click", handleClickOutside);
    };
  }, [handleScroll]);

  useEffect(() => {
    const layer = mobileLayerRef.current;
    const sheet = mobileSheetRef.current;
    if (!isMobileOpen || !layer || !sheet) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const restoreBackground = makeOutsideInert(layer);

    const activeLink = sheet.querySelector<HTMLAnchorElement>(
      '[aria-current="location"]',
    );
    activeLink?.focus({ preventScroll: true });
    activeLink?.scrollIntoView({ block: "center" });

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMobileOpen(false);
      if (event.key === "Tab") keepFocusInside(sheet, event);
    };
    document.addEventListener("keydown", handleKeydown);

    // The sheet is hidden from the sm breakpoint up, so close it there
    // instead of leaving the page inert and unscrollable.
    const desktopQuery = window.matchMedia("(min-width: 640px)");
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setIsMobileOpen(false);
    };
    desktopQuery.addEventListener("change", closeOnDesktop);

    return () => {
      document.body.style.overflow = previousOverflow;
      restoreBackground();
      document.removeEventListener("keydown", handleKeydown);
      desktopQuery.removeEventListener("change", closeOnDesktop);

      const targetSlug = pendingTargetRef.current;
      pendingTargetRef.current = null;
      if (targetSlug === null) {
        mobileTriggerRef.current?.focus({ preventScroll: true });
      } else if (window.location.hash === `#${targetSlug}`) {
        document.getElementById(targetSlug)?.scrollIntoView();
      } else {
        // Native fragment navigation scrolls with the heading scroll margin
        // and moves the keyboard starting point to the heading.
        window.location.hash = targetSlug;
      }
    };
  }, [isMobileOpen]);

  if (headingsArr.length === 0) return null;

  const currentHeadingText =
    headingsArr.find((heading) => heading.slug === currentHeading)?.text ??
    "On this page";
  const theme = familyStyles[family];

  return (
    <div ref={wrapperRef}>
      <div className="sm:hidden">
        <button
          ref={mobileTriggerRef}
          type="button"
          aria-label="Open table of contents"
          aria-expanded={isMobileOpen}
          aria-controls="mobile-table-of-contents"
          onClick={() => setIsMobileOpen(true)}
          className={`flex min-h-11 items-center gap-2 border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 ${theme.ring} ${mobileInline ? "w-full rounded-md" : "fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom))] left-1/2 z-40 max-w-[80vw] -translate-x-1/2 rounded-full shadow-lg"}`}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className="h-4 w-4 shrink-0"
            aria-hidden="true"
          >
            <path strokeLinecap="round" d="M9 6h11M9 12h11M9 18h11" />
            <path strokeLinecap="round" d="M4 6h.01M4 12h.01M4 18h.01" />
          </svg>
          <span className="truncate">
            {mobileInline ? "On this page" : currentHeadingText}
          </span>
        </button>

        {isMobileOpen && (
          <div ref={mobileLayerRef}>
            {/* Pointer-only backdrop; Escape and the close button cover keyboards. */}
            <div
              aria-hidden="true"
              className="fixed inset-0 z-50 bg-black/40"
              onClick={() => setIsMobileOpen(false)}
            />
            <div
              ref={mobileSheetRef}
              id="mobile-table-of-contents"
              role="dialog"
              aria-modal="true"
              aria-labelledby="mobile-table-of-contents-title"
              className="fixed inset-x-0 bottom-0 z-[60] flex max-h-[65vh] flex-col rounded-t-2xl border-t border-border bg-card shadow-2xl"
              style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            >
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <span
                  id="mobile-table-of-contents-title"
                  className="font-semibold text-foreground"
                >
                  On this page
                </span>
                <button
                  type="button"
                  aria-label="Close table of contents"
                  onClick={() => setIsMobileOpen(false)}
                  className={`grid h-10 w-10 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 ${theme.ring}`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    className="h-5 w-5"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" d="m6 6 12 12M18 6 6 18" />
                  </svg>
                </button>
              </div>
              <nav
                aria-label="Table of contents"
                className="overflow-y-auto p-2"
              >
                {headingsArr.map((heading) => {
                  const isCurrent = currentHeading === heading.slug;
                  return (
                    <a
                      key={heading.slug}
                      href={`#${heading.slug}`}
                      aria-current={isCurrent ? "location" : undefined}
                      onClick={(event) => {
                        event.preventDefault();
                        pendingTargetRef.current = heading.slug;
                        setIsMobileOpen(false);
                      }}
                      style={{
                        paddingLeft: `${1 + Math.max(heading.depth - 2, 0)}rem`,
                      }}
                      className={`flex min-h-11 items-center rounded-lg border-l-2 py-2.5 pr-4 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 ${theme.ring} ${
                        isCurrent
                          ? `${theme.active} font-semibold`
                          : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      {heading.text}
                    </a>
                  );
                })}
              </nav>
            </div>
          </div>
        )}
      </div>

      <div
        className="fixed left-3 top-1/2 z-30 hidden -translate-y-1/2 sm:block"
        onMouseEnter={() => setIsDesktopOpen(true)}
        onMouseLeave={() => setIsDesktopOpen(false)}
        onFocusCapture={() => setIsDesktopOpen(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setIsDesktopOpen(false);
          }
        }}
      >
        <button
          type="button"
          aria-label="Open table of contents"
          aria-expanded={isDesktopOpen}
          onClick={() => setIsDesktopOpen(true)}
          className={`flex flex-col gap-2 rounded-full border border-border bg-card/90 px-2 py-3 shadow-sm backdrop-blur transition-opacity focus-visible:outline-none focus-visible:ring-2 ${theme.ring} ${
            isDesktopOpen ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
        >
          {headingsArr.map((heading) => (
            <span
              key={heading.slug}
              aria-hidden="true"
              className={`h-1.5 w-1.5 rounded-full transition-colors ${
                currentHeading === heading.slug ? theme.dot : "bg-border"
              }`}
            />
          ))}
        </button>
        <nav
          aria-label="Table of contents"
          className={`absolute left-0 top-1/2 w-72 -translate-y-1/2 rounded-xl border border-border bg-card/95 p-4 shadow-lg backdrop-blur transition duration-150 ${
            isDesktopOpen
              ? "translate-x-0 opacity-100"
              : "pointer-events-none invisible -translate-x-2 opacity-0"
          }`}
        >
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            On this page
          </p>
          <div className="max-h-[70vh] overflow-y-auto border-l border-border">
            {headingsArr.map((heading) => {
              const isCurrent = currentHeading === heading.slug;
              return (
                <a
                  key={heading.slug}
                  href={`#${heading.slug}`}
                  aria-current={isCurrent ? "location" : undefined}
                  style={{
                    paddingLeft: `${0.75 + Math.max(heading.depth - 2, 0) * 0.75}rem`,
                  }}
                  className={`-ml-px block border-l py-1.5 pr-2 text-sm leading-snug transition-colors focus-visible:outline-none focus-visible:ring-2 ${theme.ring} ${
                    isCurrent
                      ? `${theme.active} font-medium`
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {heading.text}
                </a>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
