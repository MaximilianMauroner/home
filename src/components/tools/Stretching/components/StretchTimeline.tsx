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
    <div className="w-full overflow-x-auto py-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      <div className="flex items-center gap-1 min-w-max px-2">
        {stretches.map((stretch, index) => {
          const isActive = index === currentIndex;
          const isCompleted = index < currentIndex;
          const reps = stretch.repetitions || 1;

          return (
            <div key={stretch.id} className="flex items-center">
              {/* Stretch node */}
              <button
                onClick={() => isPaused && onJumpTo?.(index)}
                disabled={!isPaused || !onJumpTo}
                className={`relative flex flex-col items-center group ${
                  isPaused && onJumpTo ? "cursor-pointer" : "cursor-default"
                }`}
                title={stretch.name}
              >
                {/* Main dot */}
                <div
                  className={`w-4 h-4 rounded-full transition-all duration-300 ${
                    isActive
                      ? "bg-emerald-500 dark:bg-emerald-400 shadow-lg shadow-emerald-500/40 dark:shadow-emerald-400/40 scale-125"
                      : isCompleted
                      ? "bg-teal-500 dark:bg-teal-400"
                      : "bg-foreground/20"
                  } ${
                    isPaused && onJumpTo
                      ? "hover:scale-125 hover:shadow-md"
                      : ""
                  }`}
                >
                  {/* Pulse effect for active */}
                  {isActive && (
                    <div className="absolute inset-0 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-ping opacity-30" />
                  )}
                </div>

                {/* Repetition indicators */}
                {reps > 1 && (
                  <div className="flex gap-0.5 mt-1">
                    {Array.from({ length: reps }).map((_, repIdx) => {
                      const repCompleted = isCompleted || (isActive && repIdx < currentRepetition - 1);
                      const repActive = isActive && repIdx === currentRepetition - 1;

                      return (
                        <div
                          key={repIdx}
                          className={`w-1.5 h-1.5 rounded-full transition-all ${
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
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <div className="bg-foreground text-background text-xs px-2 py-1 rounded whitespace-nowrap">
                    {stretch.name.length > 20
                      ? `${stretch.name.slice(0, 20)}...`
                      : stretch.name}
                  </div>
                </div>
              </button>

              {/* Connector line */}
              {index < stretches.length - 1 && (
                <div
                  className={`w-6 h-0.5 transition-colors ${
                    isCompleted ? "bg-teal-500/50 dark:bg-teal-400/50" : "bg-foreground/10"
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
