import type { Stretch } from "@/components/tools/Stretching/types";
import { BreathingTimer } from "./BreathingTimer";
import { StretchTimeline } from "./StretchTimeline";
import { ControlButtons } from "./ControlButtons";
import { formatTime } from "@/components/tools/Stretching/utils";

interface ControlPanelProps {
  currentStretch: Stretch;
  currentIndex: number;
  currentRepetition: number;
  stretchesLength: number;
  timeRemaining: number;
  isRunning: boolean;
  isPaused: boolean;
  progress: number;
  timeRemainingTotal: number;
  stepsRemaining: number;
  timeBetween: number;
  onTimeBetweenSettingsClick: () => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onReset: () => void;
  isResting: boolean;
  stretches?: Stretch[];
  onJumpTo?: (index: number) => void;
}

export function ControlPanel({
  currentStretch,
  currentIndex,
  currentRepetition,
  stretchesLength,
  timeRemaining,
  isRunning,
  isPaused,
  progress,
  timeRemainingTotal,
  stepsRemaining,
  timeBetween,
  onTimeBetweenSettingsClick,
  onStart,
  onPause,
  onResume,
  onNext,
  onPrevious,
  onReset,
  isResting,
  stretches = [],
  onJumpTo,
}: ControlPanelProps) {
  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6 lg:flex lg:min-h-[36rem] lg:flex-col lg:justify-center lg:p-8">
      <div className="text-center">
        <div className="mb-2 flex flex-wrap items-center justify-center gap-2">
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary sm:text-sm">
            {currentIndex + 1} / {stretchesLength}
          </span>
          {(currentStretch.repetitions || 1) > 1 && (
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 sm:text-sm dark:bg-emerald-400/10 dark:text-emerald-300">
              Rep {currentRepetition} / {currentStretch.repetitions || 1}
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

      <div className="flex justify-center py-1 sm:py-3">
        <BreathingTimer
          timeRemaining={timeRemaining}
          totalDuration={currentStretch.duration}
          isRunning={isRunning}
          isPaused={isPaused}
          isResting={isResting}
          compact
        />
      </div>

      <div className="space-y-2">
        <div
          aria-label={`${Math.round(progress)} percent complete`}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={Math.round(progress)}
          className="h-2 overflow-hidden rounded-full bg-muted"
          role="progressbar"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-center text-xs text-muted-foreground sm:text-sm">
          {formatTime(timeRemainingTotal)} left · {stepsRemaining}{" "}
          {stepsRemaining === 1 ? "step" : "steps"} remaining
        </p>
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

      <details className="group border-t border-border pt-1">
        <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between rounded-lg px-2 text-sm font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground">
          Session options
          <span aria-hidden="true" className="text-lg group-open:rotate-45">
            +
          </span>
        </summary>
        <div className="space-y-3 pb-1 pt-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onTimeBetweenSettingsClick}
              className="rounded-xl bg-muted px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-primary/10"
            >
              Rest duration: {timeBetween}s
            </button>
            <button
              type="button"
              onClick={onReset}
              className="rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Reset routine
            </button>
          </div>
          {stretches.length > 0 && (
            <div className="rounded-xl bg-muted/40 p-2">
              <p className="px-2 text-xs text-muted-foreground">
                {isPaused
                  ? "Choose a stretch to jump while paused."
                  : "Pause to jump to another stretch."}
              </p>
              <StretchTimeline
                stretches={stretches}
                currentIndex={currentIndex}
                currentRepetition={currentRepetition}
                isPaused={isPaused}
                onJumpTo={onJumpTo}
              />
            </div>
          )}
        </div>
      </details>
    </section>
  );
}
