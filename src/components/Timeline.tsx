import { useEffect, useRef, useState } from "react";
import type { BlogType, LogType, SnackType } from "@/utils/server/content";
import BlogPreview from "./BlogPreview";
import LogPreview from "./LogPreview";
import SnackPreview from "./SnackPreview";
import { Pattern } from "./Pattern";

interface TimelineProps {
  blogs: BlogType[];
  logs: LogType[];
  snacks: SnackType[];
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

export default function Timeline({ blogs, logs, snacks }: TimelineProps) {
  const [allItems, setAllItems] = useState<TimelineItem[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Combine all items and sort by date
    const items: TimelineItem[] = [
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
    ].sort((a, b) => b.date.getTime() - a.date.getTime());

    setAllItems(items);
  }, [blogs, logs, snacks]);

  useEffect(() => {
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
  }, []);

  useEffect(() => {
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
  }, []);

  return (
    <section
      ref={timelineRef}
      className="relative min-h-[100vh] bg-gradient-to-b from-transparent via-indigo-50/20 to-indigo-100/30 py-32 dark:via-indigo-950/20 dark:to-indigo-950/30"
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
              transform: isVisible ? "translateY(0)" : "translateY(20px)",
              transition: "opacity 0.6s ease-out, transform 0.6s ease-out",
            }}
          >
            timeline
          </h2>
          <p
            className="text-lg font-light text-gray-600 sm:text-xl dark:text-gray-400"
            style={{
              opacity: isVisible ? 1 : 0,
              transform: isVisible ? "translateY(0)" : "translateY(20px)",
              transition:
                "opacity 0.8s ease-out 0.2s, transform 0.8s ease-out 0.2s",
            }}
          >
            all posts, logs, and snacks sorted by date
          </p>
        </div>

        {/* Vertical Timeline */}
        <div className="relative px-4 sm:px-8">
          {/* Central Timeline Line */}
          <div
            className="absolute bottom-0 left-1/2 top-0 w-1 -translate-x-1/2 bg-gradient-to-b from-indigo-500/50 via-purple-500/50 to-pink-500/50 dark:from-indigo-400/30 dark:via-purple-400/30 dark:to-pink-400/30"
            style={{
              animation: isVisible ? "drawLine 2s ease-out forwards" : "none",
            }}
          />

          {/* Timeline Items */}
          <div className="space-y-12 lg:space-y-16">
            {allItems.map((timelineItem, index) => {
              const animationDelay = isVisible ? index * 150 : 0;
              const typeStyle = getTypeStyle(timelineItem.type);
              const isLeft = index % 2 === 0;

              // Semi-random offsets for hand-placed look
              const randomSeed = index * 137; // Arbitrary seed
              const offsetY = (randomSeed % 20) - 10; // -10 to 10px
              const offsetX = (randomSeed % 30) - 15; // -15 to 15px

              return (
                <div
                  key={`${timelineItem.type}-${timelineItem.item.id}`}
                  className="relative"
                  style={{
                    marginTop: `${offsetY}px`,
                    scrollSnapAlign: "start",
                    scrollMarginTop: "20vh",
                  }}
                >
                  <div className="relative flex items-center">
                    {/* Left side card */}
                    {isLeft && (
                      <div
                        className="mr-auto w-[calc(50%-3rem)]"
                        style={{
                          opacity: isVisible ? 1 : 0,
                          transform: isVisible
                            ? `translateX(${offsetX}px) scale(1)`
                            : "translateX(-100px) scale(0.95)",
                          transition: `opacity 0.8s ease-out ${animationDelay}ms, transform 0.8s ease-out ${animationDelay}ms`,
                        }}
                      >
                        {timelineItem.type === "blog" && (
                          <BlogPreview blog={timelineItem.item as BlogType} />
                        )}
                        {timelineItem.type === "log" && (
                          <LogPreview log={timelineItem.item as LogType} />
                        )}
                        {timelineItem.type === "snack" && (
                          <SnackPreview
                            snack={timelineItem.item as SnackType}
                            image={
                              <div className="absolute inset-0 overflow-hidden opacity-[0.06]">
                                <Pattern
                                  seed={
                                    (timelineItem.item as SnackType).data.title
                                  }
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
                        )}
                      </div>
                    )}

                    {/* Center: Connection dot and horizontal line */}
                    <div className="absolute left-1/2 z-10 flex -translate-x-1/2 items-center">
                      {/* Horizontal connector line */}
                      <div
                        className={`absolute ${isLeft ? "left-full" : "right-full"} h-0.5 w-24 bg-gradient-to-r ${isLeft ? "from-indigo-500/30 to-transparent" : "from-transparent to-indigo-500/30"}`}
                        style={{
                          opacity: isVisible ? 1 : 0,
                          width: isVisible ? "6rem" : "0",
                          transition: `opacity 0.6s ease-out ${animationDelay + 300}ms, width 0.6s ease-out ${animationDelay + 300}ms`,
                        }}
                      />

                      {/* Timeline node - simple dot */}
                      <div
                        className={`relative ${typeStyle.dot} h-4 w-4 rounded-full border-2 border-white shadow-lg dark:border-gray-950`}
                        style={{
                          opacity: isVisible ? 1 : 0,
                          transform: isVisible ? "scale(1)" : "scale(0)",
                          transition: `opacity 0.5s ease-out ${animationDelay + 200}ms, transform 0.5s ease-out ${animationDelay + 200}ms`,
                        }}
                      />
                    </div>

                    {/* Right side card */}
                    {!isLeft && (
                      <div
                        className="ml-auto w-[calc(50%-3rem)]"
                        style={{
                          opacity: isVisible ? 1 : 0,
                          transform: isVisible
                            ? `translateX(${-offsetX}px) scale(1)`
                            : "translateX(100px) scale(0.95)",
                          transition: `opacity 0.8s ease-out ${animationDelay}ms, transform 0.8s ease-out ${animationDelay}ms`,
                        }}
                      >
                        {timelineItem.type === "blog" && (
                          <BlogPreview blog={timelineItem.item as BlogType} />
                        )}
                        {timelineItem.type === "log" && (
                          <LogPreview log={timelineItem.item as LogType} />
                        )}
                        {timelineItem.type === "snack" && (
                          <SnackPreview
                            snack={timelineItem.item as SnackType}
                            image={
                              <div className="absolute inset-0 overflow-hidden opacity-[0.06]">
                                <Pattern
                                  seed={
                                    (timelineItem.item as SnackType).data.title
                                  }
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
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* End marker */}
        {allItems.length > 0 && (
          <div
            className="relative mt-16 flex justify-center"
            style={{
              opacity: isVisible ? 1 : 0,
              transform: isVisible ? "translateY(0)" : "translateY(20px)",
              transition: "opacity 0.8s ease-out, transform 0.8s ease-out",
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
