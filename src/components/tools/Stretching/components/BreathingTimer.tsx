import { formatTime } from "@/components/tools/Stretching/utils";

interface BreathingTimerProps {
  timeRemaining: number;
  totalDuration: number;
  isRunning: boolean;
  isPaused: boolean;
  isResting?: boolean;
}

export function BreathingTimer({
  timeRemaining,
  totalDuration,
  isRunning,
  isPaused,
  isResting = false,
}: BreathingTimerProps) {
  const progress = totalDuration > 0 ? ((totalDuration - timeRemaining) / totalDuration) * 100 : 0;
  const circumference = 2 * Math.PI * 88; // radius = 88
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  // Colors based on state for inline styles (glow effects)
  // Using emerald for active, teal for resting to match codebase
  const bgColor = isResting
    ? "rgba(20, 184, 166, 0.1)"  // teal
    : "rgba(16, 185, 129, 0.1)"; // emerald
  const glowColor = isResting
    ? "rgba(20, 184, 166, 0.3)"
    : "rgba(16, 185, 129, 0.3)";

  return (
    <div className="relative flex items-center justify-center">
      {/* Outer glow ring */}
      <div
        className={`absolute w-52 h-52 rounded-full transition-all duration-1000 ${
          isRunning && !isPaused ? "animate-breathe-glow" : ""
        }`}
        style={{
          background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`,
        }}
      />

      {/* SVG Progress Ring */}
      <svg
        className="w-48 h-48 transform -rotate-90"
        viewBox="0 0 200 200"
      >
        {/* Background circle */}
        <circle
          cx="100"
          cy="100"
          r="88"
          fill={bgColor}
          className="stroke-border"
          strokeWidth="4"
        />

        {/* Progress arc */}
        <circle
          cx="100"
          cy="100"
          r="88"
          fill="none"
          className={`transition-all duration-300 ${isResting ? 'stroke-teal-500 dark:stroke-teal-400' : 'stroke-emerald-500 dark:stroke-emerald-400'}`}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
        />

        {/* Inner decorative circle */}
        <circle
          cx="100"
          cy="100"
          r="76"
          fill="none"
          className={isResting ? 'stroke-teal-500/30 dark:stroke-teal-400/30' : 'stroke-emerald-500/30 dark:stroke-emerald-400/30'}
          strokeWidth="1"
        />
      </svg>

      {/* Center content */}
      <div
        className={`absolute flex flex-col items-center justify-center transition-transform duration-1000 ${
          isRunning && !isPaused ? "animate-breathe" : ""
        }`}
      >
        {/* Timer display */}
        <div className="text-5xl sm:text-6xl font-light tracking-tight tabular-nums text-foreground">
          {formatTime(timeRemaining)}
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-2 mt-2">
          {isRunning && !isPaused && (
            <div
              className={`w-2 h-2 rounded-full animate-pulse ${
                isResting ? 'bg-teal-500 dark:bg-teal-400' : 'bg-emerald-500 dark:bg-emerald-400'
              }`}
            />
          )}
          <span
            className={`text-sm font-medium ${
              isResting ? 'text-teal-600 dark:text-teal-400' : 'text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {!isRunning
              ? "Ready"
              : isPaused
              ? "Paused"
              : isResting
              ? "Rest"
              : "Breathe"}
          </span>
        </div>
      </div>

      <style>{`
        @keyframes breathe {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.03);
          }
        }

        @keyframes breathe-glow {
          0%, 100% {
            opacity: 0.5;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.05);
          }
        }

        .animate-breathe {
          animation: breathe 4s ease-in-out infinite;
        }

        .animate-breathe-glow {
          animation: breathe-glow 4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
