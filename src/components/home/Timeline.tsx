import { useEffect, useMemo, useRef, useState } from "react";
import type { PreviewEntry } from "@/components/content/previewTypes";
import BlogPreview from "@/components/content/BlogPreview";
import LogPreview from "@/components/content/LogPreview";
import SnackPreview from "@/components/content/SnackPreview";
import { Pattern } from "@/components/layout/Pattern";

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
  month: string;
  year: number;
  items: Array<TimelineItem & { index: number }>;
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

const colors = [
  "text-amber-400",
  "text-orange-300",
  "text-yellow-300",
  "text-pink-300",
  "text-rose-300",
  "text-fuchsia-300",
  "text-purple-300",
  "text-indigo-300",
];

const monthAccents = [
  {
    node: "border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    panel:
      "border-emerald-200/70 bg-emerald-50/80 dark:border-emerald-900 dark:bg-emerald-950/45",
    text: "text-emerald-700 dark:text-emerald-300",
  },
  {
    node: "border-orange-300 bg-orange-100 text-orange-700 dark:border-orange-700 dark:bg-orange-950 dark:text-orange-300",
    panel:
      "border-orange-200/70 bg-orange-50/80 dark:border-orange-900 dark:bg-orange-950/45",
    text: "text-orange-700 dark:text-orange-300",
  },
  {
    node: "border-violet-300 bg-violet-100 text-violet-700 dark:border-violet-700 dark:bg-violet-950 dark:text-violet-300",
    panel:
      "border-violet-200/70 bg-violet-50/80 dark:border-violet-900 dark:bg-violet-950/45",
    text: "text-violet-700 dark:text-violet-300",
  },
  {
    node: "border-sky-300 bg-sky-100 text-sky-700 dark:border-sky-700 dark:bg-sky-950 dark:text-sky-300",
    panel:
      "border-sky-200/70 bg-sky-50/80 dark:border-sky-900 dark:bg-sky-950/45",
    text: "text-sky-700 dark:text-sky-300",
  },
];

const monthIcons = ["✦", "●", "✷", "◆"];

const dynamicColor = (index: number) => colors[index % colors.length];

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

const TimelineEntry = ({
  timelineItem,
  index,
}: {
  timelineItem: TimelineItem;
  index: number;
}) => {
  const hasImage = Boolean(
    timelineItem.item._imageUrl || timelineItem.item.data.image,
  );

  const renderPreview = () => {
    if (timelineItem.type === "blog") {
      return <BlogPreview blog={timelineItem.item} />;
    }

    if (timelineItem.type === "log") {
      return <LogPreview log={timelineItem.item} />;
    }

    return (
      <SnackPreview
        snack={timelineItem.item}
        image={
          <div className="absolute inset-0 overflow-hidden opacity-[0.06]">
            <Pattern
              seed={timelineItem.item.data.title}
              colorClass={dynamicColor(index)}
              opacity="0.12"
              gridSize={6 + (index % 3) * 1.5}
              spacing={20 + (index % 4) * 5}
              lineVariance={2 + (index % 2) * 1.5}
            />
            <div className="absolute inset-0 bg-gradient-to-br from-transparent via-amber-50/20 to-transparent dark:via-amber-950/5" />
          </div>
        }
      />
    );
  };

  return (
    <div
      className={`timeline-entry timeline-entry--${timelineItem.type} ${hasImage ? "timeline-entry--image" : "timeline-entry--text"}`}
    >
      {renderPreview()}
    </div>
  );
};

const TimelineMasonry = ({ items }: { items: TimelineChapter["items"] }) => {
  const gridRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const updateSpans = () => {
      const styles = getComputedStyle(grid);
      const rowHeight = Number.parseFloat(styles.gridAutoRows);
      const rowGap = Number.parseFloat(styles.rowGap);

      Array.from(grid.children).forEach((child) => {
        const listItem = child as HTMLLIElement;
        const card = listItem.firstElementChild as HTMLElement | null;

        if (!card || !Number.isFinite(rowHeight)) {
          listItem.style.gridRowEnd = "auto";
          return;
        }

        const span = Math.ceil(
          (card.getBoundingClientRect().height + rowGap) / (rowHeight + rowGap),
        );
        listItem.style.gridRowEnd = `span ${span}`;
      });
    };

    const observer = new ResizeObserver(updateSpans);
    observer.observe(grid);
    Array.from(grid.children).forEach((child) => {
      const card = child.firstElementChild;
      if (card) observer.observe(card);
    });

    const frame = requestAnimationFrame(updateSpans);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [items]);

  return (
    <ol
      ref={gridRef}
      className="grid list-none grid-cols-1 gap-5 p-0 md:grid-cols-2 md:[grid-auto-flow:dense] md:[grid-auto-rows:4px] xl:grid-cols-3"
    >
      {items.map((timelineItem) => (
        <li
          key={`${timelineItem.type}-${timelineItem.item.id}`}
          className="min-w-0"
        >
          <TimelineEntry
            timelineItem={timelineItem}
            index={timelineItem.index}
          />
        </li>
      ))}
    </ol>
  );
};

