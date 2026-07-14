import type { StretchRoutine } from "@/components/tools/Stretching/types";
import { formatTime } from "@/components/tools/Stretching/utils";
import { DifficultyBadge } from "./DifficultyBadge";
import { PLACEHOLDER_IMAGE } from "../images";
import { StretchImage } from "./StretchImage";

interface StretchPreviewProps {
  routine: StretchRoutine;
  onBegin: () => void;
  onBack: () => void;
}

export function StretchPreview({
  routine,
  onBegin,
  onBack,
}: StretchPreviewProps) {
  // Calculate total steps (stretches * repetitions)
  const totalSteps = routine.stretches.reduce(
    (acc, s) => acc + (s.repetitions || 1),
    0,
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to routine browser"
          className="rounded-full p-2 transition-colors hover:bg-foreground/10"
        >
          <svg
            className="h-6 w-6 text-foreground"
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
        <div className="flex-1">
          <h2 className="font-serif text-xl text-foreground sm:text-2xl">
            {routine.name}
          </h2>
          <p className="text-sm text-muted-foreground">{routine.goal}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5">
          <svg
            className="h-4 w-4 text-primary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="text-sm font-medium text-primary">
            {formatTime(routine.totalDuration)}
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1.5 dark:bg-emerald-400/10">
          <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
            {routine.stretches.length} stretches
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-muted px-3 py-1.5">
          <span className="text-sm font-medium text-muted-foreground">
            {totalSteps} steps
          </span>
        </div>
        {routine.difficulty && (
          <DifficultyBadge difficulty={routine.difficulty} size="md" />
        )}
      </div>

      {/* Stretch List */}
      <div className="space-y-4">
        {routine.stretches.map((stretch, index) => (
          <div
            key={stretch.id}
            className="overflow-hidden rounded-lg border border-border bg-card transition-shadow hover:shadow-sm"
          >
            <div className="flex gap-4 p-4">
              {/* Thumbnail */}
              <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-muted sm:h-24 sm:w-24">
                <StretchImage
                  src={stretch.image || PLACEHOLDER_IMAGE}
                  alt={stretch.name}
                  className="h-full w-full object-cover"
                  sizes="(min-width: 640px) 96px, 80px"
                />
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                        {index + 1}
                      </span>
                      <h3 className="line-clamp-1 font-semibold text-foreground">
                        {stretch.name}
                      </h3>
                    </div>
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {stretch.description}
                    </p>
                  </div>
                </div>

                {/* Duration and reps */}
                <div className="mt-2 flex items-center gap-3 text-xs">
                  <span className="text-muted-foreground">
                    {formatTime(stretch.duration)}
                    {(stretch.repetitions || 1) > 1 &&
                      ` x ${stretch.repetitions}`}
                  </span>
                  {stretch.targetAreas && stretch.targetAreas.length > 0 && (
                    <>
                      <span className="text-border">·</span>
                      <span className="text-emerald-600 dark:text-emerald-400">
                        {stretch.targetAreas.slice(0, 2).join(", ")}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Begin Button */}
      <button
        type="button"
        onClick={onBegin}
        className="w-full rounded-xl bg-primary py-4 text-lg font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
      >
        Begin Routine
      </button>
    </div>
  );
}
