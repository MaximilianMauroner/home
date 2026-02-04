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
    <div className="bg-card rounded-3xl p-6 sm:p-8 shadow-sm border border-border space-y-6">
      {/* Stretch Info */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-3 flex-wrap">
          <span className="text-sm font-semibold text-primary bg-primary/10 px-3 py-1 rounded-full">
            {currentIndex + 1} / {stretchesLength}
          </span>
          {(currentStretch.repetitions || 1) > 1 && (
            <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-300 bg-emerald-500/10 dark:bg-emerald-400/10 px-3 py-1 rounded-full">
              Rep {currentRepetition} / {currentStretch.repetitions || 1}
            </span>
          )}
          <button
            onClick={onTimeBetweenSettingsClick}
            className="text-sm font-medium text-muted-foreground bg-muted px-3 py-1 rounded-full hover:bg-muted/80 transition-colors"
            title="Rest time between stretches"
          >
            Rest: {timeBetween}s
          </button>
        </div>
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground mb-2">{currentStretch.name}</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">{currentStretch.description}</p>
      </div>

      {/* Breathing Timer */}
      <div className="flex justify-center py-4">
        <BreathingTimer
          timeRemaining={timeRemaining}
          totalDuration={currentStretch.duration}
          isRunning={isRunning}
          isPaused={isPaused}
          isResting={isResting}
        />
      </div>

      {/* Progress Info */}
      <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{formatTime(timeRemainingTotal)} left</span>
        </div>
        <div className="w-px h-4 bg-border" />
        <div className="flex items-center gap-2">
          <span>{stepsRemaining} {stepsRemaining === 1 ? 'step' : 'steps'} remaining</span>
        </div>
      </div>

      {/* Timeline */}
      {stretches.length > 0 && (
        <div className="pt-2 border-t border-border">
          <StretchTimeline
            stretches={stretches}
            currentIndex={currentIndex}
            currentRepetition={currentRepetition}
            isPaused={isPaused}
            onJumpTo={onJumpTo}
          />
        </div>
      )}

      {/* Progress Bar */}
      <div className="relative h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500 to-teal-500 dark:from-emerald-400 dark:to-teal-400 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Control Buttons */}
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
        onReset={onReset}
      />
    </div>
  );
}
