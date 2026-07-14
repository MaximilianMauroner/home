import { useEffect, useMemo, useRef, useState } from "react";
import type { BlogType, LogType, SnackType } from "@/utils/server/content";
import BlogPreview from "@/components/content/BlogPreview";
import LogPreview from "@/components/content/LogPreview";
import SnackPreview from "@/components/content/SnackPreview";
import { Pattern } from "@/components/layout/Pattern";

interface TimelineProps {
  blogs: BlogType[];
  logs: LogType[];
  snacks: SnackType[];
  expanded: boolean;
  onExpand: () => void;
}

type TimelineItem = {
  type: "blog" | "log" | "snack";
  item: BlogType | LogType | SnackType;
  date: Date;
};

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

const dynamicColor = (index: number) => {
  return colors[index % colors.length];
};

// Type-specific styling
const getTypeStyle = (type: "blog" | "log" | "snack") => {
  const style = {
    dot: "",
    label: "",
    gradient: "",
    border: "",
  };

  if (type === "blog") {
    style.dot = "bg-gradient-to-br from-indigo-500 to-purple-600";
    style.label =
      "bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300";
    style.gradient = "from-indigo-500/20 to-purple-500/20";
    style.border = "border-indigo-300 dark:border-indigo-700";
  } else if (type === "log") {
    style.dot = "bg-gradient-to-br from-green-500 to-emerald-600";
    style.label =
      "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300";
    style.gradient = "from-green-500/20 to-emerald-500/20";
    style.border = "border-green-300 dark:border-green-700";
  } else {
    style.dot = "bg-gradient-to-br from-amber-500 to-orange-600";
    style.label =
      "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300";
    style.gradient = "from-amber-500/20 to-orange-500/20";
    style.border = "border-amber-300 dark:border-amber-700";
  }

  return style;
};

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
  prefersReducedMotion,
}: {
  timelineItem: TimelineItem;
  index: number;
  prefersReducedMotion: boolean;
}) => {
  const typeStyle = getTypeStyle(timelineItem.type);
  const isLeft = index % 2 === 0;
  const randomSeed = index * 137;
  const offsetY = index === 0 ? 0 : randomSeed % 10;
  const offsetX = (randomSeed % 30) - 15;
  const revealDelay = (index % 3) * 90;
  const isRevealed = true;

  const renderPreview = () => {
    if (timelineItem.type === "blog") {
      return <BlogPreview blog={timelineItem.item as BlogType} />;
    }

    if (timelineItem.type === "log") {
      return <LogPreview log={timelineItem.item as LogType} />;
    }

    return (
      <SnackPreview
        snack={timelineItem.item as SnackType}
        image={
          <div className="absolute inset-0 overflow-hidden opacity-[0.06]">
            <Pattern
              seed={(timelineItem.item as SnackType).data.title}
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
      className="relative pb-8 lg:pb-12"
      style={{
        marginTop: index === 0 ? 0 : `${offsetY}px`,
        scrollSnapAlign: "start",
        scrollMarginTop: "20vh",
      }}
    >
      <div className="relative flex w-full items-center">
        <div
          className={`ml-8 w-[calc(100%-2rem)] ${isLeft ? "md:ml-0 md:mr-auto md:w-[calc(50%-3rem)]" : "md:hidden"}`}
          style={{
            opacity: isRevealed ? 1 : 0,
            transform: prefersReducedMotion
              ? "translateX(0) scale(1)"
              : isRevealed
                ? `translateX(${offsetX}px) scale(1)`
                : "translateX(-100px) scale(0.95)",
            transition: prefersReducedMotion
              ? "none"
              : `opacity 0.8s ease-out ${revealDelay}ms, transform 0.8s ease-out ${revealDelay}ms`,
          }}
        >
          {renderPreview()}
        </div>

        <div className="absolute left-4 z-10 flex items-center md:left-1/2 md:-translate-x-1/2">
          <div
            className={`transition-duration-[600ms] absolute left-full h-0.5 bg-gradient-to-r from-indigo-500/30 to-transparent transition-all ${isRevealed ? "w-8 md:w-24" : "w-0"} ${isLeft ? "md:left-full md:from-indigo-500/30 md:to-transparent" : "md:left-auto md:right-full md:from-transparent md:to-indigo-500/30"}`}
            style={{
              opacity: isRevealed ? 1 : 0,
              transitionDelay: prefersReducedMotion
                ? "0ms"
                : `${revealDelay + 200}ms`,
            }}
          />

          <div
            className={`relative ${typeStyle.dot} h-3 w-3 rounded-full border-2 border-white shadow-lg md:h-4 md:w-4 dark:border-gray-950`}
            style={{
              opacity: isRevealed ? 1 : 0,
              transform:
                prefersReducedMotion || isRevealed ? "scale(1)" : "scale(0)",
              transition: prefersReducedMotion
                ? "none"
                : `opacity 0.5s ease-out ${revealDelay + 120}ms, transform 0.5s ease-out ${revealDelay + 120}ms`,
            }}
          />
        </div>

        {!isLeft && (
          <div
            className="hidden md:ml-auto md:mr-0 md:block md:w-[calc(50%-3rem)]"
            style={{
              opacity: isRevealed ? 1 : 0,
              transform: prefersReducedMotion
                ? "translateX(0) scale(1)"
                : isRevealed
                  ? `translateX(${-offsetX}px) scale(1)`
                  : "translateX(100px) scale(0.95)",
              transition: prefersReducedMotion
                ? "none"
                : `opacity 0.8s ease-out ${revealDelay}ms, transform 0.8s ease-out ${revealDelay}ms`,
            }}
          >
            {renderPreview()}
          </div>
        )}
      </div>
    </div>
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
          date: blog.data.releaseDate,
        })),
        ...logs.map((log) => ({
          type: "log" as const,
          item: log,
          date: log.data.releaseDate,
        })),
        ...snacks.map((snack) => ({
          type: "snack" as const,
          item: snack,
          date: snack.data.releaseDate,
        })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [blogs, logs, snacks],
  );
  const [isVisible, setIsVisible] = useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);
  const visibleItems = expanded ? allItems : allItems.slice(0, 6);
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

  useEffect(() => {
    if (prefersReducedMotion) return;

    // Enable scroll snap on html for smooth snap scrolling when timeline is visible
    const html = document.documentElement;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          html.style.scrollSnapType = "y proximity";
          html.style.scrollBehavior = "smooth";
          html.style.scrollPaddingTop = "20vh";
        } else {
          html.style.scrollSnapType = "";
          html.style.scrollBehavior = "";
          html.style.scrollPaddingTop = "";
        }
      },
      { threshold: 0.1 },
    );

    if (timelineRef.current) {
      observer.observe(timelineRef.current);
    }

    return () => {
      observer.disconnect();
      html.style.scrollSnapType = "";
      html.style.scrollBehavior = "";
      html.style.scrollPaddingTop = "";
    };
  }, [prefersReducedMotion]);

  return (
    <section
      id="home-timeline"
      ref={timelineRef}
      tabIndex={-1}
      className="relative min-h-[100vh] overflow-x-clip bg-gradient-to-b from-transparent via-indigo-50/20 to-indigo-100/30 py-32 outline-none dark:via-indigo-950/20 dark:to-indigo-950/30"
    >
      {/* Decorative background elements */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-10 top-20 h-64 w-64 rounded-full bg-indigo-200/10 blur-3xl dark:bg-indigo-800/10" />
        <div className="absolute bottom-40 right-20 h-80 w-80 rounded-full bg-violet-200/10 blur-3xl dark:bg-violet-800/10" />
      </div>

      <div className="relative mx-auto max-w-5xl px-4 lg:px-6">
        {/* Section Header */}
        <div className="mb-16 text-center">
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

        {/* Vertical Timeline */}
        <div className="relative px-4 sm:px-8">
          {/* Central Timeline Line - left on mobile, center on desktop */}
          <div
            className="absolute bottom-0 left-4 top-0 w-1 bg-gradient-to-b from-indigo-500/50 via-purple-500/50 to-pink-500/50 md:left-1/2 md:-translate-x-1/2 dark:from-indigo-400/30 dark:via-purple-400/30 dark:to-pink-400/30"
            style={{
              animation:
                isVisible && !prefersReducedMotion
                  ? "drawLine 2s ease-out forwards"
                  : "none",
            }}
          />

          {/* Timeline Items */}
          <div className="space-y-32 lg:space-y-40">
            {allItems.length === 0 &&
              Array.from({ length: 4 }, (_, index) => {
                const isLeft = index % 2 === 0;

                return (
                  <div
                    key={`timeline-skeleton-${index}`}
                    className="relative pb-8 lg:pb-12"
                  >
                    <div className="relative flex w-full items-center">
                      <div
                        className={`ml-8 w-[calc(100%-2rem)] ${isLeft ? "md:ml-0 md:mr-auto md:w-[calc(50%-3rem)]" : "md:hidden"}`}
                      >
                        <TimelineCardSkeleton />
                      </div>

                      <div className="absolute left-4 z-10 flex items-center md:left-1/2 md:-translate-x-1/2">
                        <div className="absolute left-full h-0.5 w-8 bg-gradient-to-r from-indigo-500/20 to-transparent md:w-24" />
                        <div className="relative h-3 w-3 rounded-full border-2 border-white bg-indigo-300 shadow-lg md:h-4 md:w-4 dark:border-gray-950 dark:bg-indigo-700" />
                      </div>

                      {!isLeft && (
                        <div className="hidden md:ml-auto md:mr-0 md:block md:w-[calc(50%-3rem)]">
                          <TimelineCardSkeleton />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            {visibleItems.map((timelineItem, index) => (
              <TimelineEntry
                key={`${timelineItem.type}-${timelineItem.item.id}`}
                timelineItem={timelineItem}
                index={index}
                prefersReducedMotion={prefersReducedMotion}
              />
            ))}
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
        {allItems.length > 0 && (
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
