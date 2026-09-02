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
}: ControlButtonsProps) {
  const isLastStretch = currentIndex === stretchesLength - 1;
  const currentReps = currentStretch?.repetitions || 1;
  const isLastRep = currentRepetition === currentReps;

  return (
    <div className="stretching-control-dock">
      <div className="mx-auto grid max-w-md grid-cols-5 gap-2 sm:max-w-none sm:gap-3">
        {/* Previous button */}
        <button
          type="button"
          onClick={onPrevious}
          aria-label="Previous stretch"
          disabled={currentIndex === 0 && currentRepetition === 1}
          className="col-span-1 flex min-h-[52px] items-center justify-center rounded-xl bg-muted py-3 font-medium text-foreground transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-[56px] sm:py-4"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>

        {/* Main action button */}
        {!isRunning ? (
          <button
            type="button"
            onClick={onStart}
            className="col-span-3 flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-primary py-3 text-lg font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 sm:min-h-[56px] sm:py-4"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Start
          </button>
        ) : isPaused ? (
          <button
            type="button"
            onClick={onResume}
            className="col-span-3 flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-primary py-3 text-lg font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 sm:min-h-[56px] sm:py-4"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Resume
          </button>
        ) : (
          <button
            type="button"
            onClick={onPause}
            className="col-span-3 flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-lg font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 sm:min-h-[56px] sm:py-4 dark:bg-emerald-500 dark:hover:bg-emerald-600"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Pause
          </button>
        )}

        {/* Next button */}
        <button
          type="button"
          onClick={onNext}
          aria-label={
            isResting
              ? "Skip rest"
              : isLastStretch && isLastRep
                ? "Finish routine"
                : "Next stretch"
          }
          className="col-span-1 flex min-h-[52px] items-center justify-center rounded-xl bg-muted py-3 font-medium text-foreground transition-colors hover:bg-primary/10 sm:min-h-[56px] sm:py-4"
        >
          {isResting ? (
            <span className="text-xs font-medium">Skip</span>
          ) : isLastStretch && isLastRep ? (
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          ) : (
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
