import { useEffect, useRef, useState } from "react";
import type { QuizAnswer } from "./types";

type DeskbotMood = "idle" | "waiting" | QuizAnswer;

const VERDICTS: Record<Exclude<DeskbotMood, "idle">, string> = {
  waiting: "Decision pending.",
  yes: "Permitted.",
  maybe: "Noncommittal.",
  no: "Judged.",
};

export default function Deskbot({
  mood,
  isReacting,
}: {
  mood: DeskbotMood;
  isReacting: boolean;
}) {
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
    isReacting ? "ai-deskbot--reacting" : "",
    isBlinking ? "ai-deskbot--blinking" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={robotRef} className={className} aria-hidden="true">
      <span className="ai-deskbot__identity">AI observer</span>
      <span className="ai-deskbot__bubble">
        {mood === "idle" ? "" : VERDICTS[mood]}
      </span>
      <svg
        className="ai-deskbot__sprite"
        viewBox="0 0 112 112"
        focusable="false"
      >
        <path
          className="ai-deskbot__signal"
          d="M8 4h12v8H8zm21 0h12v8H29zm42 0h12v8H71zm21 0h12v8H92z"
        />
        <path className="ai-deskbot__head" d="M14 14h84v58H14z" />
        <path className="ai-deskbot__shade" d="M20 20h72v46H20z" />
        <path className="ai-deskbot__body" d="M4 25h10v36H4zm94 0h10v36H98z" />
        <path
          className="ai-deskbot__sockets"
          d="M24 27h27v27H24zm37 0h27v27H61z"
        />
        <rect
          className="ai-deskbot__pupil"
          x="34"
          y="37"
          width="7"
          height="7"
        />
        <rect
          className="ai-deskbot__pupil"
          x="71"
          y="37"
          width="7"
          height="7"
        />
        <rect
          className="ai-deskbot__brow ai-deskbot__brow--left"
          x="24"
          y="22"
          width="27"
          height="4"
        />
        <rect
          className="ai-deskbot__brow ai-deskbot__brow--right"
          x="61"
          y="22"
          width="27"
          height="4"
        />
        <rect
          className="ai-deskbot__mouth ai-deskbot__mouth--neutral"
          x="43"
          y="59"
          width="26"
          height="5"
        />
        <path
          className="ai-deskbot__mouth ai-deskbot__mouth--happy"
          d="M38 54h6v6h24v-6h6v12h-6v5H44v-5h-6z"
        />
        <path
          className="ai-deskbot__mouth ai-deskbot__mouth--unsure"
          d="M38 59h11v-5h11v5h14v6H60v5H49v-5H38z"
        />
        <path
          className="ai-deskbot__mouth ai-deskbot__mouth--frown"
          d="M38 61h6v-6h24v6h6v11h-6v-5H44v5h-6z"
        />
        <path className="ai-deskbot__head" d="M51 72h10v13h27v22H24V85h27z" />
        <path className="ai-deskbot__body" d="M31 91h50v9H31z" />
        <path
          className="ai-deskbot__panel"
          d="M37 93h8v5h-8zm15 0h8v5h-8zm15 0h8v5h-8z"
        />
      </svg>
    </div>
  );
}
