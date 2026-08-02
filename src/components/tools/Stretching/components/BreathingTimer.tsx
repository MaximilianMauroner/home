import { formatTime } from "@/components/tools/Stretching/utils";

interface BreathingTimerProps {
  timeRemaining: number;
  totalDuration: number;
  isRunning: boolean;
  isPaused: boolean;
  isResting?: boolean;
  compact?: boolean;
}

export function BreathingTimer({
  timeRemaining,
  totalDuration,
  isRunning,
  isPaused,
  isResting = false,
  compact = false,
}: BreathingTimerProps) {
  const progress =
    totalDuration > 0
      ? Math.min(
          100,
          Math.max(0, ((totalDuration - timeRemaining) / totalDuration) * 100),
        )
      : 0;
  const circumference = 2 * Math.PI * 88; // radius = 88
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  // Colors based on state for inline styles (glow effects)
  // Using emerald for active, teal for resting to match codebase
  const bgColor = isResting
    ? "rgba(20, 184, 166, 0.1)" // teal
    : "rgba(16, 185, 129, 0.1)"; // emerald
  const glowColor = isResting
    ? "rgba(20, 184, 166, 0.3)"
    : "rgba(16, 185, 129, 0.3)";

  return (
    <div className="relative flex items-center justify-center">
      {/* Outer glow ring */}
      <div
        className={`absolute rounded-full transition-colors duration-1000 ${compact ? "h-36 w-36" : "h-52 w-52"} ${
          isRunning && !isPaused
            ? "animate-breathe-glow motion-reduce:animate-none"
            : ""
        }`}
        style={{
          background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`,
        }}
      />

      {/* SVG Progress Ring */}
      <svg
        aria-hidden="true"
        className={`${compact ? "h-32 w-32" : "h-48 w-48"} -rotate-90 transform`}
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
          className={`transition-colors duration-300 ${isResting ? "stroke-teal-500 dark:stroke-teal-400" : "stroke-emerald-500 dark:stroke-emerald-400"}`}
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
          className={
            isResting
              ? "stroke-teal-500/30 dark:stroke-teal-400/30"
              : "stroke-emerald-500/30 dark:stroke-emerald-400/30"
          }
          strokeWidth="1"
        />
      </svg>

      {/* Center content */}
      <div
        className={`absolute flex flex-col items-center justify-center transition-transform duration-1000 ${
          isRunning && !isPaused
            ? "animate-breathe motion-reduce:animate-none"
            : ""
        }`}
      >
        {/* Timer display */}
        <div
          aria-label={`${formatTime(timeRemaining)} remaining`}
          className={`${compact ? "text-4xl" : "text-5xl sm:text-6xl"} font-light tabular-nums tracking-tight text-foreground`}
          role="timer"
        >
          {formatTime(timeRemaining)}
        </div>

        {/* Status indicator */}
        <div className="mt-2 flex items-center gap-2">
          {isRunning && !isPaused && (
            <div
              className={`h-2 w-2 animate-pulse rounded-full motion-reduce:animate-none ${
                isResting
                  ? "bg-teal-500 dark:bg-teal-400"
                  : "bg-emerald-500 dark:bg-emerald-400"
              }`}
            />
          )}
          <span
            className={`text-sm font-medium ${
              isResting
                ? "text-teal-600 dark:text-teal-400"
                : "text-emerald-600 dark:text-emerald-400"
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

        @media (prefers-reduced-motion: reduce) {
          .animate-breathe,
          .animate-breathe-glow {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
