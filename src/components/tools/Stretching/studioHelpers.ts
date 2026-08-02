import type {
  Stretch,
  StretchRoutine,
} from "@/components/tools/Stretching/types";

export type MoveDirection = "up" | "down";

export type RoutineStudioIntent =
  | { mode: "manage" }
  | { mode: "create" }
  | { mode: "edit"; routineId: string };

export interface RoutineStudioInitialState {
  activeTab: "stretches" | "routines";
  editingRoutine: StretchRoutine | null;
  hasExternalRoutineIntent: boolean;
  managedRoutineId: string;
  routineMode: "list" | "create" | "edit";
}

export interface RoutineStudioDraftState extends RoutineStudioInitialState {
  stretches: Stretch[];
}

export interface StudioSessionStartState {
  currentIndex: 0;
  currentRepetition: 1;
  isCompleted: false;
  isPaused: false;
  isResting: false;
  isRunning: false;
  nextRepetition: null;
  nextStretchIndex: null;
  stretches: Stretch[];
  timeRemaining: number;
}

export interface RoutineSummary {
  stretchCount: number;
  totalDuration: number;
  totalSteps: number;
}

export function getMoveTarget(
  index: number,
  direction: MoveDirection,
  length: number,
): number | null {
  const target = direction === "up" ? index - 1 : index + 1;
  return target >= 0 && target < length ? target : null;
}

export function resolveRoutineStudioIntent(
  intent: RoutineStudioIntent,
  selectedRoutineId: string,
  customRoutines: readonly StretchRoutine[],
): RoutineStudioInitialState {
  const editingRoutine =
    intent.mode === "edit"
      ? (customRoutines.find((routine) => routine.id === intent.routineId) ??
        null)
      : null;
  const routineMode =
    intent.mode === "create" ? "create" : editingRoutine ? "edit" : "list";
  const hasExternalRoutineIntent = routineMode !== "list";

  return {
    activeTab: hasExternalRoutineIntent ? "routines" : "stretches",
    editingRoutine,
    hasExternalRoutineIntent,
    managedRoutineId: editingRoutine?.id ?? selectedRoutineId,
    routineMode,
  };
}

export function createRoutineWorkingStretches(
  routine: StretchRoutine,
): Stretch[] {
  return routine.stretches.map((stretch, index) => {
    const sourceId =
      normalizeStretchId(stretch.id, routine.id) || `${index + 1}`;
    return {
      ...stretch,
      id: `${routine.id}_${sourceId}`,
      ...(stretch.targetAreas ? { targetAreas: [...stretch.targetAreas] } : {}),
    };
  });
}

export function initializeRoutineStudioDraft(
  intent: RoutineStudioIntent,
  selectedRoutineId: string,
  liveStretches: readonly Stretch[],
  customRoutines: readonly StretchRoutine[],
): RoutineStudioDraftState {
  const initialState = resolveRoutineStudioIntent(
    intent,
    selectedRoutineId,
    customRoutines,
  );

  return {
    ...initialState,
    stretches: initialState.editingRoutine
      ? createRoutineWorkingStretches(initialState.editingRoutine)
      : createWorkingSessionStretches(liveStretches),
  };
}

export function reorderItems<T>(
  items: readonly T[],
  fromIndex: number,
  toIndex: number,
): T[] {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length ||
    fromIndex === toIndex
  ) {
    return [...items];
  }

  const reordered = [...items];
  const [moved] = reordered.splice(fromIndex, 1);
  if (moved === undefined) return reordered;
  reordered.splice(toIndex, 0, moved);
  return reordered;
}

export function createWorkingSessionStretches(
  stretches: readonly Stretch[],
): Stretch[] {
  return stretches.map((stretch) => ({
    ...stretch,
    ...(stretch.targetAreas ? { targetAreas: [...stretch.targetAreas] } : {}),
  }));
}

export function createStudioSessionStartState(
  draftStretches: readonly Stretch[],
): StudioSessionStartState {
  const stretches = createWorkingSessionStretches(draftStretches);
  return {
    stretches,
    currentIndex: 0,
    currentRepetition: 1,
    timeRemaining: stretches[0]?.duration ?? 0,
    isRunning: false,
    isPaused: false,
    isResting: false,
    isCompleted: false,
    nextStretchIndex: null,
    nextRepetition: null,
  };
}

export function summarizeRoutine(
  stretches: readonly Stretch[],
): RoutineSummary {
  return stretches.reduce<RoutineSummary>(
    (summary, stretch) => {
      const repetitions = Math.max(1, stretch.repetitions || 1);
      summary.totalDuration += stretch.duration * repetitions;
      summary.totalSteps += repetitions;
      summary.stretchCount += 1;
      return summary;
    },
    { stretchCount: 0, totalDuration: 0, totalSteps: 0 },
  );
}

export function normalizeStretchId(id: string, routineId?: string): string {
  const prefix = routineId ? `${routineId}_` : "";
  return prefix && id.startsWith(prefix) ? id.slice(prefix.length) || id : id;
}

export function buildRoutineDraft(
  routine: StretchRoutine | null,
  values: Pick<StretchRoutine, "name" | "goal">,
  stretches: readonly Stretch[],
): Omit<StretchRoutine, "id"> {
  const summary = summarizeRoutine(stretches);
  const metadata = routine
    ? {
        ...(routine.category ? { category: routine.category } : {}),
        ...(routine.difficulty ? { difficulty: routine.difficulty } : {}),
        ...(routine.tags ? { tags: [...routine.tags] } : {}),
      }
    : {};

  return {
    ...metadata,
    name: values.name.trim(),
    goal: values.goal.trim(),
    totalDuration: summary.totalDuration,
    stretches: stretches.map((stretch) => ({
      ...stretch,
      id: normalizeStretchId(stretch.id, routine?.id),
      ...(stretch.targetAreas ? { targetAreas: [...stretch.targetAreas] } : {}),
    })),
  };
}

export function createRoutine(
  routines: readonly StretchRoutine[],
  routine: StretchRoutine,
): StretchRoutine[] {
  return [...routines.filter((item) => item.id !== routine.id), routine];
}

export function updateRoutineCollection(
  routines: readonly StretchRoutine[],
  id: string,
  routine: Omit<StretchRoutine, "id">,
): StretchRoutine[] {
  return routines.map((item) =>
    item.id === id ? { ...item, ...routine, id } : item,
  );
}

export function deleteRoutineWithFallback(
  routines: readonly StretchRoutine[],
  id: string,
  selectedId: string,
  fallbackId: string,
): { routines: StretchRoutine[]; selectedId: string } {
  return {
    routines: routines.filter((routine) => routine.id !== id),
    selectedId: selectedId === id ? fallbackId : selectedId,
  };
}
