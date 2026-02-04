import type { Stretch } from "@/components/tools/Stretching/types";

interface ControlButtonsProps {
  isRunning: boolean;
  isPaused: boolean;
  isResting: boolean;
  currentIndex: number;
  stretchesLength: number;
  currentRepetition: number;
  currentStretch: Stretch;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onReset: () => void;
}

export function ControlButtons({
  isRunning,
  isPaused,
  isResting,
  currentIndex,
  stretchesLength,
  currentRepetition,
  currentStretch,
  onStart,
  onPause,
  onResume,
  onNext,
  onPrevious,
  onReset,
}: ControlButtonsProps) {
  const isLastStretch = currentIndex === stretchesLength - 1;
  const currentReps = currentStretch?.repetitions || 1;
  const isLastRep = currentRepetition === currentReps;

  return (
    <div className="space-y-3">
      {/* Main controls row */}
      <div className="grid grid-cols-5 gap-2 sm:gap-3">
        {/* Previous button */}
        <button
          onClick={onPrevious}
          disabled={currentIndex === 0 && currentRepetition === 1}
          className="col-span-1 flex items-center justify-center py-3 sm:py-4 min-h-[56px] bg-muted text-foreground rounded-xl disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/10 active:scale-[0.98] transition-all font-medium touch-manipulation"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Main action button */}
        {!isRunning ? (
          <button
            onClick={onStart}
            className="col-span-3 flex items-center justify-center gap-2 py-3 sm:py-4 min-h-[56px] bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 active:scale-[0.98] transition-all font-semibold text-lg touch-manipulation shadow-sm"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Start
          </button>
        ) : isPaused ? (
          <button
            onClick={onResume}
            className="col-span-3 flex items-center justify-center gap-2 py-3 sm:py-4 min-h-[56px] bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 active:scale-[0.98] transition-all font-semibold text-lg touch-manipulation shadow-sm"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Resume
          </button>
        ) : (
          <button
            onClick={onPause}
            className="col-span-3 flex items-center justify-center gap-2 py-3 sm:py-4 min-h-[56px] bg-emerald-600 dark:bg-emerald-500 text-white rounded-xl hover:bg-emerald-700 dark:hover:bg-emerald-600 active:scale-[0.98] transition-all font-semibold text-lg touch-manipulation shadow-sm"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Pause
          </button>
        )}

        {/* Next button */}
        <button
          onClick={onNext}
          className="col-span-1 flex items-center justify-center py-3 sm:py-4 min-h-[56px] bg-muted text-foreground rounded-xl hover:bg-primary/10 active:scale-[0.98] transition-all font-medium touch-manipulation"
        >
          {isResting ? (
            <span className="text-xs font-medium">Skip</span>
          ) : isLastStretch && isLastRep ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
        </button>
      </div>

      {/* Reset button */}
      <button
        onClick={onReset}
        className="w-full py-2.5 min-h-[44px] text-muted-foreground hover:text-foreground rounded-xl hover:bg-muted active:bg-primary/10 transition-all font-medium text-sm touch-manipulation"
      >
        Reset Routine
      </button>
    </div>
  );
}
