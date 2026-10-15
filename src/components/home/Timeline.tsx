import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { PreviewEntry } from "@/components/content/previewTypes";
import BlogPreview from "@/components/content/BlogPreview";
import LogPreview from "@/components/content/LogPreview";
import SnackPreview from "@/components/content/SnackPreview";
import { useTimelineFlight } from "./useTimelineFlight";

interface TimelineProps {
  blogs: PreviewEntry[];
  logs: PreviewEntry[];
  snacks: PreviewEntry[];
  expanded: boolean;
  onExpand: () => void;
}

type TimelineItem = {
  type: "blog" | "log" | "snack";
  item: PreviewEntry;
  date: Date;
};

type TimelineChapter = {
  key: string;
  code: string;
  index: number;
  month: string;
  year: number;
  items: TimelineItem[];
};

type TimelineYearGroup = {
  year: number;
  chapters: TimelineChapter[];
};

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// Each month bay shows a status light in the next accent color.
const monthAccents = [
  "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] dark:bg-emerald-300",
  "bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)] dark:bg-orange-300",
  "bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.8)] dark:bg-violet-300",
  "bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.8)] dark:bg-sky-300",
];

export const TimelineSpaceshipGlyph = () => (
  <>
    <circle cx="-12" cy="0" r="2" fill="currentColor" opacity="0.25" />
    <circle cx="-7" cy="0" r="1.5" fill="currentColor" opacity="0.5" />
    <path
      d="M -3 -7 C 4 -7 10 -3 13 0 C 10 3 4 7 -3 7 L 0 0 Z"
      fill="currentColor"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth="1.5"
    />
    <path
      d="M -1 -6 L -7 -10 L -5 -3 M -1 6 L -7 10 L -5 3"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    />
    <circle
      cx="5"
      cy="0"
      r="2.5"
      className="fill-indigo-100 dark:fill-indigo-950"
    />
  </>
);

const TimelineCardSkeleton = () => (
  <article
    className="h-72 rounded-2xl border border-border/50 bg-card/80 p-6 shadow-sm backdrop-blur-xl sm:p-8 dark:bg-card/80"
    aria-label="Loading timeline item"
    aria-busy="true"
  >
    <div className="flex h-full animate-pulse flex-col">
      <div className="mb-5 flex gap-2">
        <div className="h-6 w-16 rounded-full bg-indigo-200/70 dark:bg-indigo-900/50" />
        <div className="h-6 w-20 rounded-full bg-purple-200/60 dark:bg-purple-900/40" />
      </div>
      <div className="mb-4 h-3 w-24 rounded-full bg-muted" />
      <div className="space-y-3">
        <div className="h-7 w-11/12 rounded-full bg-muted" />
        <div className="h-7 w-7/12 rounded-full bg-muted" />
      </div>
      <div className="mt-6 space-y-2">
        <div className="h-3 w-full rounded-full bg-muted" />
        <div className="h-3 w-5/6 rounded-full bg-muted" />
        <div className="h-3 w-2/3 rounded-full bg-muted" />
      </div>
      <div className="mt-auto flex items-center justify-between border-t border-border/50 pt-4">
        <div className="h-4 w-20 rounded-full bg-muted" />
        <div className="h-9 w-28 rounded-full bg-indigo-200/60 dark:bg-indigo-900/40" />
      </div>
    </div>
  </article>
);

