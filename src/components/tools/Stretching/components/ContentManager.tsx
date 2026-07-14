import { useState } from "react";
import type {
  Stretch,
  StretchRoutine,
} from "@/components/tools/Stretching/types";
import { formatTime } from "@/components/tools/Stretching/utils";
import { StretchForm } from "./StretchForm";
import { RoutineForm } from "./RoutineForm";

interface ContentManagerProps {
  defaultRoutines: StretchRoutine[];
  customRoutines: StretchRoutine[];
  selectedRoutineId: string;
  currentStretches: Stretch[];

  // Stretch operations
  onAddStretch: (stretch: Omit<Stretch, "id">) => void;
  onUpdateStretch: (id: string, stretch: Omit<Stretch, "id">) => void;
  onDeleteStretch: (id: string) => void;
  onMoveStretch: (fromIndex: number, toIndex: number) => void;

  // Routine operations
  onSelectRoutine: (id: string) => void;
  onLoadRoutineStretches: (routine: StretchRoutine) => void;
  onSaveRoutine: (routine: StretchRoutine) => void;
  onUpdateRoutine: (id: string, routine: Omit<StretchRoutine, "id">) => void;
  onDeleteRoutine: (id: string) => void;
  onResetToDefault: (routineId: string) => void;

  onClose: () => void;
}

type Tab = "stretches" | "routines";
type StretchMode = "list" | "create" | "edit";
type RoutineMode = "list" | "create" | "edit";

