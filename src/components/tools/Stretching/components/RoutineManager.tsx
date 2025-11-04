import { useState } from "react";
import type { Stretch, StretchRoutine } from "../types";
import { formatTime } from "../utils";
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
  const [editingRoutine, setEditingRoutine] = useState<StretchRoutine | null>(null);

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
      <div className="bg-card rounded-2xl p-4 sm:p-6 shadow-lg border border-border/50">
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
    <div className="bg-card rounded-2xl p-4 sm:p-6 shadow-lg border border-border/50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg sm:text-xl font-bold">Manage Routines</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCreate}
            className="text-xs sm:text-sm px-3 py-1.5 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors font-medium"
          >
            + Create New
          </button>
          <button
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
            title="Close"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Default Routines
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
            {defaultRoutines.map((routine) => (
              <div
                key={routine.id}
                className={`p-3 sm:p-4 rounded-xl border-2 text-left transition-all ${
                  selectedRoutineId === routine.id
                    ? "border-primary bg-primary/10 shadow-md"
                    : "border-border/50 bg-card/50 hover:border-primary/50 hover:bg-card cursor-pointer"
                }`}
                onClick={() => onSelectRoutine(routine.id)}
              >
                <div className="font-semibold text-sm sm:text-base mb-1">{routine.name}</div>
                <div className="text-xs text-muted-foreground mb-2">{routine.goal}</div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>⏱️ {formatTime(routine.totalDuration)}</span>
                  <span>•</span>
                  <span>{routine.stretches.length} stretches</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Custom Routines
          </h4>
          {customRoutines.length === 0 ? (
            <div className="text-center text-muted-foreground py-8 bg-muted/30 rounded-xl">
              <div className="text-3xl mb-2">📝</div>
              <p className="text-sm">No custom routines yet. Create one to get started!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
              {customRoutines.map((routine) => (
                <div
                  key={routine.id}
                  className={`p-3 sm:p-4 rounded-xl border-2 text-left transition-all relative group ${
                    selectedRoutineId === routine.id
                      ? "border-primary bg-primary/10 shadow-md"
                      : "border-border/50 bg-card/50 hover:border-primary/50 hover:bg-card"
                  }`}
                >
                  <div
                    onClick={() => onSelectRoutine(routine.id)}
                    className="cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-1">
                      <div className="font-semibold text-sm sm:text-base pr-8">{routine.name}</div>
                      <span className="text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                        Custom
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mb-2">{routine.goal}</div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>⏱️ {formatTime(routine.totalDuration)}</span>
                      <span>•</span>
                      <span>{routine.stretches.length} stretches</span>
                    </div>
                  </div>
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(routine);
                      }}
                      className="p-1.5 bg-secondary/80 text-secondary-foreground rounded-lg hover:bg-secondary transition-colors"
                      title="Edit routine"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(routine.id);
                      }}
                      className="p-1.5 bg-destructive/10 text-destructive rounded-lg hover:bg-destructive/20 transition-colors"
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