const TimelineStation = () => (
  <div
    data-flight-destination
    role="img"
    aria-label="Timeline docking station"
    className="relative z-30 h-32 w-40 text-indigo-300"
  >
    <div
      aria-hidden="true"
      className="absolute left-1/2 top-0 h-5 w-px -translate-x-1/2 bg-indigo-400"
    >
      <span className="absolute -left-1.5 -top-1.5 h-3 w-3 rounded-full border border-indigo-300 bg-indigo-500 shadow-[0_0_12px_rgba(129,140,248,0.9)]" />
    </div>
    <div
      aria-hidden="true"
      className="absolute left-0 top-1/2 h-14 w-10 -translate-x-7 -translate-y-1/2 rounded-md border border-indigo-400/70 bg-indigo-950 shadow-lg [background-image:linear-gradient(rgba(129,140,248,0.3)_1px,transparent_1px),linear-gradient(90deg,rgba(129,140,248,0.3)_1px,transparent_1px)] [background-size:100%_0.7rem,0.7rem_100%]"
    />
    <div
      aria-hidden="true"
      className="absolute right-0 top-1/2 h-14 w-10 -translate-y-1/2 translate-x-7 rounded-md border border-fuchsia-400/70 bg-fuchsia-950 shadow-lg [background-image:linear-gradient(rgba(232,121,249,0.3)_1px,transparent_1px),linear-gradient(90deg,rgba(232,121,249,0.3)_1px,transparent_1px)] [background-size:100%_0.7rem,0.7rem_100%]"
    />
    <div
      aria-hidden="true"
      className="absolute inset-3 flex items-center justify-center rounded-[2rem] border-2 border-indigo-300/80 bg-slate-950 shadow-[0_0_0_6px_rgba(49,46,129,0.45),0_0_28px_rgba(129,140,248,0.5)]"
    >
      <span className="absolute left-4 top-3 font-mono text-[0.5rem] uppercase tracking-[0.2em] text-indigo-300/70">
        orbital dock
      </span>
      <span className="absolute right-4 top-3 h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_8px_rgba(110,231,183,0.9)]" />
      <span className="relative flex h-16 w-16 items-center justify-center rounded-full border-4 border-violet-400 bg-slate-950 shadow-[inset_0_0_18px_rgba(139,92,246,0.65),0_0_16px_rgba(139,92,246,0.5)]">
        <span className="absolute inset-1 rounded-full border border-dashed border-fuchsia-300/70" />
        <span className="h-7 w-7 rounded-lg border-2 border-indigo-200 bg-gradient-to-br from-indigo-500 to-fuchsia-500 shadow-[0_0_14px_rgba(217,70,239,0.7)]" />
      </span>
      <span className="absolute bottom-2 font-mono text-[0.45rem] uppercase tracking-[0.25em] text-fuchsia-200/70">
        bay ∞
      </span>
    </div>
  </div>
);

// Rendered cover widths for the bay layout in the styles below. A bay with
// one post is one card wide and capped at 34rem below 1280px. Larger bays
// split into two card columns from 768px.
const coverSizes = {
  single:
    "(min-width: 1760px) 764px, (min-width: 1280px) calc(50vw - 116px), (min-width: 624px) 516px, calc(100vw - 108px)",
  paired:
    "(min-width: 1760px) 376px, (min-width: 1280px) calc(25vw - 64px), (min-width: 1024px) calc(50vw - 68px), (min-width: 768px) calc(50vw - 60px), calc(100vw - 108px)",
};

const TimelineEntry = ({
  timelineItem,
  sizes,
}: {
  timelineItem: TimelineItem;
  sizes: string;
}) => {
  const { item: entry, type } = timelineItem;
  const hasImage = Boolean(entry._imageUrl || entry.data.image);
  const item = entry._imageAttributes
    ? { ...entry, _imageAttributes: { ...entry._imageAttributes, sizes } }
    : entry;

  const renderPreview = () => {
    if (type === "blog") {
      return <BlogPreview blog={item} />;
    }

    if (type === "log") {
      return <LogPreview log={item} />;
    }

    return <SnackPreview snack={item} />;
  };

  return (
    <div
      className={`timeline-entry timeline-entry--${type} ${hasImage ? "timeline-entry--image" : "timeline-entry--text"}`}
    >
      {renderPreview()}
    </div>
  );
};

