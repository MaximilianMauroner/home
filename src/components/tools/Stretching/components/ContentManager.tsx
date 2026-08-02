import { useState } from "react";
import type {
  Stretch,
  StretchRoutine,
} from "@/components/tools/Stretching/types";
import { formatTime } from "@/components/tools/Stretching/utils";
import {
  getMoveTarget,
  resolveRoutineStudioIntent,
  type RoutineStudioIntent,
} from "@/components/tools/Stretching/studioHelpers";
import { PLACEHOLDER_IMAGE } from "../images";
import { StretchForm } from "./StretchForm";
import { RoutineForm } from "./RoutineForm";
import { StretchImage } from "./StretchImage";

export interface ContentManagerProps {
  defaultRoutines: StretchRoutine[];
  customRoutines: StretchRoutine[];
  selectedRoutineId: string;
  currentStretches: Stretch[];
  onAddStretch: (stretch: Omit<Stretch, "id">) => void;
  onUpdateStretch: (id: string, stretch: Omit<Stretch, "id">) => void;
  onDeleteStretch: (id: string) => void;
  onMoveStretch: (fromIndex: number, toIndex: number) => void;
  onManageRoutine?: (id: string) => void;
  onStartRoutine?: (id: string, workingStretches: readonly Stretch[]) => void;
  onLoadRoutineStretches: (routine: StretchRoutine) => void;
  onSaveRoutine: (routine: StretchRoutine) => void;
  onUpdateRoutine: (id: string, routine: Omit<StretchRoutine, "id">) => void;
  onDeleteRoutine: (id: string) => void;
  onResetToDefault: (routineId: string) => void;
  onClose: () => void;
  initialRoutineIntent?: RoutineStudioIntent;
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
  onManageRoutine,
  onStartRoutine,
  onLoadRoutineStretches,
  onSaveRoutine,
  onUpdateRoutine,
  onDeleteRoutine,
  onResetToDefault,
  onClose,
  initialRoutineIntent = { mode: "manage" },
}: ContentManagerProps) {
  const initialState = resolveRoutineStudioIntent(
    initialRoutineIntent,
    selectedRoutineId,
    customRoutines,
  );
  const [activeTab, setActiveTab] = useState<Tab>(initialState.activeTab);
  const [stretchMode, setStretchMode] = useState<StretchMode>("list");
  const [routineMode, setRoutineMode] = useState<RoutineMode>(
    initialState.routineMode,
  );
  const [editingStretchId, setEditingStretchId] = useState<string | null>(null);
  const [editingRoutine, setEditingRoutine] = useState<StretchRoutine | null>(
    initialState.editingRoutine,
  );
  const [managedRoutineId, setManagedRoutineId] = useState(
    initialState.managedRoutineId,
  );
  const [hasExternalRoutineIntent, setHasExternalRoutineIntent] = useState(
    initialState.hasExternalRoutineIntent,
  );
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const routines = [...defaultRoutines, ...customRoutines];
  const managedRoutine =
    routines.find((routine) => routine.id === managedRoutineId) ??
    routines[0] ??
    null;
  const editingStretch = editingStretchId
    ? (currentStretches.find((stretch) => stretch.id === editingStretchId) ??
      null)
    : null;

  const chooseRoutine = (routine: StretchRoutine) => {
    setManagedRoutineId(routine.id);
    onManageRoutine?.(routine.id);
  };

  const beginRoutineEdit = (routine: StretchRoutine) => {
    if (!customRoutines.some((item) => item.id === routine.id)) return;
    chooseRoutine(routine);
    onLoadRoutineStretches(routine);
    setEditingRoutine(routine);
    setRoutineMode("edit");
    setHasExternalRoutineIntent(false);
  };

  const deleteRoutine = (routine: StretchRoutine) => {
    if (!window.confirm(`Delete “${routine.name}”? This cannot be undone.`))
      return;
    onDeleteRoutine(routine.id);
    if (managedRoutineId === routine.id) {
      const fallback = defaultRoutines[0] ?? null;
      setManagedRoutineId(fallback?.id ?? "");
      if (fallback) onManageRoutine?.(fallback.id);
    }
  };

  const submitRoutine = (routine: Omit<StretchRoutine, "id">) => {
    if (editingRoutine) {
      onUpdateRoutine(editingRoutine.id, routine);
    } else {
      onSaveRoutine({ ...routine, id: `custom_${Date.now()}` });
    }
    setEditingRoutine(null);
    setRoutineMode("list");
    setHasExternalRoutineIntent(false);
  };

  const cancelRoutineForm = () => {
    if (hasExternalRoutineIntent) {
      onClose();
      return;
    }
    setRoutineMode("list");
    setEditingRoutine(null);
  };

  const moveStretch = (index: number, direction: "up" | "down") => {
    const target = getMoveTarget(index, direction, currentStretches.length);
    if (target !== null) onMoveStretch(index, target);
  };

  if (activeTab === "stretches" && stretchMode !== "list") {
    return (
      <div className="min-w-0 rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-6">
        <StretchForm
          stretch={editingStretch}
          onSubmit={(stretch) => {
            if (editingStretchId) onUpdateStretch(editingStretchId, stretch);
            else onAddStretch(stretch);
            setStretchMode("list");
            setEditingStretchId(null);
          }}
          onCancel={() => {
            setStretchMode("list");
            setEditingStretchId(null);
          }}
        />
      </div>
    );
  }

  return (
    <section
      className="min-w-0 overflow-x-hidden rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-6"
      aria-labelledby="routine-studio-title"
    >
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            Manage your practice
          </p>
          <h2
            id="routine-studio-title"
            className="text-xl font-semibold sm:text-2xl"
          >
            Routine Studio
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Routine Studio"
          className="min-h-11 min-w-11 rounded-full text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          ✕
        </button>
      </header>

      <div
        className="mb-6 flex border-b border-border/60"
        role="tablist"
        aria-label="Routine Studio sections"
      >
        {(["stretches", "routines"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            className={`min-h-11 flex-1 px-3 text-sm font-medium capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:flex-none sm:px-5 ${activeTab === tab ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}
          >
            {tab} (
            {tab === "stretches" ? currentStretches.length : routines.length})
          </button>
        ))}
      </div>

      {activeTab === "stretches" && (
        <div className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Arrange the current routine. Reordering never depends on drag
              alone.
            </p>
            <button
              type="button"
              onClick={() => {
                setEditingStretchId(null);
                setStretchMode("create");
              }}
              className="min-h-11 rounded-xl bg-primary/10 px-4 text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Add stretch
            </button>
          </div>
          {currentStretches.length === 0 ? (
            <div className="rounded-2xl bg-muted/40 p-8 text-center">
              <p className="text-sm text-muted-foreground">
                This routine has no stretches yet.
              </p>
            </div>
          ) : (
            <ol className="space-y-3">
              {currentStretches.map((stretch, index) => (
                <li
                  key={stretch.id}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (draggedIndex !== null && draggedIndex !== index)
                      onMoveStretch(draggedIndex, index);
                    setDraggedIndex(null);
                  }}
                  className={`min-w-0 rounded-2xl border border-border/60 p-3 transition-opacity sm:p-4 ${draggedIndex === index ? "opacity-50" : ""}`}
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <button
                      type="button"
                      draggable
                      onDragStart={() => setDraggedIndex(index)}
                      onDragEnd={() => setDraggedIndex(null)}
                      aria-label={`Drag ${stretch.name} to reorder`}
                      title="Drag to reorder"
                      className="min-h-11 min-w-11 cursor-grab touch-none rounded-xl text-lg text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:cursor-grabbing"
                    >
                      ⠿
                    </button>
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-muted sm:h-20 sm:w-20">
                      <StretchImage
                        src={stretch.image || PLACEHOLDER_IMAGE}
                        alt=""
                        className="h-full w-full object-contain object-center"
                        sizes="80px"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="shrink-0 text-xs font-semibold text-primary">
                          {index + 1}
                        </span>
                        <h3 className="truncate text-sm font-semibold sm:text-base">
                          {stretch.name}
                        </h3>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                        {stretch.description}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {formatTime(stretch.duration)}
                        {stretch.repetitions > 1
                          ? ` · ${stretch.repetitions} rounds`
                          : ""}
                      </p>
                    </div>
                    <details className="relative shrink-0">
                      <summary
                        aria-label={`Actions for ${stretch.name}`}
                        className="flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center rounded-xl text-xl text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        •••
                      </summary>
                      <div className="absolute right-0 top-12 z-10 w-36 overflow-hidden rounded-xl border border-border bg-card p-1 shadow-lg">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingStretchId(stretch.id);
                            setStretchMode("edit");
                          }}
                          className="min-h-11 w-full rounded-lg px-3 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Delete “${stretch.name}”?`))
                              onDeleteStretch(stretch.id);
                          }}
                          className="min-h-11 w-full rounded-lg px-3 text-left text-sm text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          Delete
                        </button>
                      </div>
                    </details>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 pl-0 sm:ml-14 sm:flex">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => moveStretch(index, "up")}
                      aria-label={`Move ${stretch.name} up`}
                      className="min-h-11 rounded-xl bg-secondary px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40"
                    >
                      ↑ Move up
                    </button>
                    <button
                      type="button"
                      disabled={index === currentStretches.length - 1}
                      onClick={() => moveStretch(index, "down")}
                      aria-label={`Move ${stretch.name} down`}
                      className="min-h-11 rounded-xl bg-secondary px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40"
                    >
                      ↓ Move down
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          )}
          <div className="border-t border-border/60 pt-5">
            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    "Reset to default stretches? This replaces all current stretches.",
                  )
                )
                  onResetToDefault(selectedRoutineId);
              }}
              className="min-h-11 w-full rounded-xl bg-secondary px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Reset to default stretches
            </button>
          </div>
        </div>
      )}

      {activeTab === "routines" && (
        <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(15rem,0.8fr)_minmax(0,1.2fr)]">
          <div className="min-w-0 space-y-4">
            <button
              type="button"
              onClick={() => {
                setEditingRoutine(null);
                setRoutineMode("create");
                setHasExternalRoutineIntent(false);
              }}
              className="min-h-11 w-full rounded-xl bg-primary/10 px-4 text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Create routine from current stretches
            </button>
            <div className="space-y-2" role="list" aria-label="Routines">
              {routines.map((routine) => {
                const isCustom = customRoutines.some(
                  (item) => item.id === routine.id,
                );
                return (
                  <button
                    key={routine.id}
                    type="button"
                    role="listitem"
                    aria-current={
                      managedRoutineId === routine.id ? "true" : undefined
                    }
                    onClick={() => {
                      chooseRoutine(routine);
                      setRoutineMode("list");
                    }}
                    className={`min-h-11 w-full min-w-0 rounded-xl border p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${managedRoutineId === routine.id ? "border-primary bg-primary/10" : "border-border/60 hover:bg-muted/50"}`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold">
                        {routine.name}
                      </span>
                      {isCustom && (
                        <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                          Custom
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {formatTime(routine.totalDuration)} ·{" "}
                      {routine.stretches.length} stretches
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div
            className={`${routineMode !== "list" ? "fixed inset-0 z-40 overflow-y-auto bg-card p-4 sm:p-6 lg:static lg:z-auto lg:overflow-visible lg:bg-transparent lg:p-0" : ""} min-w-0`}
          >
            {routineMode !== "list" ? (
              <RoutineForm
                routine={editingRoutine}
                stretches={currentStretches}
                onSubmit={submitRoutine}
                onCancel={cancelRoutineForm}
              />
            ) : managedRoutine ? (
              <article className="rounded-2xl border border-border/60 p-5 sm:p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                  Selected for management
                </p>
                <h3 className="mt-2 text-xl font-semibold">
                  {managedRoutine.name}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {managedRoutine.goal}
                </p>
                <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-muted/40 p-3">
                    <dt className="text-xs text-muted-foreground">Duration</dt>
                    <dd className="mt-1 font-semibold">
                      {formatTime(managedRoutine.totalDuration)}
                    </dd>
                  </div>
                  <div className="rounded-xl bg-muted/40 p-3">
                    <dt className="text-xs text-muted-foreground">Stretches</dt>
                    <dd className="mt-1 font-semibold">
                      {managedRoutine.stretches.length}
                    </dd>
                  </div>
                </dl>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  {customRoutines.some(
                    (item) => item.id === managedRoutine.id,
                  ) && (
                    <>
                      <button
                        type="button"
                        onClick={() => beginRoutineEdit(managedRoutine)}
                        className="min-h-11 flex-1 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        Edit routine
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteRoutine(managedRoutine)}
                        className="min-h-11 rounded-xl bg-destructive/10 px-4 text-sm font-medium text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        Delete
                      </button>
                    </>
                  )}
                  {onStartRoutine && (
                    <button
                      type="button"
                      onClick={() =>
                        onStartRoutine(managedRoutine.id, currentStretches)
                      }
                      className="min-h-11 rounded-xl border border-primary px-4 text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      Start routine
                    </button>
                  )}
                </div>
                {!onStartRoutine && (
                  <p className="mt-5 text-xs text-muted-foreground">
                    Choosing a routine here only manages it; starting a session
                    is a separate action.
                  </p>
                )}
              </article>
            ) : (
              <p className="rounded-2xl bg-muted/40 p-8 text-center text-sm text-muted-foreground">
                No routines available.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
