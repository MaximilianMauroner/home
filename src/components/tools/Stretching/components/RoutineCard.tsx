import type { StretchRoutine } from "@/components/tools/Stretching/types";
import { formatTime } from "@/components/tools/Stretching/utils";
import { getRoutineRepresentativeImage } from "../routineDiscovery";
import { DifficultyBadge } from "./DifficultyBadge";
import { StretchImage } from "./StretchImage";

interface RoutineCardProps {
  isCustom?: boolean;
  isSelected?: boolean;
  onDelete?: () => void;
  onEdit?: () => void;
  onSelect: () => void;
  routine: StretchRoutine;
}

export function RoutineCard({
  routine,
  isSelected = false,
  isCustom = false,
  onSelect,
  onEdit,
  onDelete,
}: RoutineCardProps) {
  return (
    <article
      className={`group relative min-w-0 overflow-hidden rounded-2xl border bg-card transition-colors ${
        isSelected
          ? "border-primary ring-2 ring-primary"
          : "border-border hover:border-primary/50"
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={isSelected}
        className="block h-full w-full min-w-0 text-left"
      >
        <div className="stretching-image-surface aspect-[4/3] rounded-none">
          <StretchImage
            src={getRoutineRepresentativeImage(routine)}
            alt=""
            className="h-full w-full object-contain object-center transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transform-none"
            sizes="(min-width: 1024px) 30vw, (min-width: 640px) 50vw, 100vw"
          />
        </div>

        <div className="space-y-3 p-4">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="line-clamp-2 font-semibold text-foreground">
                {routine.name}
              </h3>
              <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                {routine.goal}
              </p>
            </div>
            {isCustom && (
              <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                Custom
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
            <span>{formatTime(routine.totalDuration)}</span>
            <span aria-hidden="true">·</span>
            <span>{routine.stretches.length} stretches</span>
            {routine.difficulty && (
              <span className="ml-auto">
                <DifficultyBadge difficulty={routine.difficulty} />
              </span>
            )}
          </div>
        </div>
      </button>

      {isCustom && onEdit && onDelete && (
        <div className="absolute right-2 top-2 flex gap-1 rounded-xl bg-card/90 p-1 opacity-100 shadow-sm backdrop-blur sm:opacity-0 sm:transition-opacity sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
          <button
            type="button"
            aria-label={`Edit ${routine.name}`}
            onClick={onEdit}
            className="grid h-11 w-11 place-items-center rounded-lg text-foreground hover:bg-muted"
            title="Edit routine"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          <button
            type="button"
            aria-label={`Delete ${routine.name}`}
            onClick={onDelete}
            className="grid h-11 w-11 place-items-center rounded-lg text-red-600 hover:bg-red-500/10 dark:text-red-400"
            title="Delete routine"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      )}
    </article>
  );
}
