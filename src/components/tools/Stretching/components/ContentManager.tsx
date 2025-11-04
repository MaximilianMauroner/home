import { useState } from "react";
import type { Stretch, StretchRoutine } from "../types";
import { formatTime } from "../utils";
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
  const [editingRoutine, setEditingRoutine] = useState<StretchRoutine | null>(null);
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

  const editingStretch = editingStretchId ? (currentStretches.find((s) => s.id === editingStretchId) ?? null) : null;

  // Stretch form view
  if (activeTab === "stretches" && (stretchMode === "create" || stretchMode === "edit")) {
    return (
      <div className="bg-card rounded-2xl p-4 sm:p-6 shadow-lg border border-border/50">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg sm:text-xl font-bold">
            {editingStretch ? "Edit Stretch" : "Create New Stretch"}
          </h3>
          <button
            onClick={handleStretchCancel}
            className="text-muted-foreground hover:text-foreground transition-colors"
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
  if (activeTab === "routines" && (routineMode === "create" || routineMode === "edit")) {
    return (
      <div className="bg-card rounded-2xl p-4 sm:p-6 shadow-lg border border-border/50">
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
    <div className="bg-card rounded-2xl p-4 sm:p-6 shadow-lg border border-border/50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg sm:text-xl font-bold">Content Manager</h3>
        <button
          onClick={handleClose}
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="Close"
        >
          ✕
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-border/50">
        <button
          onClick={() => setActiveTab("stretches")}
          className={`px-4 py-2 font-medium text-sm transition-colors ${
            activeTab === "stretches"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Stretches ({currentStretches.length})
        </button>
        <button
          onClick={() => setActiveTab("routines")}
          className={`px-4 py-2 font-medium text-sm transition-colors ${
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
              className="px-4 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors font-medium text-sm"
            >
              + Add Stretch
            </button>
          </div>

          {currentStretches.length === 0 ? (
            <div className="text-center text-muted-foreground py-12 bg-muted/30 rounded-xl">
              <div className="text-4xl mb-2">🧘</div>
              <p className="text-sm mb-3">No stretches yet.</p>
              <button
                onClick={handleCreateStretch}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium text-sm"
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
                  className={`bg-gradient-to-br from-card to-card/80 rounded-xl p-4 border border-border/50 shadow-sm hover:shadow-md transition-all cursor-move ${
                    draggedIndex === index ? "opacity-50" : ""
                  }`}
                >
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                          #{index + 1}
                        </span>
                        <div className="font-semibold text-base sm:text-lg">{stretch.name}</div>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1 leading-relaxed">
                        {stretch.description}
                      </div>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-1 rounded-md">
                          ⏱️ {formatTime(stretch.duration)}
                        </span>
                        {((stretch as any).repetitions || 1) > 1 && (
                          <span className="text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-1 rounded-md">
                            🔁 {(stretch as any).repetitions || 1}x ({formatTime(stretch.duration * ((stretch as any).repetitions || 1))} total)
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <button
                        onClick={() => handleEditStretch(stretch.id)}
                        className="flex-1 sm:flex-none px-4 py-2.5 min-h-[44px] bg-secondary/80 text-secondary-foreground rounded-xl text-sm hover:bg-secondary active:bg-secondary/70 transition-all touch-manipulation font-medium"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => handleDeleteStretch(stretch.id)}
                        className="flex-1 sm:flex-none px-4 py-2.5 min-h-[44px] bg-destructive/10 text-destructive rounded-xl text-sm hover:bg-destructive/20 active:bg-destructive/30 transition-all touch-manipulation font-medium border border-destructive/20"
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
                if (confirm("Reset to default stretches? This will replace all current stretches.")) {
                  onResetToDefault(selectedRoutineId);
                }
              }}
              className="w-full px-4 py-2.5 bg-secondary/80 text-secondary-foreground rounded-xl hover:bg-secondary active:bg-secondary/70 transition-all font-medium text-sm"
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
              Manage your routines. Create new ones from current stretches or edit existing custom routines.
            </p>
            <button
              onClick={handleCreateRoutine}
              className="px-4 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors font-medium text-sm"
            >
              + Create Routine
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Default Routines
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                {defaultRoutines.map((routine) => (
                  <div
                    key={routine.id}
                    className={`p-3 sm:p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
                      selectedRoutineId === routine.id
                        ? "border-primary bg-primary/10 shadow-md"
                        : "border-border/50 bg-card/50 hover:border-primary/50 hover:bg-card"
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
                  <p className="text-sm mb-3">No custom routines yet.</p>
                  <button
                    onClick={handleCreateRoutine}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium text-sm"
                  >
                    Create Your First Routine
                  </button>
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
                            handleEditRoutine(routine);
                          }}
                          className="p-1.5 bg-secondary/80 text-secondary-foreground rounded-lg hover:bg-secondary transition-colors"
                          title="Edit routine"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteRoutine(routine.id);
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
      )}
    </div>
  );
}

