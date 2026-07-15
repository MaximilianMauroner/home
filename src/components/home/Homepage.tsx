import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
  useRef,
} from "react";
import dayjs from "dayjs";
import weekOfYear from "dayjs/plugin/weekOfYear";
dayjs.extend(weekOfYear);
import type { PreviewEntry } from "@/components/content/previewTypes";
import { Queue } from "@/utils/queue";
import Timeline from "./Timeline";
import {
  clampLetterCardPosition,
  getLetterCardWidth,
} from "./letterCardPosition";

const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*";
const ogFirst = "maximilian";
const ogLast = "mauroner";

interface ContentItem {
  id: string;
  slug: string;
  collection: "blog" | "dev-log" | "snacks";
  data: {
    title: string;
    description: string;
    tags: string[];
    image?: string;
    releaseDate: Date | string;
  };
}

interface LetterCardProps {
  position: { x: number; y: number };
  onClose: () => void;
  content: ContentItem | null;
  onPositionChange: (position: { x: number; y: number }) => void;
}

interface HomepageProps {
  blogs: PreviewEntry[];
  logs: PreviewEntry[];
  snacks: PreviewEntry[];
  initialAge: string;
}

const LetterCard = ({
  position,
  onClose,
  content,
  onPositionChange,
}: LetterCardProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    cardRef.current?.focus({ preventScroll: true });
  }, [content?.slug]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  useEffect(() => {
    const keepCardVisible = () => {
      const bounds = cardRef.current?.getBoundingClientRect();
      if (!bounds) return;

      const nextPosition = clampLetterCardPosition({
        cardHeight: bounds.height,
        cardWidth: bounds.width,
        left: position.x,
        top: position.y,
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
      });

      if (nextPosition.x !== position.x || nextPosition.y !== position.y) {
        onPositionChange(nextPosition);
      }
    };

    keepCardVisible();
    window.addEventListener("resize", keepCardVisible);
    return () => window.removeEventListener("resize", keepCardVisible);
  }, [onPositionChange, position.x, position.y]);

  const handleDragStart = (event: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    const clientX =
      "touches" in event ? event.touches[0].clientX : event.clientX;
    const clientY =
      "touches" in event ? event.touches[0].clientY : event.clientY;

    setDragOffset({
      x: clientX - position.x,
      y: clientY - position.y,
    });
  };

  const handleDragMove = useCallback(
    (event: MouseEvent | TouchEvent) => {
      if (isDragging) {
        const clientX =
          "touches" in event ? event.touches[0].clientX : event.clientX;
        const clientY =
          "touches" in event ? event.touches[0].clientY : event.clientY;

        let newX = clientX - dragOffset.x;
        let newY = clientY - dragOffset.y;

        const bounds = cardRef.current?.getBoundingClientRect();
        onPositionChange(
          clampLetterCardPosition({
            cardHeight: bounds?.height,
            cardWidth: bounds?.width,
            left: newX,
            top: newY,
            viewportHeight: window.innerHeight,
            viewportWidth: window.innerWidth,
          }),
        );
      }
    },
    [isDragging, dragOffset, onPositionChange],
  );

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleDragMove);
      window.addEventListener("mouseup", handleDragEnd);
      window.addEventListener("touchmove", handleDragMove);
      window.addEventListener("touchend", handleDragEnd);
      return () => {
        window.removeEventListener("mousemove", handleDragMove);
        window.removeEventListener("mouseup", handleDragEnd);
        window.removeEventListener("touchmove", handleDragMove);
        window.removeEventListener("touchend", handleDragEnd);
      };
    }
  }, [isDragging, handleDragMove]);

  if (!content) {
    return (
      <div
        ref={cardRef}
        role="dialog"
        aria-label="Post preview"
        tabIndex={-1}
        className="fixed z-50 max-h-[calc(100dvh-2rem)] w-[min(24rem,calc(100vw-2rem))] select-none overflow-y-auto rounded-2xl border border-indigo-500/30 bg-black/95 p-4 text-center shadow-lg backdrop-blur-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400 dark:border-indigo-500/30 dark:bg-black/95 dark:text-indigo-300"
        style={{
          top: `${position.y}px`,
          left: `${position.x}px`,
        }}
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
      >
        <p>No content found</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close post preview"
          className="mt-2 text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200"
        >
          ✕
        </button>
      </div>
    );
  }

  const year = dayjs(content.data.releaseDate).format("YY");
  const week = dayjs(content.data.releaseDate).week();
  const formattedDate = `${year}-W${week}`;

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby="letter-card-title"
      aria-describedby="letter-card-description"
      tabIndex={-1}
      className="fixed z-50 max-h-[calc(100dvh-2rem)] w-[min(24rem,calc(100vw-2rem))] select-none overflow-y-auto rounded-2xl border border-indigo-500/20 bg-white/95 p-4 text-indigo-700 shadow-lg backdrop-blur-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400 dark:border-indigo-500/30 dark:bg-black/95 dark:text-indigo-300"
      style={{
        top: `${position.y}px`,
        left: `${position.x}px`,
        cursor: isDragging ? "grabbing" : "grab",
        touchAction: "none",
      }}
      onMouseDown={handleDragStart}
      onTouchStart={handleDragStart}
    >
      <div className="flex items-center justify-between gap-2 border-b border-indigo-500/30">
        <div className="flex w-full flex-row items-center justify-between">
          <span className="text-sm text-indigo-300">
            Found in:{" "}
            <a
              href={
                content.slug.startsWith("blog")
                  ? "/blog/"
                  : content.slug.startsWith("snacks")
                    ? "/snacks/"
                    : "/dev-log/"
              }
              className="hover:text-indigo-200 hover:underline"
            >
              {content.slug.startsWith("blog")
                ? "blog"
                : content.slug.startsWith("snacks")
                  ? "snacks"
                  : "dev-log"}
            </a>
          </span>
          <span className="ml-2 text-xs text-indigo-400/70">
            {formattedDate}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close post preview"
          className="min-h-11 min-w-11 rounded-md text-indigo-600 hover:text-indigo-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-500 dark:text-indigo-300 dark:hover:text-indigo-100"
        >
          ✕
        </button>
      </div>
      <div className="p-4">
        <h3
          id="letter-card-title"
          className="mb-2 text-lg font-bold text-indigo-700 dark:text-indigo-200"
        >
          {content.data.title}
        </h3>
        <p
          id="letter-card-description"
          className="text-sm text-indigo-600 dark:text-indigo-300"
        >
          {content.data.description}
        </p>
        <a
          href={`/${content.slug}`}
          className="mt-4 block rounded-md border border-indigo-500/30 px-4 py-2 text-center text-sm text-indigo-300 transition-colors hover:bg-indigo-500/10"
        >
          Read More
        </a>
      </div>
    </div>
  );
};