// Places each list item in 4px grid rows, so items in different columns
// pack under each other without row gaps. One column keeps normal flow.
function useMasonryRows(gridRef: RefObject<HTMLOListElement>, itemKey: string) {
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const listItems = Array.from(grid.children) as HTMLLIElement[];
    const updateSpans = () => {
      const styles = getComputedStyle(grid);
      const columnCount = styles.gridTemplateColumns.split(" ").length;
      const rowHeight = 4;
      const parsedRowGap = Number.parseFloat(styles.rowGap);
      const rowGap = Number.isFinite(parsedRowGap) ? parsedRowGap : 0;

      if (columnCount === 1) {
        delete grid.dataset.masonryReady;
        listItems.forEach((listItem) => {
          listItem.style.gridRowEnd = "auto";
        });
        return;
      }

      const spans = listItems.map((listItem) =>
        Math.ceil(
          (listItem.getBoundingClientRect().height + rowGap) /
            (rowHeight + rowGap),
        ),
      );

      listItems.forEach((listItem, index) => {
        listItem.style.gridRowEnd = `span ${spans[index]}`;
      });
      grid.dataset.masonryReady = "";
    };

    const observer = new ResizeObserver(updateSpans);
    observer.observe(grid);
    listItems.forEach((listItem) => observer.observe(listItem));

    const frame = requestAnimationFrame(updateSpans);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      delete grid.dataset.masonryReady;
      listItems.forEach((listItem) => {
        listItem.style.gridRowEnd = "auto";
      });
    };
  }, [gridRef, itemKey]);
}

const TimelineMasonry = ({ items }: { items: TimelineChapter["items"] }) => {
  const gridRef = useRef<HTMLOListElement>(null);
  useMasonryRows(
    gridRef,
    items.map(({ item, type }) => `${type}-${item.id}`).join("|"),
  );

  return (
    <ol
      ref={gridRef}
      className={`timeline-masonry grid list-none grid-cols-1 gap-3 p-0 ${items.length > 1 ? "md:grid-cols-2" : ""}`}
    >
      {items.map((timelineItem) => (
        <li
          key={`${timelineItem.type}-${timelineItem.item.id}`}
          className="relative z-10 min-w-0 self-start"
        >
          <TimelineEntry
            timelineItem={timelineItem}
            sizes={items.length > 1 ? coverSizes.paired : coverSizes.single}
          />
        </li>
      ))}
    </ol>
  );
};

const TimelineFlight = ({
  flightPath,
  spaceshipRef,
  shipDocked,
  isVisible,
  prefersReducedMotion,
}: ReturnType<typeof useTimelineFlight> & {
  isVisible: boolean;
  prefersReducedMotion: boolean;
}) => (
  <>
    {flightPath && (
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 z-[1] overflow-visible"
        focusable="false"
        height={flightPath.height}
        viewBox={`0 0 ${flightPath.width} ${flightPath.height}`}
        width={flightPath.width}
      >
        <path
          className="timeline-flight-path fill-none stroke-indigo-300/70 dark:stroke-indigo-700/70"
          d={flightPath.path}
          pathLength="1"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3"
          vectorEffect="non-scaling-stroke"
          style={{
            animation:
              isVisible && !prefersReducedMotion
                ? "drawFlightPath 1.4s ease-out both"
                : "none",
          }}
        />
      </svg>
    )}
    {flightPath && (
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 z-20 overflow-visible"
        focusable="false"
        height={flightPath.height}
        viewBox={`0 0 ${flightPath.width} ${flightPath.height}`}
        width={flightPath.width}
      >
        <g
          ref={spaceshipRef}
          data-timeline-route-ship
          className="text-indigo-600 drop-shadow-sm dark:text-indigo-300"
        >
          <g
            className={
              shipDocked && !prefersReducedMotion
                ? "timeline-docked-ship"
                : undefined
            }
          >
            <TimelineSpaceshipGlyph />
          </g>
        </g>
      </svg>
    )}
  </>
);

