import type { HeadingType } from "@/utils/types";
import { useCallback, useEffect, useRef, useState } from "react";

export default function TableOfContents({
  headingsArr,
}: {
  headingsArr: HeadingType[];
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileSheetRef = useRef<HTMLElement>(null);
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
    if (!isMobileOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const activeLink = mobileSheetRef.current?.querySelector<HTMLAnchorElement>(
      '[aria-current="location"]',
    );
    activeLink?.focus({ preventScroll: true });
    activeLink?.scrollIntoView({ block: "center" });

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMobileOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
      mobileTriggerRef.current?.focus({ preventScroll: true });
    };
  }, [isMobileOpen]);

  if (headingsArr.length === 0) return null;

  const currentHeadingText =
    headingsArr.find((heading) => heading.slug === currentHeading)?.text ??
    "On this page";

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
          className="fixed bottom-3 left-1/2 z-40 flex h-10 max-w-[80vw] -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-card/95 px-4 text-sm font-medium text-foreground shadow-lg backdrop-blur transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
          <span className="truncate">{currentHeadingText}</span>
        </button>

        {isMobileOpen && (
          <>
            <button
              type="button"
              aria-label="Close table of contents"
              className="fixed inset-0 z-50 bg-black/40"
              onClick={() => setIsMobileOpen(false)}
            />
            <nav
              ref={mobileSheetRef}
              id="mobile-table-of-contents"
              aria-label="Table of contents"
              className="fixed inset-x-0 bottom-0 z-[60] flex max-h-[65vh] flex-col rounded-t-2xl border-t border-border bg-card shadow-2xl"
              style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            >
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <span className="font-semibold text-foreground">
                  On this page
                </span>
                <button
                  type="button"
                  aria-label="Close table of contents"
                  onClick={() => setIsMobileOpen(false)}
                  className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
              <div className="overflow-y-auto p-2">
                {headingsArr.map((heading) => {
                  const isCurrent = currentHeading === heading.slug;
                  return (
                    <a
                      key={heading.slug}
                      href={`#${heading.slug}`}
                      aria-current={isCurrent ? "location" : undefined}
                      onClick={() => setIsMobileOpen(false)}
                      style={{
                        paddingLeft: `${1 + Math.max(heading.depth - 2, 0)}rem`,
                      }}
                      className={`flex min-h-11 items-center rounded-lg border-l-2 py-2.5 pr-4 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                        isCurrent
                          ? "border-primary bg-primary/10 font-semibold text-primary"
                          : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      {heading.text}
                    </a>
                  );
                })}
              </div>
            </nav>
          </>
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
          className={`flex flex-col gap-2 rounded-full border border-border bg-card/90 px-2 py-3 shadow-sm backdrop-blur transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
            isDesktopOpen ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
        >
          {headingsArr.map((heading) => (
            <span
              key={heading.slug}
              aria-hidden="true"
              className={`h-1.5 w-1.5 rounded-full transition-colors ${
                currentHeading === heading.slug ? "bg-primary" : "bg-border"
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
                  className={`-ml-px block border-l py-1.5 pr-2 text-sm leading-snug transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    isCurrent
                      ? "border-primary font-medium text-foreground"
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
