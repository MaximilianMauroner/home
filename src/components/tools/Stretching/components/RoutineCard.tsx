import type { StretchRoutine } from "@/components/tools/Stretching/types";
import { formatTime } from "@/components/tools/Stretching/utils";

interface RoutineCardProps {
  routine: StretchRoutine;
  isSelected: boolean;
  isCustom: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function RoutineCard({
  routine,
  isSelected,
  isCustom,
  onSelect,
  onEdit,
  onDelete,
}: RoutineCardProps) {
  return (
    <div
      className={`group relative rounded-xl border-2 p-3 text-left transition-colors sm:p-4 ${
        isSelected
          ? "border-primary bg-primary/10 shadow-md"
          : "border-border/50 bg-card/50 hover:border-primary/50 hover:bg-card"
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={isSelected}
        className="w-full text-left"
      >
        <div className="mb-1 flex items-start justify-between">
          <div className="pr-8 text-sm font-semibold sm:text-base">
            {routine.name}
          </div>
          {isCustom && (
            <span className="rounded bg-muted/50 px-1.5 py-0.5 text-xs text-muted-foreground">
              Custom
            </span>
          )}
        </div>
        <div className="mb-2 text-xs text-muted-foreground">{routine.goal}</div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>⏱️ {formatTime(routine.totalDuration)}</span>
          <span>•</span>
          <span>{routine.stretches.length} stretches</span>
        </div>
      </button>
      {isCustom && (
        <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          <button
            type="button"
            aria-label={`Edit ${routine.name}`}
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="rounded-lg bg-secondary/80 p-1.5 text-secondary-foreground transition-colors hover:bg-secondary"
            title="Edit routine"
          >
            ✏️
          </button>
          <button
            type="button"
            aria-label={`Delete ${routine.name}`}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="rounded-lg bg-destructive/10 p-1.5 text-destructive transition-colors hover:bg-destructive/20"
            title="Delete routine"
          >
            🗑️
          </button>
        </div>
      )}
    </div>
  );
}
