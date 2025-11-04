import { formatTime } from "../utils";

interface TimerDisplayProps {
  timeRemaining: number;
  isRunning: boolean;
  isPaused: boolean;
  variant?: "primary" | "blue";
}

export function TimerDisplay({ timeRemaining, isRunning, isPaused, variant = "primary" }: TimerDisplayProps) {
  if (variant === "blue") {
    return (
      <div className="bg-gradient-to-br from-blue-500/30 to-blue-500/20 rounded-2xl p-4 sm:p-5 border-2 border-blue-500/30">
        <div className="text-4xl sm:text-5xl md:text-6xl font-mono font-bold text-blue-600 mb-1 tabular-nums">
          {formatTime(timeRemaining)}
        </div>
        {isRunning && !isPaused && (
          <div className="flex items-center justify-center gap-1.5 mt-2">
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
            <span className="text-xs font-medium text-blue-600">Resting</span>
          </div>
        )}
      </div>
    );
  }
  
  return (
    <div className="bg-gradient-to-br from-primary/20 to-primary/10 rounded-2xl p-4 sm:p-5 border-2 border-primary/20">
      <div className="text-4xl sm:text-5xl md:text-6xl font-mono font-bold text-primary mb-1 tabular-nums">
        {formatTime(timeRemaining)}
      </div>
      {isRunning && !isPaused && (
        <div className="flex items-center justify-center gap-1.5 mt-2">
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
          <span className="text-xs font-medium text-primary">Active</span>
        </div>
      )}
    </div>
  );
}