// A month bay hangs off the station spine on an arm. The arm's node lights
// up once the ship has passed it. Below 1280px a bay with one post stays
// narrow, so its cover does not fill the whole row.
const TimelineBay = ({ chapter }: { chapter: TimelineChapter }) => {
  const headingId = `timeline-${chapter.key}`;
  const count = chapter.items.length;
  return (
    <section
      aria-labelledby={headingId}
      className={`relative z-[2] rounded-[1.375rem] border-2 border-indigo-200 bg-white/85 px-3 pb-3 shadow-[0_0_0_5px_rgba(199,210,254,0.35)] dark:border-indigo-300/55 dark:bg-slate-950/90 dark:shadow-[0_0_0_5px_rgba(49,46,129,0.35),0_0_22px_rgba(129,140,248,0.22)] ${count === 1 ? "max-w-[34rem] xl:max-w-none" : ""}`}
    >
      <span
        aria-hidden="true"
        className="timeline-arm border-indigo-300/70 bg-indigo-50 text-indigo-300 dark:bg-[#0b0f24] dark:text-indigo-400/35"
      >
        <span
          data-timeline-node
          className="timeline-node border-indigo-300 bg-white data-[passed]:bg-indigo-500 data-[passed]:shadow-[0_0_12px_rgba(129,140,248,0.9)] motion-safe:transition-colors dark:border-indigo-300/80 dark:bg-slate-950"
        />
      </span>
      <header className="flex items-center gap-2 whitespace-nowrap px-1 py-3 font-mono text-[0.5625rem] uppercase tracking-[0.2em]">
        <span
          aria-hidden="true"
          className={`h-[7px] w-[7px] flex-none rounded-full ${monthAccents[chapter.index % monthAccents.length]}`}
        />
        <span
          aria-hidden="true"
          className="hidden text-indigo-500/80 sm:inline dark:text-indigo-300/75"
        >
          {chapter.code}
        </span>
        <h4
          id={headingId}
          className="min-w-0 truncate font-sans text-base font-extrabold normal-case tracking-[-0.03em] text-gray-900 dark:text-gray-100"
        >
          {chapter.month} {chapter.year}
        </h4>
        <span className="ml-auto text-fuchsia-700/70 dark:text-fuchsia-200/70">
          <span aria-hidden="true">{count} docked</span>
          <span className="sr-only">
            {count} {count === 1 ? "post" : "posts"}
          </span>
        </span>
      </header>

      <TimelineMasonry items={chapter.items} />
    </section>
  );
};

// A solar wing marks each year on the spine. Wide screens hang the months
// left and right of the spine; smaller screens keep the spine on the left.
const TimelineYear = ({ group }: { group: TimelineYearGroup }) => {
  const listRef = useRef<HTMLOListElement>(null);
  const headingId = `timeline-year-${group.year}`;
  useMasonryRows(
    listRef,
    group.chapters.map(({ key, items }) => `${key}:${items.length}`).join("|"),
  );

  return (
    <section aria-labelledby={headingId} className="timeline-year">
      <div className="timeline-wing">
        <span
          aria-hidden="true"
          className="timeline-wing__panel border-sky-300 bg-sky-50 text-sky-300/60 dark:border-blue-400/55 dark:bg-[#0b1736] dark:text-blue-400/30"
        />
        <h3
          id={headingId}
          className="timeline-wing__hub border-indigo-300 bg-white font-mono font-extrabold text-indigo-700 shadow-[0_0_0_6px_rgba(199,210,254,0.5)] dark:bg-slate-950 dark:text-indigo-200 dark:shadow-[0_0_0_6px_rgba(49,46,129,0.45),0_0_26px_rgba(129,140,248,0.5)]"
        >
          {group.year}
        </h3>
        <span
          aria-hidden="true"
          className="timeline-wing__panel border-sky-300 bg-sky-50 text-sky-300/60 dark:border-blue-400/55 dark:bg-[#0b1736] dark:text-blue-400/30"
        />
      </div>
      <ol ref={listRef} className="timeline-spine-grid list-none p-0">
        {group.chapters.map((chapter) => (
          <li key={chapter.key} className="timeline-slot">
            <TimelineBay chapter={chapter} />
          </li>
        ))}
      </ol>
    </section>
  );
};