export function ContentManager({
  defaultRoutines,
  customRoutines,
  selectedRoutineId,
  currentStretches,
  onAddStretch,
  onUpdateStretch,
  onDeleteStretch,
  onMoveStretch,
  onSelectRoutine,
  onLoadRoutineStretches,
  onSaveRoutine,
  onUpdateRoutine,
  onDeleteRoutine,
  onResetToDefault,
  onClose,
}: ContentManagerProps) {
  const [activeTab, setActiveTab] = useState<Tab>("stretches");
  const [stretchMode, setStretchMode] = useState<StretchMode>("list");
  const [routineMode, setRoutineMode] = useState<RoutineMode>("list");
  const [editingStretchId, setEditingStretchId] = useState<string | null>(null);
  const [editingRoutine, setEditingRoutine] = useState<StretchRoutine | null>(
    null,
  );
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Stretch handlers
  const handleCreateStretch = () => {
    setActiveTab("stretches");
    setStretchMode("create");
    setEditingStretchId(null);
  };

  const handleEditStretch = (id: string) => {
    setActiveTab("stretches");
    setStretchMode("edit");
    setEditingStretchId(id);
  };

  const handleDeleteStretch = (id: string) => {
    if (confirm("Are you sure you want to delete this stretch?")) {
      onDeleteStretch(id);
    }
  };

  const handleStretchSubmit = (stretch: Omit<Stretch, "id">) => {
    if (editingStretchId) {
      onUpdateStretch(editingStretchId, stretch);
    } else {
      onAddStretch(stretch);
    }
    setStretchMode("list");
    setEditingStretchId(null);
  };

  const handleStretchCancel = () => {
    setStretchMode("list");
    setEditingStretchId(null);
  };

  // Routine handlers
  const handleCreateRoutine = () => {
    setActiveTab("routines");
    setRoutineMode("create");
    setEditingRoutine(null);
  };

  const handleEditRoutine = (routine: StretchRoutine) => {
    if (!customRoutines.some((r) => r.id === routine.id)) {
      return;
    }
    setActiveTab("routines");
    setRoutineMode("edit");
    setEditingRoutine(routine);
    onLoadRoutineStretches(routine);
  };

  const handleDeleteRoutine = (id: string) => {
    if (confirm("Are you sure you want to delete this routine?")) {
      onDeleteRoutine(id);
      if (selectedRoutineId === id) {
        onSelectRoutine(defaultRoutines[0]?.id || "routine_0");
      }
    }
  };

  const handleRoutineSubmit = (routine: Omit<StretchRoutine, "id">) => {
    if (editingRoutine) {
      onUpdateRoutine(editingRoutine.id, routine);
    } else {
      const newRoutine: StretchRoutine = {
        ...routine,
        id: `custom_${Date.now()}`,
      };
      onSaveRoutine(newRoutine);
    }
    setRoutineMode("list");
    setEditingRoutine(null);
  };

  const handleRoutineCancel = () => {
    setRoutineMode("list");
    setEditingRoutine(null);
  };

  // Drag and drop handlers
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      return;
    }
    onMoveStretch(draggedIndex, dropIndex);
    setDraggedIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleClose = () => {
    if (stretchMode !== "list" || routineMode !== "list") {
      setStretchMode("list");
      setRoutineMode("list");
      setEditingStretchId(null);
      setEditingRoutine(null);
    }
    onClose();
  };

  const editingStretch = editingStretchId
    ? (currentStretches.find((s) => s.id === editingStretchId) ?? null)
    : null;

  // Stretch form view
  if (
    activeTab === "stretches" &&
    (stretchMode === "create" || stretchMode === "edit")
  ) {
    return (
      <div className="rounded-lg border border-border/50 bg-card p-4 shadow-sm sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold sm:text-xl">
            {editingStretch ? "Edit Stretch" : "Create New Stretch"}
          </h3>
          <button
            onClick={handleStretchCancel}
            type="button"
            aria-label="Close stretch form"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            ✕
          </button>
        </div>
        <StretchForm
          stretch={editingStretch}
          onSubmit={handleStretchSubmit}
          onCancel={handleStretchCancel}
        />
      </div>
    );
  }

  // Routine form view
  if (
    activeTab === "routines" &&
    (routineMode === "create" || routineMode === "edit")
  ) {
    return (
      <div className="rounded-lg border border-border/50 bg-card p-4 shadow-sm sm:p-6">
        <RoutineForm
          routine={editingRoutine}
          stretches={currentStretches}
          onSubmit={handleRoutineSubmit}
          onCancel={handleRoutineCancel}
        />
      </div>
    );
  }

  // Main view
  return (
    <div className="rounded-lg border border-border/50 bg-card p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-bold sm:text-xl">Content Manager</h3>
        <button
          onClick={handleClose}
          type="button"
          aria-label="Close content manager"
          className="text-muted-foreground transition-colors hover:text-foreground"
          title="Close"
        >
          ✕
        </button>
      </div>

      {/* Tabs */}
      <div
        className="mb-6 flex gap-2 border-b border-border/50"
        role="tablist"
        aria-label="Content type"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "stretches"}
          onClick={() => setActiveTab("stretches")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "stretches"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Stretches ({currentStretches.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "routines"}
          onClick={() => setActiveTab("routines")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "routines"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Routines ({defaultRoutines.length + customRoutines.length})
        </button>
      </div>

      {/* Stretches Tab */}
      {activeTab === "stretches" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Manage the stretches in your current routine
            </p>
            <button
              onClick={handleCreateStretch}
              className="rounded-lg bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
            >
              + Add Stretch
            </button>
          </div>

          {currentStretches.length === 0 ? (
            <div className="rounded-xl bg-muted/30 py-12 text-center text-muted-foreground">
              <div className="mb-2 text-4xl">🧘</div>
              <p className="mb-3 text-sm">No stretches yet.</p>
              <button
                onClick={handleCreateStretch}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Add Your First Stretch
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {currentStretches.map((stretch, index) => (
                <div
                  key={stretch.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`cursor-move rounded-xl border border-border/50 bg-card p-4 shadow-sm transition-colors hover:shadow-sm ${
                    draggedIndex === index ? "opacity-50" : ""
                  }`}
                >
                  <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 flex items-center gap-2">
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                          #{index + 1}
                        </span>
                        <div className="text-base font-semibold sm:text-lg">
                          {stretch.name}
                        </div>
                      </div>
                      <div className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {stretch.description}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-muted/50 px-2 py-1 text-xs font-medium text-muted-foreground">
                          ⏱️ {formatTime(stretch.duration)}
                        </span>
                        {(stretch.repetitions || 1) > 1 && (
                          <span className="rounded-md bg-muted/50 px-2 py-1 text-xs font-medium text-muted-foreground">
                            🔁 {stretch.repetitions || 1}x (
                            {formatTime(
                              stretch.duration * (stretch.repetitions || 1),
                            )}{" "}
                            total)
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex w-full gap-2 sm:w-auto">
                      <button
                        onClick={() => handleEditStretch(stretch.id)}
                        className="min-h-[44px] flex-1 touch-manipulation rounded-xl bg-secondary/80 px-4 py-2.5 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary active:bg-secondary/70 sm:flex-none"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => handleDeleteStretch(stretch.id)}
                        className="min-h-[44px] flex-1 touch-manipulation rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20 active:bg-destructive/30 sm:flex-none"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-border/50 pt-4">
            <button
              onClick={() => {
                if (
                  confirm(
                    "Reset to default stretches? This will replace all current stretches.",
                  )
                ) {
                  onResetToDefault(selectedRoutineId);
                }
              }}
              className="w-full rounded-xl bg-secondary/80 px-4 py-2.5 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary active:bg-secondary/70"
            >
              ↻ Reset to Default Stretches
            </button>
          </div>
        </div>
      )}

      {/* Routines Tab */}
      {activeTab === "routines" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Manage your routines. Create new ones from current stretches or
              edit existing custom routines.
            </p>
            <button
              onClick={handleCreateRoutine}
              className="rounded-lg bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
            >
              + Create Routine
            </button>
          </div>

          <div className="space-y-4">
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
                    className={`cursor-pointer rounded-xl border-2 p-3 text-left transition-colors sm:p-4 ${
                      selectedRoutineId === routine.id
                        ? "border-primary bg-primary/10 shadow-md"
                        : "border-border/50 bg-card/50 hover:border-primary/50 hover:bg-card"
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
                  <p className="mb-3 text-sm">No custom routines yet.</p>
                  <button
                    onClick={handleCreateRoutine}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    Create Your First Routine
                  </button>
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
                            handleEditRoutine(routine);
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
                            handleDeleteRoutine(routine.id);
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
      )}
    </div>
  );
}