export default function Timeline({
  blogs,
  logs,
  snacks,
  expanded,
  onExpand,
}: TimelineProps) {
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
  const visibleItems = expanded ? allItems : allItems.slice(0, 6);
  const chapters = visibleItems.reduce<TimelineChapter[]>(
    (groups, item, index) => {
      const year = item.date.getUTCFullYear();
      const monthIndex = item.date.getUTCMonth();
      const key = `${year}-${monthIndex}`;
      const current = groups.at(-1);

      if (current?.key === key) {
        current.items.push({ ...item, index });
      } else {
        groups.push({
          key,
          month: months[monthIndex],
          year,
          items: [{ ...item, index }],
        });
      }

      return groups;
    },
    [],
  );
  const expandTimeline = () => {
    onExpand();
    requestAnimationFrame(() => timelineRef.current?.focus());
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

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 },
    );

    if (timelineRef.current) {
      observer.observe(timelineRef.current);
    }

    return () => {
      if (timelineRef.current) {
        observer.unobserve(timelineRef.current);
      }
    };
  }, [prefersReducedMotion]);

  return (
    <section
      id="home-timeline"
      ref={timelineRef}
      tabIndex={-1}
      className="relative min-h-[100vh] overflow-x-clip bg-gradient-to-b from-transparent via-indigo-50/20 to-indigo-100/30 py-24 outline-none lg:py-28 dark:via-indigo-950/20 dark:to-indigo-950/30"
    >
      {/* Decorative background elements */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-10 top-20 h-64 w-64 rounded-full bg-indigo-200/10 blur-3xl dark:bg-indigo-800/10" />
        <div className="absolute bottom-40 right-20 h-80 w-80 rounded-full bg-violet-200/10 blur-3xl dark:bg-violet-800/10" />
      </div>

      <div className="relative mx-auto max-w-[90rem] px-4 lg:px-6">
        {/* Section Header */}
        <div className="mb-12 text-center lg:mb-14">
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

        {/* Month chapters preserve newest-first DOM order in a dense editorial grid. */}
        <div className="relative pl-8 sm:pl-10">
          <div
            aria-hidden="true"
            className="absolute bottom-0 left-0 top-0 w-px bg-gray-300 dark:bg-gray-700"
            style={{
              animation:
                isVisible && !prefersReducedMotion
                  ? "drawLine 1.4s ease-out forwards"
                  : "none",
            }}
          />

          {allItems.length === 0 && (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }, (_, index) => (
                <TimelineCardSkeleton key={`timeline-skeleton-${index}`} />
              ))}
            </div>
          )}

          <div className="space-y-16 lg:space-y-20">
            {chapters.map((chapter, chapterIndex) => {
              const accent = monthAccents[chapterIndex % monthAccents.length];
              const icon = monthIcons[chapterIndex % monthIcons.length];
              const headingId = `timeline-${chapter.key}`;

              return (
                <section
                  key={chapter.key}
                  aria-labelledby={headingId}
                  className="relative grid gap-5 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-6"
                >
                  <div
                    aria-hidden="true"
                    className={`absolute -left-8 top-5 z-10 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full border ${accent.node} shadow-sm sm:-left-10`}
                  >
                    <span className="text-sm leading-none">{icon}</span>
                  </div>
                  <div
                    className={`flex flex-col rounded-2xl border p-5 lg:p-6 ${accent.panel}`}
                  >
                    <p
                      className={`mb-3 font-mono text-xs font-bold uppercase tracking-[0.18em] ${accent.text}`}
                    >
                      {chapter.items.length}{" "}
                      {chapter.items.length === 1 ? "post" : "posts"}
                    </p>
                    <h3
                      id={headingId}
                      className="text-4xl font-extrabold leading-none tracking-[-0.05em] text-gray-900 dark:text-gray-100"
                    >
                      {chapter.month}
                      <span className="mt-1 block text-2xl font-medium tracking-[-0.03em] text-gray-500 dark:text-gray-400">
                        {chapter.year}
                      </span>
                    </h3>
                  </div>

                  <TimelineMasonry items={chapter.items} />
                </section>
              );
            })}
          </div>

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
        </div>

        {/* End marker */}
        {expanded && allItems.length > 0 && (
          <div
            className="relative mt-16 flex justify-center"
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
            <div className="relative z-10 flex h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-xl dark:border-gray-950">
              <span className="text-2xl font-bold text-white">∞</span>
            </div>
          </div>
        )}
      </div>

      <style>{`
        #home-timeline .timeline-entry .content-preview {
          height: auto;
        }

        #home-timeline .timeline-entry--image .content-preview {
          min-height: 30rem;
        }

        #home-timeline .timeline-entry--image .content-preview__visual {
          height: 12rem;
        }

        #home-timeline .timeline-entry--text .content-preview {
          min-height: 0;
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

        @keyframes drawLine {
          from {
            height: 0;
          }
          to {
            height: 100%;
          }
        }
      `}</style>
    </section>
  );
}
