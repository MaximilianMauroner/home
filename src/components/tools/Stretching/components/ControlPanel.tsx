import type { Stretch } from "@/components/tools/Stretching/types";
import { TimerDisplay } from "./TimerDisplay";
import { ProgressBar } from "./ProgressBar";
import { ControlButtons } from "./ControlButtons";

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
}: ControlPanelProps) {
  return (
    <div className="bg-gradient-to-br from-card to-card/80 rounded-2xl p-4 sm:p-6 shadow-lg border border-border/50 space-y-4 sm:space-y-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-xs sm:text-sm font-semibold text-primary bg-primary/10 px-2 py-1 rounded-full">
              {currentIndex + 1} / {stretchesLength}
            </span>
            {((currentStretch as any).repetitions || 1) > 1 && (
              <span className="text-xs sm:text-sm font-semibold text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
                Rep {currentRepetition} / {(currentStretch as any).repetitions || 1}
              </span>
            )}
            <button
              onClick={onTimeBetweenSettingsClick}
              className="text-xs sm:text-sm font-medium text-muted-foreground bg-muted/50 px-2 py-1 rounded-full hover:bg-muted transition-colors"
              title="Time between settings"
            >
              ⏱️ {timeBetween}s
            </button>
          </div>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-1.5 leading-tight">{currentStretch.name}</h2>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{currentStretch.description}</p>
        </div>
        <div className="flex-shrink-0">
          <TimerDisplay
            timeRemaining={timeRemaining}
            isRunning={isRunning}
            isPaused={isPaused}
          />
        </div>
      </div>

      <ProgressBar
        progress={progress}
        timeRemaining={timeRemainingTotal}
        stepsRemaining={stepsRemaining}
      />

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

