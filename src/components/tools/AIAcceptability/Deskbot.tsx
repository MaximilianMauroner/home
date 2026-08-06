import { useEffect, useRef, useState } from "react";
import type { QuizAnswer } from "./types";

type DeskbotMood = "idle" | "waiting" | QuizAnswer;

const VERDICTS: Record<Exclude<DeskbotMood, "idle">, string> = {
  waiting: "Decision pending.",
  yes: "Permitted.",
  maybe: "Noncommittal.",
  no: "Judged.",
};

export default function Deskbot({ mood }: { mood: DeskbotMood }) {
  const robotRef = useRef<HTMLDivElement>(null);
  const [isBlinking, setIsBlinking] = useState(false);

  useEffect(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduceMotion) return;

    let blinkTimer: number | undefined;
    let reopenTimer: number | undefined;

    const scheduleBlink = () => {
      blinkTimer = window.setTimeout(
        () => {
          setIsBlinking(true);
          reopenTimer = window.setTimeout(() => {
            setIsBlinking(false);
            scheduleBlink();
          }, 150);
        },
        4_500 + Math.random() * 4_500,
      );
    };

    scheduleBlink();
    return () => {
      window.clearTimeout(blinkTimer);
      window.clearTimeout(reopenTimer);
    };
  }, []);

  useEffect(() => {
    const robot = robotRef.current;
    if (!robot) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduceMotion) return;

    let pointerX = 0;
    let pointerY = 0;
    let frame: number | undefined;

    const updateGaze = () => {
      frame = undefined;
      const bounds = robot.getBoundingClientRect();
      const deltaX = pointerX - (bounds.left + bounds.width / 2);
      const deltaY = pointerY - (bounds.top + bounds.height / 2);
      const distance = Math.max(Math.hypot(deltaX, deltaY), 1);
      const travel = Math.min(distance / 35, 4.5);

      robot.style.setProperty(
        "--deskbot-gaze-x",
        `${(deltaX / distance) * travel}px`,
      );
      robot.style.setProperty(
        "--deskbot-gaze-y",
        `${(deltaY / distance) * travel}px`,
      );
    };

    const followPointer = (event: PointerEvent) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      if (frame === undefined) frame = window.requestAnimationFrame(updateGaze);
    };

    window.addEventListener("pointermove", followPointer, { passive: true });
    return () => {
      window.removeEventListener("pointermove", followPointer);
      if (frame !== undefined) window.cancelAnimationFrame(frame);
    };
  }, []);

  const className = [
    "ai-deskbot",
    `ai-deskbot--${mood}`,
    isBlinking ? "ai-deskbot--blinking" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={robotRef} className={className} aria-hidden="true">
      <span className="ai-deskbot__bubble">
        {mood === "idle" ? "" : VERDICTS[mood]}
      </span>
      <svg className="ai-deskbot__sprite" viewBox="0 0 78 96" focusable="false">
        <path className="ai-deskbot__antenna" d="M36 0h6v9h-6z" />
        <path className="ai-deskbot__signal" d="M32 0h14v6H32z" />
        <path
          className="ai-deskbot__head"
          d="M18 8h42v8h8v40h-8v8H18v-8h-8V16h8z"
        />
        <path
          className="ai-deskbot__shade"
          d="M18 8h34v8H18zm-8 8h8v16h-8zm42 0h8v16h-8z"
        />
        <path
          className="ai-deskbot__sockets"
          d="M18 24h16v16H18zm26 0h16v16H44z"
        />
        <rect
          className="ai-deskbot__pupil"
          x="24"
          y="29"
          width="5"
          height="5"
        />
        <rect
          className="ai-deskbot__pupil"
          x="50"
          y="29"
          width="5"
          height="5"
        />
        <rect
          className="ai-deskbot__brow ai-deskbot__brow--left"
          x="18"
          y="19"
          width="16"
          height="4"
        />
        <rect
          className="ai-deskbot__brow ai-deskbot__brow--right"
          x="44"
          y="19"
          width="16"
          height="4"
        />
        <rect
          className="ai-deskbot__mouth ai-deskbot__mouth--neutral"
          x="31"
          y="48"
          width="16"
          height="4"
        />
        <path
          className="ai-deskbot__mouth ai-deskbot__mouth--happy"
          d="M27 44h5v6h15v-6h5v11h-5v5H32v-5h-5z"
        />
        <path
          className="ai-deskbot__mouth ai-deskbot__mouth--unsure"
          d="M27 48h8v-4h8v4h9v5h-9v4h-8v-4h-8z"
        />
        <path
          className="ai-deskbot__mouth ai-deskbot__mouth--frown"
          d="M27 49h5v-5h15v5h5v11h-5v-6H32v6h-5z"
        />
        <path className="ai-deskbot__body" d="M10 64h58v24H10z" />
        <path className="ai-deskbot__panel" d="M32 64h14v8H32z" />
        <path className="ai-deskbot__ears" d="M4 27h6v14H4zm64 0h6v14h-6z" />
      </svg>
    </div>
  );
}
