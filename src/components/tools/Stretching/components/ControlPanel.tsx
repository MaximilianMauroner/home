import type { Stretch } from "@/components/tools/Stretching/types";
import { BreathingTimer } from "./BreathingTimer";
import { ControlButtons } from "./ControlButtons";
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
  stepsRemaining: number;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onNext: () => void;
  onPrevious: () => void;
  isResting: boolean;
}

export function ControlPanel({
  currentStretch,
  currentIndex,
  currentRepetition,
  stretchesLength,
  timeRemaining,
  isRunning,
  isPaused,
  timeRemainingTotal,
  stepsRemaining,
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

  return (
    <section className="stretching-session-cues space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6 lg:flex lg:min-h-[36rem] lg:flex-col lg:justify-center lg:p-8">
      <div className="text-center">
        <div className="mb-2 flex flex-wrap items-center justify-center gap-2">
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary sm:text-sm">
            {currentIndex + 1} / {stretchesLength}
          </span>
          {repetitionLabel && (
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 sm:text-sm dark:bg-emerald-400/10 dark:text-emerald-300">
              {repetitionLabel}
            </span>
          )}
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {currentStretch.name}
        </h1>
        <p className="mx-auto mt-1 max-w-md text-sm leading-snug text-muted-foreground">
          {currentStretch.description}
        </p>
      </div>

      <div className="stretching-session-timer flex justify-center py-1 sm:py-3">
        <BreathingTimer
          timeRemaining={timeRemaining}
          totalDuration={currentStretch.duration}
          isRunning={isRunning}
          isPaused={isPaused}
          isResting={isResting}
          compact
        />
      </div>

      <div className="grid grid-cols-2 gap-2 border-y border-border py-3 text-center">
        <div>
          <p className="text-lg font-semibold tabular-nums text-foreground">
            {formatTime(timeRemainingTotal)}
          </p>
          <p className="text-xs text-muted-foreground">remaining</p>
        </div>
        <div>
          <p className="text-lg font-semibold tabular-nums text-foreground">
            {stepsRemaining}
          </p>
          <p className="text-xs text-muted-foreground">
            {stepsRemaining === 1 ? "step" : "steps"} left
          </p>
        </div>
      </div>

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
