import type { StretchRoutine } from "@/components/tools/Stretching/types";
import { formatTime } from "@/components/tools/Stretching/utils";
import { DifficultyBadge } from "./DifficultyBadge";
import { PLACEHOLDER_IMAGE } from "../images";

interface StretchPreviewProps {
  routine: StretchRoutine;
  onBegin: () => void;
  onBack: () => void;
}

export function StretchPreview({ routine, onBegin, onBack }: StretchPreviewProps) {
  // Calculate total steps (stretches * repetitions)
  const totalSteps = routine.stretches.reduce((acc, s) => acc + (s.repetitions || 1), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 rounded-full hover:bg-foreground/10 transition-colors"
        >
          <svg className="w-6 h-6 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <h2 className="text-xl sm:text-2xl font-serif text-foreground">{routine.name}</h2>
          <p className="text-sm text-muted-foreground">{routine.goal}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10">
          <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm font-medium text-primary">{formatTime(routine.totalDuration)}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 dark:bg-emerald-400/10">
          <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{routine.stretches.length} stretches</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted">
          <span className="text-sm font-medium text-muted-foreground">{totalSteps} steps</span>
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
            className="bg-card rounded-2xl border border-border overflow-hidden hover:shadow-md transition-shadow"
          >
            <div className="flex gap-4 p-4">
              {/* Thumbnail */}
              <div className="flex-shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-muted">
                <img
                  src={stretch.image || PLACEHOLDER_IMAGE}
                  alt={stretch.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE;
                  }}
                />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                        {index + 1}
                      </span>
                      <h3 className="font-semibold text-foreground line-clamp-1">{stretch.name}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{stretch.description}</p>
                  </div>
                </div>

                {/* Duration and reps */}
                <div className="flex items-center gap-3 mt-2 text-xs">
                  <span className="text-muted-foreground">
                    {formatTime(stretch.duration)}
                    {(stretch.repetitions || 1) > 1 && ` x ${stretch.repetitions}`}
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
        onClick={onBegin}
        className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-semibold text-lg shadow-sm hover:bg-primary/90 transition-all active:scale-[0.98]"
      >
        Begin Routine
      </button>
    </div>
  );
}