function Timeline({ blogs, logs, snacks, expanded, onExpand }: TimelineProps) {
  const allItems = useMemo<TimelineItem[]>(
    () =>
      [
        ...blogs.map((blog) => ({
          type: "blog" as const,
          item: blog,
          date: new Date(blog.data.releaseDate),
        })),
        ...logs.map((log) => ({
          type: "log" as const,
          item: log,
          date: new Date(log.data.releaseDate),
        })),
        ...snacks.map((snack) => ({
          type: "snack" as const,
          item: snack,
          date: new Date(snack.data.releaseDate),
        })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [blogs, logs, snacks],
  );
  const [isVisible, setIsVisible] = useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);
  const chaptersRef = useRef<HTMLDivElement>(null);
  const visibleItems = useMemo(
    () => (expanded ? allItems : allItems.slice(0, 6)),
    [allItems, expanded],
  );
  const visibleItemKey = visibleItems
    .map(({ item, type }) => `${type}-${item.id}`)
    .join("|");
  const chapters = useMemo(
    () =>
      visibleItems.reduce<TimelineChapter[]>((groups, item) => {
        const year = item.date.getUTCFullYear();
        const monthIndex = item.date.getUTCMonth();
        const key = `${year}-${monthIndex}`;
        const current = groups.at(-1);

        if (current?.key === key) {
          current.items.push(item);
        } else {
          groups.push({
            key,
            code: `bay ${String(monthIndex + 1).padStart(2, "0")}·${String(year).slice(2)}`,
            index: groups.length,
            month: months[monthIndex],
            year,
            items: [item],
          });
        }

        return groups;
      }, []),
    [visibleItems],
  );
  const years = useMemo(
    () =>
      chapters.reduce<TimelineYearGroup[]>((groups, chapter) => {
        const current = groups.at(-1);
        if (current?.year === chapter.year) {
          current.chapters.push(chapter);
        } else {
          groups.push({ year: chapter.year, chapters: [chapter] });
        }
        return groups;
      }, []),
    [chapters],
  );
  const { flightPath, spaceshipRef, shipDocked } = useTimelineFlight(
    chaptersRef,
    visibleItemKey,
    prefersReducedMotion,
  );

  const expandTimeline = () => {
    onExpand();
    timelineRef.current?.focus({ preventScroll: true });
  };

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => {
      setPrefersReducedMotion(media.matches);
      if (media.matches) setIsVisible(true);
    };
    updatePreference();
    media.addEventListener("change", updatePreference);
    return () => media.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) {
      setIsVisible(true);
      return;
    }

    const timeline = timelineRef.current;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 },
    );

    if (timeline) observer.observe(timeline);

    return () => {
      if (timeline) observer.unobserve(timeline);
    };
  }, [prefersReducedMotion]);

  return (
    <section
      id="home-timeline"
      ref={timelineRef}
      tabIndex={-1}
      className="relative min-h-[100vh] overflow-x-clip bg-gradient-to-b from-transparent via-indigo-50/20 to-indigo-100/30 py-24 outline-none [overflow-anchor:none] lg:py-28 dark:via-indigo-950/20 dark:to-indigo-950/30"
    >
      {/* Decorative background elements */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-10 top-20 h-64 w-64 rounded-full bg-indigo-200/10 blur-3xl dark:bg-indigo-800/10" />
        <div className="absolute bottom-40 right-20 h-80 w-80 rounded-full bg-violet-200/10 blur-3xl dark:bg-violet-800/10" />
      </div>

      <div className="relative mx-auto max-w-[110rem] px-4 lg:px-6">
        {/* Section Header. The flight route swings around its text. */}
        <div
          data-timeline-header
          className="mb-12 flex flex-col items-center text-center lg:mb-14"
        >
          <h2
            className="mb-4 text-4xl font-extrabold tracking-tight text-gray-900 lg:text-5xl dark:text-gray-100"
            style={{
              opacity: isVisible ? 1 : 0,
              transform:
                prefersReducedMotion || isVisible
                  ? "translateY(0)"
                  : "translateY(20px)",
              transition: prefersReducedMotion
                ? "none"
                : "opacity 0.6s ease-out, transform 0.6s ease-out",
            }}
          >
            timeline
          </h2>
          <p
            className="text-lg font-light text-gray-600 sm:text-xl dark:text-gray-400"
            style={{
              opacity: isVisible ? 1 : 0,
              transform:
                prefersReducedMotion || isVisible
                  ? "translateY(0)"
                  : "translateY(20px)",
              transition: prefersReducedMotion
                ? "none"
                : "opacity 0.8s ease-out 0.2s, transform 0.8s ease-out 0.2s",
            }}
          >
            all posts, logs, and snacks sorted by date
          </p>
        </div>

        {/* Years and months keep newest-first DOM order along the station spine. */}
        <div ref={chaptersRef} className="relative [overflow-anchor:none]">
          <TimelineFlight
            flightPath={flightPath}
            spaceshipRef={spaceshipRef}
            shipDocked={shipDocked}
            isVisible={isVisible}
            prefersReducedMotion={prefersReducedMotion}
          />

          {allItems.length === 0 && (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }, (_, index) => (
                <TimelineCardSkeleton key={`timeline-skeleton-${index}`} />
              ))}
            </div>
          )}

          {years.length > 0 && (
            <div className="timeline-spine">
              <span
                aria-hidden="true"
                className="timeline-truss border-indigo-300 bg-indigo-50 text-indigo-300/60 dark:border-indigo-400/55 dark:bg-[#070a1a] dark:text-indigo-400/30"
              />
              <span aria-hidden="true" data-timeline-spine />
              {years.map((group) => (
                <TimelineYear key={group.year} group={group} />
              ))}
            </div>
          )}

          {!expanded && allItems.length > visibleItems.length && (
            <div className="mt-12 flex justify-center">
              <button
                type="button"
                onClick={expandTimeline}
                aria-controls="home-timeline"
                className="inline-flex min-h-11 items-center rounded-md border border-indigo-500/40 bg-background/80 px-5 py-2 text-sm font-semibold text-indigo-700 shadow-sm hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-indigo-300"
              >
                Show all {allItems.length} entries
              </button>
            </div>
          )}

          {expanded && allItems.length > 0 && (
            <div
              className="relative mt-20 flex justify-center pb-4"
              style={{
                opacity: isVisible ? 1 : 0,
                transform:
                  prefersReducedMotion || isVisible
                    ? "translateY(0)"
                    : "translateY(20px)",
                transition: prefersReducedMotion
                  ? "none"
                  : "opacity 0.8s ease-out, transform 0.8s ease-out",
              }}
            >
              <TimelineStation />
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes bobDockedShip {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(-5px); }
        }
        .timeline-docked-ship {
          animation: bobDockedShip 1s ease-in-out infinite;
        }

        #home-timeline [data-masonry-ready] {
          grid-auto-rows: 4px;
        }

        #home-timeline .timeline-masonry[data-masonry-ready] {
          grid-auto-flow: dense;
        }

        /* Station spine. Below 1280px the truss runs down the left edge and
           every month bay hangs to its right. Colors come from the classes. */
        #home-timeline .timeline-spine {
          --spine-x: 0.8125rem;
          --truss-width: 1.375rem;
          --bay-inset: 3rem;
          position: relative;
        }

        #home-timeline .timeline-year + .timeline-year {
          margin-top: 2.75rem;
        }

        #home-timeline .timeline-truss {
          position: absolute;
          top: 0;
          bottom: 0;
          left: calc(var(--spine-x) - var(--truss-width) / 2);
          width: var(--truss-width);
          border-inline: 2px solid;
          background-image:
            repeating-linear-gradient(45deg, transparent 0 15px, currentColor 15px 16.5px),
            repeating-linear-gradient(-45deg, transparent 0 15px, currentColor 15px 16.5px);
        }

        #home-timeline [data-timeline-spine] {
          position: absolute;
          top: 0;
          bottom: 0;
          left: var(--spine-x);
          width: 0;
        }

        #home-timeline .timeline-wing {
          position: relative;
          z-index: 2;
          display: flex;
          align-items: center;
          margin-bottom: 1.5rem;
        }

        #home-timeline .timeline-wing__panel {
          width: 5.5rem;
          height: 2rem;
          border: 1px solid;
          background-image:
            linear-gradient(90deg, currentColor 1px, transparent 1px),
            linear-gradient(currentColor 1px, transparent 1px);
          background-size: 1.75rem 100%, 100% 1.25rem;
        }

        #home-timeline .timeline-wing__hub {
          display: grid;
          flex: none;
          place-items: center;
          width: 4rem;
          height: 4rem;
          margin: 0 -2px;
          border: 2px solid;
          border-radius: 50%;
          font-size: 0.875rem;
          letter-spacing: 0.04em;
        }

        #home-timeline .timeline-spine-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          padding-left: var(--bay-inset);
        }

        #home-timeline .timeline-slot {
          align-self: start;
          min-width: 0;
          padding-bottom: 2rem;
        }

        /* The arm sits inside the bay border, so it also crosses that 2px. */
        #home-timeline .timeline-arm {
          position: absolute;
          top: 2.75rem;
          left: calc(var(--spine-x) - var(--bay-inset) - 2px);
          width: calc(var(--bay-inset) - var(--spine-x));
          height: 8px;
          border-block: 1px solid;
          background-image: repeating-linear-gradient(90deg, currentColor 0 2px, transparent 2px 8px);
        }

        #home-timeline .timeline-node {
          position: absolute;
          top: -6px;
          left: -9px;
          width: 18px;
          height: 18px;
          border: 2px solid;
          border-radius: 50%;
        }

        /* From 1280px the spine runs down the middle. Months alternate left
           and right. The first right bay of a year starts well below the
           first left bay. Later right bays start 3rem lower than their slot,
           so their 18px node clears the node of the left neighbour by 30px. */
        @media (min-width: 1280px) {
          #home-timeline .timeline-spine {
            --spine-x: 50%;
            --truss-width: 2.875rem;
            --bay-inset: 0px;
          }

          #home-timeline .timeline-wing {
            justify-content: center;
            margin-bottom: 1.875rem;
          }

          #home-timeline .timeline-wing__panel {
            width: 17.5rem;
            height: 2.5rem;
          }

          #home-timeline .timeline-wing__hub {
            width: 5.5rem;
            height: 5.5rem;
            font-size: 1.1875rem;
          }

          #home-timeline .timeline-spine-grid {
            grid-template-columns: minmax(0, 1fr) 8rem minmax(0, 1fr);
          }

          #home-timeline .timeline-slot:nth-child(odd) {
            grid-column: 1;
          }

          #home-timeline .timeline-slot:nth-child(even) {
            grid-column: 3;
            padding-top: 3rem;
          }

          #home-timeline .timeline-slot:nth-child(2) {
            padding-top: 9.375rem;
          }

          #home-timeline .timeline-slot:nth-child(odd) .timeline-arm {
            left: auto;
            right: calc(-4rem - 2px);
            width: 4rem;
          }

          #home-timeline .timeline-slot:nth-child(odd) .timeline-node {
            left: auto;
            right: -9px;
          }

          #home-timeline .timeline-slot:nth-child(even) .timeline-arm {
            left: calc(-4rem - 2px);
            width: 4rem;
          }
        }

        #home-timeline .timeline-entry .content-preview {
          height: auto;
          min-height: 0;
        }

        /* The dev-log row layout needs a card surface to fit a grid slot. */
        #home-timeline .timeline-entry--log .log-preview {
          grid-template-columns: minmax(0, 1fr) 1.5rem;
          gap: 0.5rem 1rem;
          padding: 1rem 1.1rem;
          border: 1px solid var(--log-line, #a7baae);
          border-radius: var(--radius-lg);
          background: hsl(var(--card));
        }

        #home-timeline .timeline-entry--log .log-preview__date {
          display: flex;
          gap: 0.75rem;
          padding-top: 0;
        }

        #home-timeline .timeline-entry--log .log-preview__date span {
          margin: 0;
        }

        #home-timeline .timeline-entry--log .log-preview__copy {
          grid-column: 1;
        }

        #home-timeline .timeline-entry--log .log-preview__arrow {
          grid-column: 2;
          grid-row: 1 / 3;
        }

        /* With a cover, a log card shows the cover on top, no description,
           and the tags in a footer at the bottom. */
        #home-timeline .log-preview--cover {
          grid-template-rows: auto auto 1fr;
          overflow: hidden;
        }

        #home-timeline .log-preview--cover .log-preview__cover {
          grid-column: 1 / -1;
          grid-row: 1;
          margin: -1rem -1.1rem 0.4rem;
          background: #1b2b25;
        }

        #home-timeline .log-preview--cover .log-preview__cover img {
          display: block;
          width: 100%;
          height: 9rem;
          object-fit: cover;
        }

        #home-timeline .log-preview--cover .log-preview__date {
          grid-row: 2;
        }

        #home-timeline .log-preview--cover .log-preview__copy {
          display: flex;
          grid-row: 3;
          flex-direction: column;
        }

        #home-timeline .log-preview--cover .log-preview__copy p {
          display: none;
        }

        #home-timeline .log-preview--cover .log-preview__arrow {
          grid-row: 2;
          align-self: start;
          font-size: 1.1rem;
        }

        /* The right margin also spans the arrow column and the column gap. */
        #home-timeline .log-preview--cover .log-preview__tags {
          margin: auto -3.6rem -1rem -1.1rem;
          padding: 0.7rem 1.1rem 0.8rem;
          border-top: 1px solid var(--log-line, #a7baae);
        }

        #home-timeline
          .timeline-entry--image
          .content-preview:not(.content-preview--cover)
          .content-preview__visual {
          height: 9rem;
        }

        #home-timeline .timeline-entry--text .content-preview__visual {
          display: none;
        }

        #home-timeline .timeline-entry--text .content-preview__body {
          flex: none;
          padding: 0.9rem 1rem 0.85rem;
        }

        #home-timeline .timeline-entry--text .content-preview__body time {
          margin-bottom: 0.55rem;
        }

        #home-timeline .timeline-entry--text .content-preview__body h2 {
          font-size: clamp(1.35rem, 5cqw, 2rem);
          line-height: 1.02;
        }

        #home-timeline .timeline-entry--text .content-preview__body p {
          margin-top: 0.65rem;
        }

        #home-timeline .timeline-entry--text .content-preview__footer {
          min-height: 3.25rem;
          padding: 0.55rem 0.8rem;
        }

        .timeline-flight-path {
          stroke-dasharray: 1;
          stroke-dashoffset: 0;
        }

        @media (prefers-reduced-motion: reduce) {
          .timeline-flight-path {
            animation: none !important;
          }
        }

        @keyframes drawFlightPath {
          from {
            stroke-dashoffset: 1;
          }
          to {
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </section>
  );
}

export default memo(Timeline);
