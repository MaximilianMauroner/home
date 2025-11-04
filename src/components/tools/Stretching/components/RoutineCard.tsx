import type { StretchRoutine } from "../types";
import { formatTime } from "../utils";

interface RoutineCardProps {
  routine: StretchRoutine;
  isSelected: boolean;
  isCustom: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function RoutineCard({ routine, isSelected, isCustom, onSelect, onEdit, onDelete }: RoutineCardProps) {
  return (
    <div
      className={`p-3 sm:p-4 rounded-xl border-2 text-left transition-all relative group ${
        isSelected
          ? "border-primary bg-primary/10 shadow-md"
          : "border-border/50 bg-card/50 hover:border-primary/50 hover:bg-card"
      }`}
    >
      <button
        onClick={onSelect}
        className="w-full text-left"
      >
        <div className="flex items-start justify-between mb-1">
          <div className="font-semibold text-sm sm:text-base pr-8">{routine.name}</div>
          {isCustom && (
            <span className="text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
              Custom
            </span>
          )}
        </div>
        <div className="text-xs text-muted-foreground mb-2">{routine.goal}</div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>⏱️ {formatTime(routine.totalDuration)}</span>
          <span>•</span>
          <span>{routine.stretches.length} stretches</span>
        </div>
      </button>
      {isCustom && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="p-1.5 bg-secondary/80 text-secondary-foreground rounded-lg hover:bg-secondary transition-colors"
            title="Edit routine"
          >
            ✏️
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1.5 bg-destructive/10 text-destructive rounded-lg hover:bg-destructive/20 transition-colors"
            title="Delete routine"
          >
            🗑️
          </button>
        </div>
      )}
    </div>
  );
}

