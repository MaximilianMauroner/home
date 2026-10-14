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

// Below the sticky site header, where a heading counts as reached.
const HEADER_OFFSET = 97;

// The collapsed rail: dots are h-1.5 with gap-2, inside py-3 px-2 padding.
const RAIL_TOP_REM = 0.75;
const RAIL_LEFT_REM = 0.5;
const DOT_PITCH_REM = 0.875;
// Blurs the drop's blobs and cuts the alpha back to a hard edge, so blobs
// that come close melt together like water held by surface tension.
const GOO_FILTER_ID = "toc-drop-goo";

const dropTransform = (y: number, scaleX = 1, scaleY = scaleX) =>
  `translateY(${y}rem) scale(${scaleX}, ${scaleY})`;

// How the drop hangs from its dot just before it falls: pushed `ahead` rem
// toward the next dot, stretched, and held by a smaller puddle on the dot.
const HANG = { ahead: 0.25, scaleX: 0.9, scaleY: 1.2, puddle: 0.7 };
// The drop starts to hang once this share of a section has been read.
const HANG_FROM = 0.6;

/** The drop and puddle transforms at a dot; `weight` 0 is round, 1 hangs fully. */
function hangTransforms(position: number, direction: number, weight: number) {
  return {
    drop: dropTransform(
      position + direction * HANG.ahead * weight,
      1 + (HANG.scaleX - 1) * weight,
      1 + (HANG.scaleY - 1) * weight,
    ),
    puddle: dropTransform(position, HANG.puddle * weight),
  };
}

/** How far the drop hangs, from how much of the section is read. */
function hangWeight(read: number) {
  const t = Math.min(Math.max((read - HANG_FROM) / (1 - HANG_FROM), 0), 1);
  return t * t * (3 - 2 * t);
}

const prefersReducedMotion = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

// The fall after the first frame, which is wherever the drop is when it
// starts. `progress` is the share of the way between the dots, `ahead` an
// extra rem past it, and `easing` shapes the step to the next frame. The tail
// is a smaller blob `lag` rem behind the drop; through the goo filter the two
// read as one teardrop.
const FALL_FRAMES = [
  // The drop hangs fully, so a fall that starts from a round drop gets heavy first.
  { offset: 0.2, progress: 0, ahead: HANG.ahead, scaleX: HANG.scaleX, scaleY: HANG.scaleY, lag: 0.1, tail: 0.75, easing: "cubic-bezier(0.5, 0, 1, 1)" },
  // It breaks free and falls faster and faster.
  { offset: 0.5, progress: 0.45, ahead: 0, scaleX: 0.82, scaleY: 1.35, lag: 0.28, tail: 0.6, easing: "linear" },
  // It hits the dot, spreads out and wobbles still.
  { offset: 0.68, progress: 1, ahead: 0.03, scaleX: 1.25, scaleY: 0.8, lag: 0.15, tail: 0.4, easing: "ease-in-out" },
  { offset: 0.82, progress: 1, ahead: -0.02, scaleX: 0.93, scaleY: 1.08, lag: 0, tail: 0, easing: "ease-in-out" },
  { offset: 0.92, progress: 1, ahead: 0, scaleX: 1.03, scaleY: 0.98, lag: 0, tail: 0, easing: "ease-in-out" },
  { offset: 1, progress: 1, ahead: 0, scaleX: 1, scaleY: 1, lag: 0, tail: 0, easing: "linear" },
];

/**
 * Moves the active-heading drop from one dot to another like a drop of water:
 * it pulls away from a puddle left on the old dot, stretches into a teardrop
 * as it falls, and lands with a short wobble. The fall starts from the drop's
 * current shape, so a drop that already hangs, or is still falling, carries
 * on from there. The scroll handler sets the resting transforms inline, so
 * the motion is purely decorative and stops when it finishes.
 */
