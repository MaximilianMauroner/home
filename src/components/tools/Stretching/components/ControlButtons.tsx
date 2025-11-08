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
  const currentReps = (currentStretch as any)?.repetitions || 1;
  const isLastRep = currentRepetition === currentReps;
  
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3">
      <button
        onClick={onPrevious}
        disabled={currentIndex === 0}
        className="col-span-1 px-3 sm:px-4 py-3 min-h-[48px] bg-secondary/80 text-secondary-foreground rounded-xl disabled:opacity-40 disabled:cursor-not-allowed hover:bg-secondary active:bg-secondary/70 transition-all font-medium text-sm touch-manipulation shadow-sm"
      >
        <span className="hidden sm:inline">← </span>Prev
      </button>
      {!isRunning ? (
        <button
          onClick={onStart}
          className="col-span-2 sm:col-span-3 px-4 sm:px-6 py-3 min-h-[48px] bg-gradient-to-r from-primary to-primary/90 text-primary-foreground rounded-xl hover:from-primary/90 hover:to-primary/80 active:scale-[0.98] transition-all font-semibold text-base touch-manipulation shadow-lg"
        >
          ▶ Start
        </button>
      ) : isPaused ? (
        <button
          onClick={onResume}
          className="col-span-2 sm:col-span-3 px-4 sm:px-6 py-3 min-h-[48px] bg-gradient-to-r from-primary to-primary/90 text-primary-foreground rounded-xl hover:from-primary/90 hover:to-primary/80 active:scale-[0.98] transition-all font-semibold text-base touch-manipulation shadow-lg"
        >
          ▶ Resume
        </button>
      ) : (
        <button
          onClick={onPause}
          className="col-span-2 sm:col-span-3 px-4 sm:px-6 py-3 min-h-[48px] bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl hover:from-orange-600 hover:to-orange-700 active:scale-[0.98] transition-all font-semibold text-base touch-manipulation shadow-lg"
        >
          ⏸ Pause
        </button>
      )}
      <button
        onClick={onNext}
        className="col-span-1 px-3 sm:px-4 py-3 min-h-[48px] bg-secondary/80 text-secondary-foreground rounded-xl hover:bg-secondary active:bg-secondary/70 transition-all font-medium text-sm touch-manipulation shadow-sm"
      >
        {isResting ? (
          "Skip Rest"
        ) : isLastStretch && isLastRep ? (
          "Finish"
        ) : (
          <>
            Next<span className="hidden sm:inline"> →</span>
          </>
        )}
      </button>
      <button
        onClick={onReset}
        className="col-span-2 sm:col-span-5 px-4 py-2.5 min-h-[40px] bg-destructive/10 text-destructive rounded-xl hover:bg-destructive/20 active:bg-destructive/30 transition-all font-medium text-sm touch-manipulation border border-destructive/20"
      >
        ↻ Reset
      </button>
    </div>
  );
}

