import {
  createElement,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ElementType,
} from "react";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*";

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const scramble = (target: string, revealed: number) =>
  target
    .split("")
    .map((char, index) => {
      if (char === " ") return " ";
      if (index < revealed) return target[index];
      return LETTERS[Math.floor(Math.random() * LETTERS.length)];
    })
    .join("");

interface GlitchProps {
  /** The final, resolved text. */
  text: string;
  className?: string;
  /** Tag to render. Defaults to span. */
  as?: ElementType;
  /** Decrypt automatically once when it scrolls into view. */
  autoplay?: boolean;
  /** Decrypt on hover/focus. Defaults to true. */
  hover?: boolean;
  /** ms between reveal ticks. */
  speed?: number;
}

/**
 * Reusable decrypt/scramble text effect, extracted from the homepage name
 * animation. Used for nav labels and section titles.
 */
export default function Glitch({
  text,
  className,
  as = "span",
  autoplay = false,
  hover = true,
  speed = 35,
}: GlitchProps) {
  const [display, setDisplay] = useState(text);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reduced = useRef(false);

  const run = useCallback(() => {
    if (reduced.current) {
      setDisplay(text);
      return;
    }
    if (intervalRef.current) clearInterval(intervalRef.current);
    let revealed = 0;
    intervalRef.current = setInterval(() => {
      setDisplay(scramble(text, Math.floor(revealed)));
      if (revealed >= text.length) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = null;
        setDisplay(text);
      }
      revealed += 1 / 2;
    }, speed);
  }, [text, speed]);

  useEffect(() => {
    reduced.current = prefersReducedMotion();
    setDisplay(text);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [text]);

  const containerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!autoplay || reduced.current) return;
    const node = containerRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            run();
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [autoplay, run]);

  const handlers = hover
    ? {
        onMouseEnter: run,
        onFocus: run,
      }
    : undefined;

  return createElement(
    as,
    {
      ref: containerRef,
      className,
      "data-glitch": true,
      "aria-label": text,
      ...handlers,
    },
    display,
  );
}
