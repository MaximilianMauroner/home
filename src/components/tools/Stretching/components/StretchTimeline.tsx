import type { Stretch } from "@/components/tools/Stretching/types";

interface StretchTimelineProps {
  stretches: Stretch[];
  currentIndex: number;
  currentRepetition: number;
  isPaused: boolean;
  onJumpTo?: (index: number) => void;
}

export function StretchTimeline({
  stretches,
  currentIndex,
  currentRepetition,
  isPaused,
  onJumpTo,
}: StretchTimelineProps) {
  return (
    <div className="w-full overflow-x-auto py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex min-w-max items-center gap-1 px-2">
        {stretches.map((stretch, index) => {
          const isActive = index === currentIndex;
          const isCompleted = index < currentIndex;
          const reps = stretch.repetitions || 1;

          return (
            <div key={stretch.id} className="flex items-center">
              {/* Stretch node */}
              <button
                type="button"
                onClick={() => isPaused && onJumpTo?.(index)}
                disabled={!isPaused || !onJumpTo}
                aria-label={`${isPaused ? "Jump to" : "Stretch"} ${stretch.name}${isActive ? ", current stretch" : isCompleted ? ", completed" : ""}`}
                aria-current={isActive ? "step" : undefined}
                className={`group relative flex flex-col items-center ${
                  isPaused && onJumpTo ? "cursor-pointer" : "cursor-default"
                }`}
                title={stretch.name}
              >
                {/* Main dot */}
                <div
                  className={`h-4 w-4 rounded-full transition-colors duration-300 ${
                    isActive
                      ? "scale-125 bg-emerald-500 shadow-sm shadow-emerald-500/40 dark:bg-emerald-400 dark:shadow-emerald-400/40"
                      : isCompleted
                        ? "bg-teal-500 dark:bg-teal-400"
                        : "bg-foreground/20"
                  } ${
                    isPaused && onJumpTo
                      ? "hover:scale-125 hover:shadow-sm"
                      : ""
                  }`}
                >
                  {/* Pulse effect for active */}
                  {isActive && (
                    <div className="absolute inset-0 animate-ping rounded-full bg-emerald-500 opacity-30 dark:bg-emerald-400" />
                  )}
                </div>

                {/* Repetition indicators */}
                {reps > 1 && (
                  <div className="mt-1 flex gap-0.5">
                    {Array.from({ length: reps }).map((_, repIdx) => {
                      const repCompleted =
                        isCompleted ||
                        (isActive && repIdx < currentRepetition - 1);
                      const repActive =
                        isActive && repIdx === currentRepetition - 1;

                      return (
                        <div
                          key={repIdx}
                          className={`h-1.5 w-1.5 rounded-full transition-colors ${
                            repActive
                              ? "bg-emerald-500 dark:bg-emerald-400"
                              : repCompleted
                                ? "bg-teal-500/70 dark:bg-teal-400/70"
                                : "bg-foreground/10"
                          }`}
                        />
                      );
                    })}
                  </div>
                )}

                {/* Stretch name tooltip on hover */}
                <div className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 opacity-0 transition-opacity group-hover:opacity-100">
                  <div className="whitespace-nowrap rounded bg-foreground px-2 py-1 text-xs text-background">
                    {stretch.name.length > 20
                      ? `${stretch.name.slice(0, 20)}...`
                      : stretch.name}
                  </div>
                </div>
              </button>

              {/* Connector line */}
              {index < stretches.length - 1 && (
                <div
                  className={`h-0.5 w-6 transition-colors ${
                    isCompleted
                      ? "bg-teal-500/50 dark:bg-teal-400/50"
                      : "bg-foreground/10"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
