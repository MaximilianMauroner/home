import { formatTime } from "@/components/tools/Stretching/utils";

interface ProgressBarProps {
  progress: number;
  timeRemaining: number;
  stepsRemaining: number;
}

export function ProgressBar({ progress, timeRemaining, stepsRemaining }: ProgressBarProps) {
  return (
    <div className="relative">
      <div className="w-full bg-muted/50 rounded-full h-2.5 sm:h-3 overflow-hidden">
        <div
          className="bg-gradient-to-r from-primary via-primary to-primary/80 h-full rounded-full transition-all duration-300 shadow-sm"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[10px] sm:text-xs font-medium text-muted-foreground">
          {formatTime(timeRemaining)} remaining • {stepsRemaining} {stepsRemaining === 1 ? 'step' : 'steps'} left
        </span>
      </div>
    </div>
  );
}

