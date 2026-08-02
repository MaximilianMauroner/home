import type { Stretch } from "@/components/tools/Stretching/types";
import { PLACEHOLDER_IMAGE } from "../images";
import { BreathingTimer } from "./BreathingTimer";
import { StretchImage } from "./StretchImage";

interface RestPeriodScreenProps {
  timeRemaining: number;
  isRunning: boolean;
  isPaused: boolean;
  nextStretchIndex: number | null;
  nextRepetition: number | null;
  stretches: Stretch[];
  totalDuration: number;
  onPause: () => void;
  onResume: () => void;
  onSkip: () => void;
}

export function RestPeriodScreen({
  timeRemaining,
  isRunning,
  isPaused,
  nextStretchIndex,
  nextRepetition,
  stretches,
  totalDuration,
  onPause,
  onResume,
  onSkip,
}: RestPeriodScreenProps) {
  const nextStretch =
    nextStretchIndex !== null ? stretches[nextStretchIndex] : null;

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(22rem,0.95fr)] lg:items-stretch">
      {nextStretch && (
        <div className="stretching-image-surface relative aspect-[4/3] shadow-sm">
          <StretchImage
            src={nextStretch.image || PLACEHOLDER_IMAGE}
            alt={`Next: ${nextStretch.name}`}
            className="h-full w-full object-contain object-center"
            fetchPriority="high"
            loading="eager"
            sizes="(min-width: 1024px) 40vw, calc(100vw - 2rem)"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 text-white">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/75">
              Up next
            </p>
            <p className="mt-1 text-lg font-semibold sm:text-2xl">
              {nextStretch.name}
            </p>
            {nextRepetition !== null && (nextStretch.repetitions || 1) > 1 && (
              <p className="mt-1 text-sm text-white/80">
                Repetition {nextRepetition} of {nextStretch.repetitions || 1}
              </p>
            )}
          </div>
        </div>
      )}
      <div className="flex flex-col justify-center space-y-4 rounded-2xl border border-border bg-card p-5 text-center shadow-sm sm:p-8">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-teal-500/10 px-3 py-1 text-sm font-semibold text-teal-600 dark:bg-teal-400/10 dark:text-teal-400">
            <span className="h-2 w-2 rounded-full bg-teal-500 motion-safe:animate-pulse dark:bg-teal-400" />
            Rest
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Take a breath
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Settle your breathing and prepare for the next position.
          </p>
        </div>
        <div className="flex justify-center">
          <BreathingTimer
            timeRemaining={timeRemaining}
            totalDuration={totalDuration}
            isRunning={isRunning}
            isPaused={isPaused}
            isResting
            compact
          />
        </div>
        {nextStretch && (
          <p className="text-sm text-muted-foreground">
            {nextStretch.description}
          </p>
        )}
        <div className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-2 gap-2 border-t border-border bg-card/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
          <button
            type="button"
            onClick={onSkip}
            className="min-h-[52px] rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            Skip rest
          </button>
          <button
            type="button"
            onClick={isPaused ? onResume : onPause}
            className="min-h-[52px] rounded-xl bg-muted px-4 py-3 font-medium text-foreground transition-colors hover:bg-primary/10"
          >
            {isPaused ? "Resume" : "Pause"}
          </button>
        </div>
      </div>
    </section>
  );
}
