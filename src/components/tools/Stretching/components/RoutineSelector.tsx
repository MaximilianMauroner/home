import type { StretchRoutine } from "../types";
import { RoutineCard } from "./RoutineCard";

interface RoutineSelectorProps {
  routines: StretchRoutine[];
  customRoutines: StretchRoutine[];
  selectedRoutineId: string;
  onSelectRoutine: (id: string) => void;
  onEditRoutine: (routine: StretchRoutine) => void;
  onDeleteRoutine: (id: string) => void;
  onCreateNew: () => void;
}

export function RoutineSelector({
  routines,
  customRoutines,
  selectedRoutineId,
  onSelectRoutine,
  onEditRoutine,
  onDeleteRoutine,
  onCreateNew,
}: RoutineSelectorProps) {
  const allRoutines = [...routines, ...customRoutines];
  
  return (
    <div className="bg-card rounded-2xl p-4 sm:p-6 shadow-lg border border-border/50">
      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Select Routine</h3>
          <button
            onClick={onCreateNew}
            className="text-xs sm:text-sm px-3 py-1.5 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors font-medium"
          >
            + Create New Routine
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
          {allRoutines.map((routine) => (
            <RoutineCard
              key={routine.id}
              routine={routine}
              isSelected={selectedRoutineId === routine.id}
              isCustom={customRoutines.some((r) => r.id === routine.id)}
              onSelect={() => onSelectRoutine(routine.id)}
              onEdit={() => onEditRoutine(routine)}
              onDelete={() => onDeleteRoutine(routine.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

