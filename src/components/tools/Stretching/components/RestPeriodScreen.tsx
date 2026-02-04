import type { Stretch } from "@/components/tools/Stretching/types";
import { BreathingTimer } from "./BreathingTimer";

interface RestPeriodScreenProps {
  timeRemaining: number;
  isRunning: boolean;
  isPaused: boolean;
  nextStretchIndex: number | null;
  nextRepetition: number | null;
  stretches: Stretch[];
  onPause: () => void;
  onResume: () => void;
}

export function RestPeriodScreen({
  timeRemaining,
  isRunning,
  isPaused,
  nextStretchIndex,
  nextRepetition,
  stretches,
  onPause,
  onResume,
}: RestPeriodScreenProps) {
  const nextStretch = nextStretchIndex !== null ? stretches[nextStretchIndex] : null;

  return (
    <div className="bg-card rounded-3xl p-6 sm:p-8 shadow-sm border border-border space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-500/10 dark:bg-teal-400/10 mb-4">
          <div className="w-2 h-2 rounded-full bg-teal-500 dark:bg-teal-400 animate-pulse" />
          <span className="text-sm font-semibold text-teal-600 dark:text-teal-400">Rest Period</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground mb-2">
          Take a Breath
        </h2>
        <p className="text-muted-foreground">
          Prepare for the next stretch
        </p>
      </div>

      {/* Timer */}
      <div className="flex justify-center py-4">
        <BreathingTimer
          timeRemaining={timeRemaining}
          totalDuration={10}
          isRunning={isRunning}
          isPaused={isPaused}
          isResting={true}
        />
      </div>

      {/* Next stretch preview */}
      {nextStretch && (
        <div className="bg-muted rounded-2xl p-4 sm:p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Coming Up Next
          </p>
          <h3 className="font-semibold text-foreground mb-1">{nextStretch.name}</h3>
          <p className="text-sm text-muted-foreground">{nextStretch.description}</p>
          {nextRepetition !== null && (nextStretch.repetitions || 1) > 1 && (
            <p className="text-xs text-teal-600 dark:text-teal-400 mt-2">
              Rep {nextRepetition} of {nextStretch.repetitions || 1}
            </p>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="grid grid-cols-1 gap-3">
        {isPaused ? (
          <button
            onClick={onResume}
            className="flex items-center justify-center gap-2 py-4 min-h-[56px] bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 active:scale-[0.98] transition-all font-semibold text-lg touch-manipulation shadow-sm"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Resume Rest
          </button>
        ) : (
          <button
            onClick={onPause}
            className="flex items-center justify-center gap-2 py-4 min-h-[56px] bg-teal-600 dark:bg-teal-500 text-white rounded-xl hover:bg-teal-700 dark:hover:bg-teal-600 active:scale-[0.98] transition-all font-semibold text-lg touch-manipulation shadow-sm"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Pause Rest
          </button>
        )}
      </div>
    </div>
  );
}
