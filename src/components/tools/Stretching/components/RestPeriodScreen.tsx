import type { Stretch } from "@/components/tools/Stretching/types";
import { TimerDisplay } from "./TimerDisplay";

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
  return (
    <div className="bg-gradient-to-br from-blue-500/20 to-blue-500/10 rounded-2xl p-4 sm:p-6 shadow-lg border-2 border-blue-500/30 space-y-4 sm:space-y-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs sm:text-sm font-semibold text-blue-600 bg-blue-500/20 px-2 py-1 rounded-full">
              Rest Period
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-1.5 leading-tight text-blue-600">
            Prepare for Next...
          </h2>
          {nextStretchIndex !== null && stretches[nextStretchIndex] && (
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Next: <span className="font-semibold">{stretches[nextStretchIndex].name}</span>
              {nextRepetition !== null && (
                <span className="ml-2">
                  (Rep {nextRepetition} / {(stretches[nextStretchIndex] as any)?.repetitions || 1})
                </span>
              )}
            </p>
          )}
        </div>
        <div className="flex-shrink-0">
          <TimerDisplay
            timeRemaining={timeRemaining}
            isRunning={isRunning}
            isPaused={isPaused}
            variant="blue"
          />
        </div>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
        {isPaused ? (
          <button
            onClick={onResume}
            className="col-span-2 sm:col-span-3 px-4 sm:px-6 py-3 min-h-[48px] bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 active:scale-[0.98] transition-all font-semibold text-base touch-manipulation shadow-lg"
          >
            ▶ Resume Rest
          </button>
        ) : (
          <button
            onClick={onPause}
            className="col-span-2 sm:col-span-3 px-4 sm:px-6 py-3 min-h-[48px] bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl hover:from-orange-600 hover:to-orange-700 active:scale-[0.98] transition-all font-semibold text-base touch-manipulation shadow-lg"
          >
            ⏸ Pause Rest
          </button>
        )}
      </div>
    </div>
  );
}

