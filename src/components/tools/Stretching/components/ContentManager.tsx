import { useState } from "react";
import type {
  Stretch,
  StretchRoutine,
} from "@/components/tools/Stretching/types";
import { formatTime } from "@/components/tools/Stretching/utils";
import {
  createRoutineWorkingStretches,
  getMoveTarget,
  initializeRoutineStudioDraft,
  reorderItems,
  summarizeRoutine,
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
  currentStretches: readonly Stretch[];
  onStartRoutine?: (id: string, workingStretches: readonly Stretch[]) => void;
  onSaveRoutine: (routine: StretchRoutine) => void;
  onUpdateRoutine: (id: string, routine: Omit<StretchRoutine, "id">) => void;
  onDeleteRoutine: (id: string) => void;
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
  onStartRoutine,
  onSaveRoutine,
  onUpdateRoutine,
  onDeleteRoutine,
  onClose,
  initialRoutineIntent = { mode: "manage" },
}: ContentManagerProps) {
  const initialState = initializeRoutineStudioDraft(
    initialRoutineIntent,
    selectedRoutineId,
    currentStretches,
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
  const [draftStretches, setDraftStretches] = useState(initialState.stretches);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const routines = [...defaultRoutines, ...customRoutines];
  const managedRoutine =
    routines.find((routine) => routine.id === managedRoutineId) ??
    routines[0] ??
    null;
  const editingStretch = editingStretchId
    ? (draftStretches.find((stretch) => stretch.id === editingStretchId) ??
      null)
    : null;
  const draftSummary = summarizeRoutine(draftStretches);

  const chooseRoutine = (routine: StretchRoutine) => {
    setManagedRoutineId(routine.id);
    setDraftStretches(createRoutineWorkingStretches(routine));
  };

  const beginRoutineEdit = (routine: StretchRoutine) => {
    if (!customRoutines.some((item) => item.id === routine.id)) return;
    chooseRoutine(routine);
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
      if (fallback) setDraftStretches(createRoutineWorkingStretches(fallback));
    }
  };

  const submitRoutine = (routine: Omit<StretchRoutine, "id">) => {
    if (editingRoutine) {
      onUpdateRoutine(editingRoutine.id, routine);
    } else {
      const id = `custom_${Date.now()}`;
      onSaveRoutine({ ...routine, id });
      setManagedRoutineId(id);
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
    const target = getMoveTarget(index, direction, draftStretches.length);
    if (target !== null) {
      setDraftStretches((current) => reorderItems(current, index, target));
    }
  };

  if (activeTab === "stretches" && stretchMode !== "list") {
    return (
      <div className="min-w-0 rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-6">
        <StretchForm
          stretch={editingStretch}
          onSubmit={(stretch) => {
            if (editingStretchId) {
              setDraftStretches((current) =>
                current.map((item) =>
                  item.id === editingStretchId
                    ? { ...stretch, id: item.id }
                    : item,
                ),
              );
            } else {
              setDraftStretches((current) => [
                ...current,
                { ...stretch, id: `draft_${Date.now()}` },
              ]);
            }
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
            {tab === "stretches" ? draftStretches.length : routines.length})
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
          {draftStretches.length === 0 ? (
            <div className="rounded-2xl bg-muted/40 p-8 text-center">
              <p className="text-sm text-muted-foreground">
                This routine has no stretches yet.
              </p>
            </div>
          ) : (
            <ol className="space-y-3">
              {draftStretches.map((stretch, index) => (
                <li
                  key={stretch.id}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (draggedIndex !== null && draggedIndex !== index)
                      setDraftStretches((current) =>
                        reorderItems(current, draggedIndex, index),
                      );
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
                    <div className="aspect-[4/3] w-16 shrink-0 overflow-hidden rounded-xl bg-muted sm:w-20">
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
                              setDraftStretches((current) =>
                                current.filter(
                                  (item) => item.id !== stretch.id,
                                ),
                              );
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
                      disabled={index === draftStretches.length - 1}
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
                  managedRoutine &&
                  window.confirm(
                    "Reset to saved stretches? This replaces your unsaved Studio draft.",
                  )
                ) {
                  setDraftStretches(
                    createRoutineWorkingStretches(managedRoutine),
                  );
                }
              }}
              className="min-h-11 w-full rounded-xl bg-secondary px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Reset to saved stretches
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
                stretches={draftStretches}
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
                      {formatTime(draftSummary.totalDuration)}
                    </dd>
                  </div>
                  <div className="rounded-xl bg-muted/40 p-3">
                    <dt className="text-xs text-muted-foreground">Stretches</dt>
                    <dd className="mt-1 font-semibold">
                      {draftSummary.stretchCount}
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
                        onStartRoutine(managedRoutine.id, draftStretches)
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