function animateDrop(
  drop: HTMLElement,
  tail: HTMLElement,
  puddle: HTMLElement,
  from: number,
  to: number,
) {
  const start = from * DOT_PITCH_REM;
  const distance = (to - from) * DOT_PITCH_REM;
  const direction = Math.sign(to - from);
  const duration = Math.min(420 + Math.abs(to - from) * 45, 680);

  const [dropNow, tailNow, puddleNow] = [drop, tail, puddle].map((element) => {
    const transform = getComputedStyle(element).transform;
    element.getAnimations().forEach((animation) => animation.cancel());
    return { offset: 0, easing: "ease-in-out", transform };
  });

  const positions = FALL_FRAMES.map(
    (frame) => start + distance * frame.progress + direction * frame.ahead,
  );
  drop.animate(
    [
      dropNow,
      ...FALL_FRAMES.map((frame, index) => ({
        offset: frame.offset,
        easing: frame.easing,
        transform: dropTransform(positions[index], frame.scaleX, frame.scaleY),
      })),
    ],
    { duration },
  );
  tail.animate(
    [
      tailNow,
      ...FALL_FRAMES.map((frame, index) => ({
        offset: frame.offset,
        easing: frame.easing,
        transform: dropTransform(positions[index] - direction * frame.lag, frame.tail),
      })),
    ],
    { duration },
  );
  // The puddle shrinks once the drop has left, so the neck between them
  // thins out and snaps.
  puddle.animate(
    [
      puddleNow,
      { offset: 0.2, transform: dropTransform(start, HANG.puddle), easing: "ease-in" },
      { offset: 0.5, transform: dropTransform(start, 0) },
      { offset: 1, transform: dropTransform(start, 0) },
    ],
    { duration },
  );
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
  const dropRef = useRef<HTMLSpanElement>(null);
  const dropTailRef = useRef<HTMLSpanElement>(null);
  const dropPuddleRef = useRef<HTMLSpanElement>(null);
  const lastScrollRef = useRef({ y: 0, direction: 1 });
  const [currentHeading, setCurrentHeading] = useState(
    headingsArr[0]?.slug ?? "",
  );
  const [isDesktopOpen, setIsDesktopOpen] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const handleScroll = useCallback(() => {
    if (headingsArr.length === 0) return;

    const lastIndex = headingsArr.length - 1;
    // How far a heading is below the line where it becomes current. The line
    // is where a link to the heading scrolls it (its scroll-margin-top), but
    // at least clear of the site header, plus 2px for subpixel scrolling.
    const headingDistance = (index: number) => {
      const slug = headingsArr[index]?.slug;
      if (slug === undefined) return undefined;
      const headingElement =
        document.getElementById(slug) ??
        document.querySelector(`[id^="${CSS.escape(slug)}"]`);
      if (!headingElement) return undefined;
      const scrollMargin =
        parseFloat(getComputedStyle(headingElement).scrollMarginTop) || 0;
      return (
        headingElement.getBoundingClientRect().top -
        Math.max(scrollMargin, HEADER_OFFSET) -
        2
      );
    };
    const atPageEnd =
      window.innerHeight + window.scrollY >= document.body.offsetHeight - 2;
    let activeIndex = 0;

    if (atPageEnd) {
      activeIndex = lastIndex;
    } else if (window.scrollY > 0) {
      for (let index = lastIndex; index >= 0; index--) {
        const distance = headingDistance(index);
        if (distance !== undefined && distance <= 0) {
          activeIndex = index;
          break;
        }
      }
    }

    const activeHeading = headingsArr[activeIndex].slug;
    setCurrentHeading((current) =>
      current === activeHeading ? current : activeHeading,
    );

    // Near the end of a section the drop hangs toward the dot the reader is
    // scrolling to, so it looks heavy before it falls.
    const scrolled = window.scrollY - lastScrollRef.current.y;
    const direction =
      scrolled === 0 ? lastScrollRef.current.direction : Math.sign(scrolled);
    lastScrollRef.current = { y: window.scrollY, direction };
    const drop = dropRef.current;
    const puddle = dropPuddleRef.current;
    if (!drop || !puddle) return;

    const sectionDistance = headingDistance(activeIndex);
    const nextDistance = headingDistance(activeIndex + 1);
    const target = activeIndex + direction;
    let weight = 0;
    if (
      !atPageEnd &&
      target >= 0 &&
      sectionDistance !== undefined &&
      nextDistance !== undefined &&
      !prefersReducedMotion()
    ) {
      const read = Math.min(
        Math.max(-sectionDistance / (nextDistance - sectionDistance), 0),
        1,
      );
      weight = hangWeight(direction > 0 ? read : 1 - read);
    }
    const hang = hangTransforms(activeIndex * DOT_PITCH_REM, direction, weight);
    drop.style.transform = hang.drop;
    puddle.style.transform = hang.puddle;
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

  const currentIndex = Math.max(
    headingsArr.findIndex((heading) => heading.slug === currentHeading),
    0,
  );
  const previousIndexRef = useRef(currentIndex);

  useEffect(() => {
    const from = previousIndexRef.current;
    previousIndexRef.current = currentIndex;
    const drop = dropRef.current;
    const tail = dropTailRef.current;
    const puddle = dropPuddleRef.current;
    if (from === currentIndex || !drop || !tail || !puddle) return;
    // Without the Web Animations API the drop slides over by CSS transition.
    if (typeof drop.getAnimations !== "function") return;
    if (prefersReducedMotion()) return;
    animateDrop(drop, tail, puddle, from, currentIndex);
  }, [currentIndex]);

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
          className={`relative flex flex-col gap-2 rounded-full border border-border bg-card/90 px-2 py-3 shadow-sm backdrop-blur transition-opacity focus-visible:outline-none focus-visible:ring-2 ${theme.ring} ${
            isDesktopOpen ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
        >
          {headingsArr.map((heading) => (
            <span
              key={heading.slug}
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-border"
            />
          ))}
          {/* One drop marks the current heading and travels between the dots. */}
          <svg aria-hidden="true" className="absolute h-0 w-0">
            <filter id={GOO_FILTER_ID} colorInterpolationFilters="sRGB">
              <feGaussianBlur stdDeviation="1.2" />
              <feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 16 -6" />
            </filter>
          </svg>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{ filter: `url(#${GOO_FILTER_ID})` }}
          >
            {/* The scroll handler positions these and lets the drop hang. */}
            {[
              { name: "puddle", ref: dropPuddleRef, scale: 0 },
              { name: "tail", ref: dropTailRef, scale: 0 },
              { name: "drop", ref: dropRef, scale: 1 },
            ].map(({ name, ref, scale }) => (
              <span
                key={name}
                ref={ref}
                className={`absolute h-1.5 w-1.5 rounded-full transition-transform duration-150 ease-out motion-reduce:transition-none ${theme.dot}`}
                style={{
                  top: `${RAIL_TOP_REM}rem`,
                  left: `${RAIL_LEFT_REM}rem`,
                  transform: dropTransform(0, scale),
                }}
              />
            ))}
          </span>
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
