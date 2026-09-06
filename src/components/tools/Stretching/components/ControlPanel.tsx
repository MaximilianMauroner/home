import type { Stretch } from "@/components/tools/Stretching/types";
import { ControlButtons } from "./ControlButtons";
import { StretchDetails } from "./StretchDetails";
import { describeRepetition } from "../rail";
import { formatTime } from "@/components/tools/Stretching/utils";

interface ControlPanelProps {
  currentStretch: Stretch;
  currentIndex: number;
  currentRepetition: number;
  stretchesLength: number;
  timeRemaining: number;
  isRunning: boolean;
  isPaused: boolean;
  timeRemainingTotal: number;
  progress: number;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onNext: () => void;
  onPrevious: () => void;
  isResting: boolean;
}

/**
 * The cockpit half of the session: pose, clock bar, name, transport. Sized to
 * the frame so that none of it scrolls while a hold is running.
 */
export function ControlPanel({
  currentStretch,
  currentIndex,
  currentRepetition,
  stretchesLength,
  timeRemaining,
  isRunning,
  isPaused,
  timeRemainingTotal,
  progress,
  onStart,
  onPause,
  onResume,
  onNext,
  onPrevious,
  isResting,
}: ControlPanelProps) {
  const repetitionLabel = describeRepetition(
    currentRepetition,
    currentStretch.repetitions || 1,
  );
  const sessionProgress = Math.min(100, Math.max(0, progress));

  return (
    <section className="stretching-cockpit" aria-label="Pose and timer">
      <StretchDetails stretch={currentStretch} section="image" />

      <div className="stretching-clockbar">
        <p className="stretching-clockbar__count" aria-live="off">
          <span className="sr-only">Time left in this hold: </span>
          {formatTime(timeRemaining)}
        </p>
        <div className="stretching-clockbar__meta">
          <p className="stretching-clockbar__row">
            <span>hold</span>
            <span>
              <strong>{formatTime(timeRemainingTotal)}</strong> left in session
            </span>
          </p>
          <div
            className="stretching-track"
            role="progressbar"
            aria-label="Session progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(sessionProgress)}
          >
            <span style={{ width: `${sessionProgress}%` }} />
          </div>
          <p className="stretching-clockbar__row">
            <span>
              <strong>
                Step {currentIndex + 1} of {stretchesLength}
              </strong>
            </span>
            {repetitionLabel && <span>{repetitionLabel}</span>}
          </p>
        </div>
      </div>

      <h1 className="stretching-cockpit__title">{currentStretch.name}</h1>

      <ControlButtons
        isRunning={isRunning}
        isPaused={isPaused}
        isResting={isResting}
        currentIndex={currentIndex}
        stretchesLength={stretchesLength}
        currentRepetition={currentRepetition}
        currentStretch={currentStretch}
        onStart={onStart}
        onPause={onPause}
        onResume={onResume}
        onNext={onNext}
        onPrevious={onPrevious}
      />
    </section>
  );
}
