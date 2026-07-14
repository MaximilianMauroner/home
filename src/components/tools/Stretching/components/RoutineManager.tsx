import { useState } from "react";
import type {
  Stretch,
  StretchRoutine,
} from "@/components/tools/Stretching/types";
import { formatTime } from "@/components/tools/Stretching/utils";
import { RoutineForm } from "./RoutineForm";

interface RoutineManagerProps {
  defaultRoutines: StretchRoutine[];
  customRoutines: StretchRoutine[];
  selectedRoutineId: string;
  currentStretches: Stretch[];
  onSelectRoutine: (id: string) => void;
  onLoadRoutineStretches: (routine: StretchRoutine) => void;
  onSaveRoutine: (routine: StretchRoutine) => void;
  onUpdateRoutine: (id: string, routine: Omit<StretchRoutine, "id">) => void;
  onDeleteRoutine: (id: string) => void;
  onClose: () => void;
}

export function RoutineManager({
  defaultRoutines,
  customRoutines,
  selectedRoutineId,
  currentStretches,
  onSelectRoutine,
  onLoadRoutineStretches,
  onSaveRoutine,
  onUpdateRoutine,
  onDeleteRoutine,
  onClose,
}: RoutineManagerProps) {
  const [mode, setMode] = useState<"list" | "create" | "edit">("list");
  const [editingRoutine, setEditingRoutine] = useState<StretchRoutine | null>(
    null,
  );

  const handleCreate = () => {
    setMode("create");
    setEditingRoutine(null);
  };

  const handleEdit = (routine: StretchRoutine) => {
    // Only allow editing custom routines
    if (!customRoutines.some((r) => r.id === routine.id)) {
      return;
    }
    setEditingRoutine(routine);
    // Load the routine's stretches for editing
    onLoadRoutineStretches(routine);
    setMode("edit");
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this routine?")) {
      onDeleteRoutine(id);
      if (selectedRoutineId === id) {
        // Switch to first default routine if deleting current
        onSelectRoutine(defaultRoutines[0]?.id || "routine_0");
      }
    }
  };

  const handleFormSubmit = (routine: Omit<StretchRoutine, "id">) => {
    if (editingRoutine) {
      onUpdateRoutine(editingRoutine.id, routine);
    } else {
      const newRoutine: StretchRoutine = {
        ...routine,
        id: `custom_${Date.now()}`,
      };
      onSaveRoutine(newRoutine);
    }
    setMode("list");
    setEditingRoutine(null);
  };

  const handleFormCancel = () => {
    setMode("list");
    setEditingRoutine(null);
  };

  const handleClose = () => {
    // Reset to list mode before closing
    if (mode !== "list") {
      setMode("list");
      setEditingRoutine(null);
    }
    onClose();
  };

  if (mode === "create" || mode === "edit") {
    return (
      <div className="rounded-lg border border-border/50 bg-card p-4 shadow-sm sm:p-6">
        <RoutineForm
          routine={editingRoutine}
          stretches={currentStretches}
          onSubmit={handleFormSubmit}
          onCancel={handleFormCancel}
        />
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/50 bg-card p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-bold sm:text-xl">Manage Routines</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCreate}
            className="rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20 sm:text-sm"
          >
            + Create New
          </button>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close routine manager"
            className="p-1 text-muted-foreground transition-colors hover:text-foreground"
            title="Close"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Default Routines
          </h4>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
            {defaultRoutines.map((routine) => (
              <button
                type="button"
                key={routine.id}
                aria-pressed={selectedRoutineId === routine.id}
                className={`rounded-xl border-2 p-3 text-left transition-colors sm:p-4 ${
                  selectedRoutineId === routine.id
                    ? "border-primary bg-primary/10 shadow-md"
                    : "cursor-pointer border-border/50 bg-card/50 hover:border-primary/50 hover:bg-card"
                }`}
                onClick={() => onSelectRoutine(routine.id)}
              >
                <div className="mb-1 text-sm font-semibold sm:text-base">
                  {routine.name}
                </div>
                <div className="mb-2 text-xs text-muted-foreground">
                  {routine.goal}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>⏱️ {formatTime(routine.totalDuration)}</span>
                  <span>•</span>
                  <span>{routine.stretches.length} stretches</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Custom Routines
          </h4>
          {customRoutines.length === 0 ? (
            <div className="rounded-xl bg-muted/30 py-8 text-center text-muted-foreground">
              <div className="mb-2 text-3xl">📝</div>
              <p className="text-sm">
                No custom routines yet. Create one to get started!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
              {customRoutines.map((routine) => (
                <div
                  key={routine.id}
                  className={`group relative rounded-xl border-2 p-3 text-left transition-colors sm:p-4 ${
                    selectedRoutineId === routine.id
                      ? "border-primary bg-primary/10 shadow-md"
                      : "border-border/50 bg-card/50 hover:border-primary/50 hover:bg-card"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelectRoutine(routine.id)}
                    aria-pressed={selectedRoutineId === routine.id}
                    className="w-full cursor-pointer text-left"
                  >
                    <div className="mb-1 flex items-start justify-between">
                      <div className="pr-8 text-sm font-semibold sm:text-base">
                        {routine.name}
                      </div>
                      <span className="rounded bg-muted/50 px-1.5 py-0.5 text-xs text-muted-foreground">
                        Custom
                      </span>
                    </div>
                    <div className="mb-2 text-xs text-muted-foreground">
                      {routine.goal}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>⏱️ {formatTime(routine.totalDuration)}</span>
                      <span>•</span>
                      <span>{routine.stretches.length} stretches</span>
                    </div>
                  </button>
                  <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                    <button
                      type="button"
                      aria-label={`Edit ${routine.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(routine);
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
                        handleDelete(routine.id);
                      }}
                      className="rounded-lg bg-destructive/10 p-1.5 text-destructive transition-colors hover:bg-destructive/20"
                      title="Delete routine"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