const Homepage = ({ blogs, logs, snacks, initialAge }: HomepageProps) => {
  const [firstname, setFirstname] = useState(ogFirst);
  const [lastname, setLastname] = useState(ogLast);
  const [activeCard, setActiveCard] = useState<{
    content: ContentItem | null;
    position: { x: number; y: number };
    triggerIndex: number;
  } | null>(null);
  const [showHint, setShowHint] = useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [timelineExpanded, setTimelineExpanded] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);
  const letterButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setPrefersReducedMotion(media.matches);
    updatePreference();
    media.addEventListener("change", updatePreference);
    return () => media.removeEventListener("change", updatePreference);
  }, []);

  // Transform the entries to match ContentItem format
  const transformedBlogs: ContentItem[] = blogs.map((blog) => ({
    ...blog,
    slug: `blog/${blog.id}`,
    collection: "blog",
  }));

  const transformedLogs: ContentItem[] = logs.map((log) => ({
    ...log,
    slug: `dev-log/${log.id}`,
    collection: "dev-log",
  }));

  const transformedSnacks: ContentItem[] = snacks.map((snack) => ({
    ...snack,
    slug: `snacks/${snack.id}`,
    collection: "snacks",
  }));

  const maxLen = Math.max(
    transformedBlogs.length,
    transformedLogs.length,
    transformedSnacks.length,
  );

  const queue = new Queue<ContentItem>();
  for (let i = 0; i < maxLen; i++) {
    if (i < transformedBlogs.length) {
      queue.enqueue(transformedBlogs[i]);
    }
    if (i < transformedLogs.length) {
      queue.enqueue(transformedLogs[i]);
    }
    if (i < transformedSnacks.length) {
      queue.enqueue(transformedSnacks[i]);
    }
  }

  const items = queue.toArray();

  const handleLetterClick = useCallback(
    (index: number, event: React.MouseEvent<HTMLButtonElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const cardWidth = getLetterCardWidth(viewportWidth);
      let activeCard = items[0];

      if (index < items.length) {
        activeCard = items[index];
      } else {
        const randomItem = items[Math.floor(Math.random() * items.length)];
        activeCard = randomItem;
      }

      setActiveCard((current) => {
        if (current?.triggerIndex === index) {
          requestAnimationFrame(() => event.currentTarget.focus());
          return null;
        }

        return {
          content: activeCard,
          position: clampLetterCardPosition({
            cardWidth,
            left: rect.left,
            top: rect.top,
            viewportHeight: window.innerHeight,
            viewportWidth,
          }),
          triggerIndex: index,
        };
      });
    },
    [items],
  );

  const closeActiveCard = useCallback(() => {
    const triggerIndex = activeCard?.triggerIndex;
    setActiveCard(null);
    setShowHint(false);
    if (triggerIndex !== undefined) {
      requestAnimationFrame(() =>
        letterButtonRefs.current[triggerIndex]?.focus(),
      );
    }
  }, [activeCard?.triggerIndex]);

  const loadByName = useCallback(
    (setName: Dispatch<SetStateAction<string>>, ogValue: string) => {
      if (prefersReducedMotion) {
        setName(ogValue);
        return;
      }

    let iteration = 0;

    const stringRemap = (str: string, iteration: number) => {
      return str
        .split("")
        .map((_, index) => {
          if (index < iteration) {
            return ogValue[index];
          }
          return letters[Math.floor(Math.random() * letters.length)];
        })
        .join("");
    };

    const unmask = () => {
      const interval = setInterval(() => {
        setName((prev) => stringRemap(prev, Math.floor(iteration)));

        if (iteration >= ogValue.length) {
          clearInterval(interval);
          setName(ogValue); // Ensure final value is correct
        }

        iteration += 1 / 3;
      }, 45);
    };
      setTimeout(unmask, 50);
    },
    [prefersReducedMotion],
  );

  useEffect(() => {
    loadByName(setFirstname, ogFirst);
    loadByName(setLastname, ogLast);

    // Hide the hint after first interaction or after 10 seconds
    const timer = setTimeout(() => setShowHint(false), 10000);
    return () => clearTimeout(timer);
  }, [loadByName]);

  const downArrow = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth="1.5"
      stroke="currentColor"
      className="size-4 md:size-6"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 17.25 12 21m0 0-3.75-3.75M12 21V3"
      />
    </svg>
  );

  const rightUpArrow = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth="1.5"
      stroke="currentColor"
      className="size-4 md:size-6"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m4.5 19.5 15-15m0 0H8.25m11.25 0v11.25"
      />
    </svg>
  );

  const handlePositionChange = useCallback(
    (newPosition: { x: number; y: number }) => {
      setActiveCard((prev) =>
        prev ? { ...prev, position: newPosition } : null,
      );
    },
    [],
  );

  const scrollToTimeline = useCallback(() => {
    setTimelineExpanded(true);
    if (timelineRef.current) {
      timelineRef.current.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "start",
      });
    }
  }, [prefersReducedMotion]);

  return (
    <div className="relative min-h-screen bg-transparent text-indigo-700 dark:text-indigo-300">
      {activeCard && (
        <LetterCard
          content={activeCard.content}
          position={activeCard.position}
          onClose={closeActiveCard}
          onPositionChange={handlePositionChange}
        />
      )}
      <div className="relative z-10 mx-auto max-w-7xl px-4">
        <div className="py-1" aria-hidden="true">
          <div className="my-10 grid w-full grid-flow-col grid-cols-5 grid-rows-2 items-center justify-center gap-y-3 text-center font-mono text-4xl font-extrabold [text-shadow:_0_0_10px_#818cf8] sm:text-6xl md:text-8xl">
            {firstname.split("").map((letter, index) => (
              <span
                key={index}
                className="relative text-center transition-all hover:text-indigo-200"
              >
                <button
                  ref={(element) => {
                    letterButtonRefs.current[index] = element;
                  }}
                  type="button"
                  data-letter={letter}
                  aria-label={`Show post preview for ${items[index]?.data.title ?? "a random post"}`}
                  aria-expanded={activeCard?.triggerIndex === index}
                  onClick={(e) => {
                    handleLetterClick(index, e);
                    setShowHint(false);
                  }}
                  className={`relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-md transition-all hover:scale-110 hover:text-violet-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-400 ${
                    index === 0 && showHint && !prefersReducedMotion
                      ? "relative before:absolute before:-inset-6 before:animate-wave-pulse-delayed before:rounded-full before:border before:border-violet-400/10 after:absolute after:-inset-3 after:animate-wave-pulse after:rounded-full after:border after:border-violet-400/20"
                      : ""
                  }`}
                >
                  {letter}
                </button>
                {index % 2 === 0 ? (
                  <div
                    aria-hidden="true"
                    className="absolute -bottom-2 left-[50%] -translate-x-[50%] translate-y-[50%] text-indigo-600 md:-bottom-4"
                  >
                    {downArrow}
                  </div>
                ) : index !== firstname.length - 1 ? (
                  <div
                    aria-hidden="true"
                    className="absolute right-0 top-0 text-indigo-600"
                  >
                    {rightUpArrow}
                  </div>
                ) : null}
              </span>
            ))}
          </div>
          <div className="my-10 grid w-full grid-flow-col grid-cols-4 grid-rows-2 items-center justify-center gap-y-3 text-center font-mono text-4xl font-extrabold [text-shadow:_0_0_10px_#818cf8] sm:text-6xl md:text-8xl">
            {lastname.split("").map((letter, index) => (
              <span
                key={index}
                className="relative text-center transition-all hover:text-indigo-200"
              >
                <button
                  ref={(element) => {
                    letterButtonRefs.current[firstname.length + index] =
                      element;
                  }}
                  type="button"
                  data-letter={letter}
                  aria-label={`Show post preview for ${items[firstname.length + index]?.data.title ?? "a random post"}`}
                  aria-expanded={
                    activeCard?.triggerIndex === firstname.length + index
                  }
                  onClick={(e) =>
                    handleLetterClick(firstname.length + index, e)
                  }
                  className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-md transition-all hover:scale-110 hover:text-violet-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-400"
                >
                  {letter}
                </button>
                {index % 2 === 0 ? (
                  <div
                    aria-hidden="true"
                    className="absolute -bottom-2 left-[50%] -translate-x-[50%] translate-y-[50%] text-indigo-600 md:-bottom-4"
                  >
                    {downArrow}
                  </div>
                ) : index !== lastname.length - 1 ? (
                  <div
                    aria-hidden="true"
                    className="absolute right-0 top-0 text-indigo-600"
                  >
                    {rightUpArrow}
                  </div>
                ) : null}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center justify-center py-8">
          <div className="relative max-w-prose rounded-2xl border border-indigo-500/20 bg-white/70 p-6 font-mono text-indigo-700 shadow-[0_0_15px_rgba(99,102,241,0.1)] backdrop-blur-sm dark:border-indigo-500/30 dark:bg-black/70 dark:text-indigo-300 dark:shadow-[0_0_15px_rgba(99,102,241,0.2)]">
            <div className="absolute -top-3 left-4 bg-black px-2 text-sm text-indigo-400">
              <span className="text-violet-400">$</span> cat{" "}
              <span className="text-indigo-300">profile.txt</span>
            </div>
            <div className="block space-y-4">
              <p className="typing-animation relative">
                <span className="animate-terminal-blink absolute -left-3">
                  ▌
                </span>
                hi, i'm a {initialAge}-year-old developer. currently studying
                software engineering at the&nbsp;
                <TechStackItem href="https://tuwien.at/" name="TU Wien" />.
              </p>
              <p className="typing-animation-delayed">
                i'm usually working on multiple&nbsp;
                <TechStackItem href="/tools/" name="Tools" />. for more info
                check them out on&nbsp;
                <TechStackItem
                  href="https://github.com/MaximilianMauroner"
                  name="GitHub"
                />
                &nbsp;or send me a message via&nbsp;
                <TechStackItem
                  href="mailto:home@relay.mauroner.net"
                  name="Email"
                />
              </p>
            </div>
          </div>
        </div>

        {/* Scroll to Timeline Button */}
        <div className="mb-20 flex justify-center">
          <button
            type="button"
            onClick={scrollToTimeline}
            aria-expanded={timelineExpanded}
            aria-controls="home-timeline"
            className="group flex flex-col items-center gap-2 rounded-xl border border-indigo-500/30 bg-white/50 px-6 py-4 text-indigo-700 transition-all duration-300 hover:border-indigo-500/60 hover:bg-white/80 hover:shadow-lg dark:border-indigo-500/40 dark:bg-black/50 dark:text-indigo-300 dark:hover:border-indigo-500/70 dark:hover:bg-black/70"
          >
            <span className="text-sm font-medium">
              {timelineExpanded ? "Go to timeline" : "View full timeline"}
            </span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
              className="h-5 w-5 animate-bounce"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Timeline Section */}
      <div ref={timelineRef}>
        <Timeline
          blogs={blogs}
          logs={logs}
          snacks={snacks}
          expanded={timelineExpanded}
          onExpand={() => setTimelineExpanded(true)}
        />
      </div>
    </div>
  );
};

const TechStackItem = ({ name, href }: { name: string; href: string }) => {
  return (
    <a
      href={href}
      target="_blank"
      rel="nofollow noreferrer"
      className="inline-block"
      title={name}
    >
      <span className="group relative inline-block whitespace-nowrap font-bold text-violet-600 transition-colors hover:text-indigo-500 dark:text-violet-300 dark:hover:text-indigo-200">
        {name}
        <span className="absolute bottom-0 left-0 h-0.5 w-0 bg-gradient-to-r from-violet-700 via-indigo-500 to-purple-500 transition-all duration-300 group-hover:w-full"></span>
      </span>
    </a>
  );
};

export default Homepage;
