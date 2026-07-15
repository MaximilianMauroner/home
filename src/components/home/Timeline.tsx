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
  onSpaceshipDockedChange: (docked: boolean) => void;
  spaceshipDocked: boolean;
  spaceshipLaunching: boolean;
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

type TimelineFlightPath = {
  height: number;
  path: string;
  ship: {
    angle: number;
    x: number;
    y: number;
  };
  width: number;
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
      const columnCount = styles.gridTemplateColumns.split(" ").length;
      const rowHeight = 4;
      const parsedRowGap = Number.parseFloat(styles.rowGap);
      const rowGap = Number.isFinite(parsedRowGap) ? parsedRowGap : 0;
      const listItems = Array.from(grid.children) as HTMLLIElement[];

      if (columnCount === 1) {
        grid.classList.remove("timeline-masonry--ready");
        listItems.forEach((listItem) => {
          listItem.style.gridRowEnd = "auto";
        });
        return;
      }

      const spans = listItems.map((listItem) => {
        const card = listItem.firstElementChild as HTMLElement | null;
        if (!card) return 1;
        return Math.ceil(
          (card.getBoundingClientRect().height + rowGap) / (rowHeight + rowGap),
        );
      });

      listItems.forEach((listItem, index) => {
        listItem.style.gridRowEnd = `span ${spans[index]}`;
      });
      grid.classList.add("timeline-masonry--ready");
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
      grid.classList.remove("timeline-masonry--ready");
      Array.from(grid.children).forEach((child) => {
        (child as HTMLLIElement).style.gridRowEnd = "auto";
      });
    };
  }, [items]);

  return (
    <ol
      ref={gridRef}
      className="timeline-masonry grid list-none grid-cols-1 gap-5 p-0 md:grid-cols-2 xl:grid-cols-3"
    >
      {items.map((timelineItem) => (
        <li
          key={`${timelineItem.type}-${timelineItem.item.id}`}
          className="relative z-10 min-w-0"
          data-timeline-entry
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
  onSpaceshipDockedChange,
  spaceshipDocked,
  spaceshipLaunching,
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
  const [flightPath, setFlightPath] = useState<TimelineFlightPath | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const chaptersRef = useRef<HTMLDivElement>(null);
  const flightPathRef = useRef<SVGPathElement>(null);
  const spaceshipRef = useRef<SVGGElement>(null);
  const visibleItems = useMemo(
    () => (expanded ? allItems : allItems.slice(0, 6)),
    [allItems, expanded],
  );
  const visibleItemKey = visibleItems
    .map(({ item, type }) => `${type}-${item.id}`)
    .join("|");
  const chapters = useMemo(
    () =>
      visibleItems.reduce<TimelineChapter[]>((groups, item, index) => {
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
      }, []),
    [visibleItems],
  );
  const expandTimeline = () => {
    const scrollPosition = window.scrollY;
    onExpand();
    requestAnimationFrame(() => {
      window.scrollTo({ behavior: "instant", top: scrollPosition });
      timelineRef.current?.focus({ preventScroll: true });
      requestAnimationFrame(() =>
        window.scrollTo({ behavior: "instant", top: scrollPosition }),
      );
    });
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
    const container = chaptersRef.current;
    if (!container) return;

    let frame = 0;
    const updateFlightPath = () => {
      const containerBounds = container.getBoundingClientRect();
      const entries = Array.from(
        container.querySelectorAll<HTMLElement>("[data-timeline-entry]"),
      );
      const destination = container.querySelector<HTMLElement>(
        "[data-flight-destination]",
      );
      const launchButton = document.querySelector<HTMLElement>(
        "[data-timeline-launch-button]",
      );

      if (entries.length === 0) {
        setFlightPath(null);
        return;
      }

      const points = entries
        .map((entry) => {
          const bounds = entry.getBoundingClientRect();
          return {
            top: bounds.top - containerBounds.top,
            x: bounds.left - containerBounds.left + bounds.width / 2,
            y: bounds.top - containerBounds.top + bounds.height / 2,
          };
        })
        .sort((a, b) => a.top - b.top || a.x - b.x);

      const firstPoint = points[0];
      const launchBounds = launchButton?.getBoundingClientRect();
      const routeStart = launchBounds
        ? {
            x:
              launchBounds.left -
              containerBounds.left +
              launchBounds.width / 2,
            y: launchBounds.bottom - containerBounds.top,
          }
        : { x: 12, y: firstPoint.top + 20 };
      const routePoints = [
        ...(launchBounds ? [routeStart] : []),
        { x: 12, y: firstPoint.top + 20 },
        ...points.map(({ x, y }) => ({ x, y })),
        ...(destination
          ? [
              {
                x:
                  destination.getBoundingClientRect().left -
                  containerBounds.left +
                  destination.getBoundingClientRect().width / 2,
                y:
                  destination.getBoundingClientRect().top -
                  containerBounds.top +
                  destination.getBoundingClientRect().height / 2,
              },
            ]
          : []),
      ];
      let path = `M ${routePoints[0].x} ${routePoints[0].y}`;

      for (let index = 1; index < routePoints.length; index += 1) {
        const previous = routePoints[index - 1];
        const current = routePoints[index];
        const deltaX = current.x - previous.x;
        const deltaY = current.y - previous.y;

        if (Math.abs(deltaY) < 32) {
          const bend = index % 2 === 0 ? 18 : -18;
          path += ` C ${previous.x + deltaX * 0.34} ${previous.y + bend}, ${current.x - deltaX * 0.34} ${current.y + bend}, ${current.x} ${current.y}`;
        } else {
          const middleY = previous.y + deltaY / 2;
          const direction = index === 1 || index % 2 === 0 ? 1 : -1;
          const curve = Math.min(72, Math.max(24, Math.abs(deltaY) * 0.12));
          path += ` C ${previous.x + curve * direction} ${middleY}, ${current.x - curve * direction} ${middleY}, ${current.x} ${current.y}`;
        }
      }

      const shipTarget = routePoints[1];
      const nextFlightPath: TimelineFlightPath = {
        height: containerBounds.height,
        path,
        ship: {
          angle:
            (Math.atan2(
              shipTarget.y - routePoints[0].y,
              shipTarget.x - routePoints[0].x,
            ) *
              180) /
            Math.PI,
          x: routePoints[0].x,
          y: routePoints[0].y,
        },
        width: containerBounds.width,
      };
      setFlightPath((current) =>
        current?.height === nextFlightPath.height &&
        current.path === nextFlightPath.path &&
        current.ship.angle === nextFlightPath.ship.angle &&
        current.ship.x === nextFlightPath.ship.x &&
        current.ship.y === nextFlightPath.ship.y &&
        current.width === nextFlightPath.width
          ? current
          : nextFlightPath,
      );
    };

    const scheduleUpdate = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updateFlightPath);
    };
    const observer = new ResizeObserver(scheduleUpdate);
    observer.observe(container);
    container
      .querySelectorAll<HTMLElement>("[data-timeline-entry]")
      .forEach((entry) => observer.observe(entry));
    const destination = container.querySelector<HTMLElement>(
      "[data-flight-destination]",
    );
    if (destination) observer.observe(destination);
    const launchButton = document.querySelector<HTMLElement>(
      "[data-timeline-launch-button]",
    );
    if (launchButton) observer.observe(launchButton);
    window.addEventListener("resize", scheduleUpdate);
    scheduleUpdate();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [visibleItemKey]);

  useEffect(() => {
    const container = chaptersRef.current;
    const path = flightPathRef.current;
    const spaceship = spaceshipRef.current;
    if (!container || !path || !spaceship || !flightPath) return;

    const pathLength = path.getTotalLength();
    if (pathLength === 0) return;
    const pathSamples: Array<{ distance: number; y: number }> = [];
    for (let index = 0; index <= 400; index += 1) {
      const distance = (pathLength * index) / 400;
      const point = path.getPointAtLength(distance);
      const previous = pathSamples.at(-1);
      if (!previous || point.y > previous.y) {
        pathSamples.push({ distance, y: point.y });
      }
    }

    const getDistanceForY = (targetY: number) => {
      let lowerIndex = 0;
      let upperIndex = pathSamples.length - 1;
      while (lowerIndex < upperIndex) {
        const middleIndex = Math.floor((lowerIndex + upperIndex) / 2);
        if (pathSamples[middleIndex].y < targetY) {
          lowerIndex = middleIndex + 1;
        } else {
          upperIndex = middleIndex;
        }
      }

      const upper = pathSamples[lowerIndex];
      const lower = pathSamples[Math.max(0, lowerIndex - 1)];
      const segmentHeight = upper.y - lower.y;
      const interpolation =
        segmentHeight === 0
          ? 0
          : Math.max(0, Math.min(1, (targetY - lower.y) / segmentHeight));
      return lower.distance + (upper.distance - lower.distance) * interpolation;
    };

    let frame = 0;
    let currentDistance: number | null = null;
    let targetDistance = 0;
    let minimumDistance = 0;
    let maximumDistance = pathLength;
    let velocity = 0;
    let previousTimestamp = 0;
    let reportedDocked: boolean | null = null;

    const reportDocked = (docked: boolean) => {
      if (reportedDocked === docked) return;
      reportedDocked = docked;
      onSpaceshipDockedChange(docked);
    };

    const renderSpaceship = (distance: number) => {
      const progress = Math.max(0, Math.min(1, distance / pathLength));
      const point = path.getPointAtLength(distance);
      const nextPoint = path.getPointAtLength(
        Math.min(pathLength, distance + 2),
      );
      const angle =
        (Math.atan2(nextPoint.y - point.y, nextPoint.x - point.x) * 180) /
        Math.PI;

      spaceship.setAttribute(
        "transform",
        `translate(${point.x} ${point.y}) rotate(${angle}) scale(1.2)`,
      );
      spaceship.dataset.flightProgress = progress.toFixed(4);
      if (
        targetDistance <= pathLength * 0.001 &&
        distance <= pathLength * 0.0015
      ) {
        reportDocked(true);
      }
    };

    const updateTarget = () => {
      const containerBounds = container.getBoundingClientRect();
      const viewportGuide = window.innerHeight * 0.45;
      const travelRange = Math.max(
        1,
        containerBounds.height - window.innerHeight + viewportGuide,
      );
      const scrollProgress = Math.max(
        0,
        Math.min(1, (viewportGuide - containerBounds.top) / travelRange),
      );
      const pacedDistance = pathLength * scrollProgress;
      minimumDistance = getDistanceForY(
        window.innerHeight * 0.18 - containerBounds.top,
      );
      maximumDistance = getDistanceForY(
        window.innerHeight * 0.72 - containerBounds.top,
      );
      targetDistance = Math.max(
        minimumDistance,
        Math.min(maximumDistance, pacedDistance),
      );
      if (targetDistance > pathLength * 0.001) reportDocked(false);
      spaceship.dataset.flightTargetProgress = Math.max(
        0,
        Math.min(1, targetDistance / pathLength),
      ).toFixed(4);

      if (currentDistance === null) {
        currentDistance = targetDistance;
        renderSpaceship(currentDistance);
        return;
      }

      const constrainedDistance = Math.max(
        minimumDistance,
        Math.min(maximumDistance, currentDistance),
      );
      if (constrainedDistance !== currentDistance) {
        currentDistance = constrainedDistance;
        velocity *= 0.25;
      }

      if (frame === 0) {
        previousTimestamp = performance.now();
        frame = requestAnimationFrame(animateSpaceship);
      }
    };

    const animateSpaceship = (timestamp: number) => {
      frame = 0;
      if (currentDistance === null) return;

      const deltaTime = Math.min(0.032, (timestamp - previousTimestamp) / 1000);
      previousTimestamp = timestamp;
      const displacement = targetDistance - currentDistance;
      const acceleration = displacement * 90 - velocity * 13;
      velocity = Math.max(
        -1000,
        Math.min(1000, velocity + acceleration * deltaTime),
      );
      currentDistance += velocity * deltaTime;

      if (
        currentDistance < minimumDistance ||
        currentDistance > maximumDistance
      ) {
        currentDistance = Math.max(
          minimumDistance,
          Math.min(maximumDistance, currentDistance),
        );
        velocity *= -0.12;
      }

      const remainingDistance = targetDistance - currentDistance;
      if (Math.abs(remainingDistance) < 0.35 && Math.abs(velocity) < 2) {
        currentDistance = targetDistance;
        velocity = 0;
        renderSpaceship(currentDistance);
        return;
      }

      renderSpaceship(currentDistance);
      frame = requestAnimationFrame(animateSpaceship);
    };
    const scheduleUpdate = () => {
      updateTarget();
    };

    if (prefersReducedMotion) {
      spaceship.setAttribute(
        "transform",
        `translate(${flightPath.ship.x} ${flightPath.ship.y}) rotate(${flightPath.ship.angle}) scale(1.2)`,
      );
      spaceship.dataset.flightProgress = "0.0000";
      const updateReducedMotionDock = () => {
        reportDocked(
          container.getBoundingClientRect().top >= window.innerHeight * 0.45,
        );
      };
      window.addEventListener("scroll", updateReducedMotionDock, {
        passive: true,
      });
      window.addEventListener("resize", updateReducedMotionDock);
      updateReducedMotionDock();
      return () => {
        window.removeEventListener("scroll", updateReducedMotionDock);
        window.removeEventListener("resize", updateReducedMotionDock);
      };
    }

    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    const handleResize = () => {
      currentDistance = null;
      velocity = 0;
      cancelAnimationFrame(frame);
      frame = 0;
      scheduleUpdate();
    };
    window.addEventListener("resize", handleResize);
    scheduleUpdate();

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", handleResize);
    };
  }, [flightPath, onSpaceshipDockedChange, prefersReducedMotion]);

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
        <div
          ref={chaptersRef}
          className="relative pl-8 [overflow-anchor:none] sm:pl-10"
        >
          {flightPath && (
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute left-0 top-0 z-0 overflow-visible"
              focusable="false"
              height={flightPath.height}
              viewBox={`0 0 ${flightPath.width} ${flightPath.height}`}
              width={flightPath.width}
            >
              <path
                ref={flightPathRef}
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
                style={{
                  opacity: spaceshipLaunching || spaceshipDocked ? 0 : 1,
                }}
              >
                <TimelineSpaceshipGlyph />
              </g>
            </svg>
          )}

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
                  className="relative z-10 grid gap-5 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-6"
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
        @media (min-width: 768px) {
          #home-timeline .timeline-masonry--ready {
            grid-auto-flow: dense;
            grid-auto-rows: 4px;
          }
        }

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
