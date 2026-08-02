import { describe, expect, it } from "vitest";
import type {
  Stretch,
  StretchRoutine,
} from "@/components/tools/Stretching/types";
import {
  buildRoutineDraft,
  createRoutine,
  createRoutineWorkingStretches,
  createStudioSessionStartState,
  createWorkingSessionStretches,
  deleteRoutineWithFallback,
  getMoveTarget,
  initializeRoutineStudioDraft,
  reorderItems,
  resolveRoutineStudioIntent,
  summarizeRoutine,
  updateRoutineCollection,
} from "@/components/tools/Stretching/studioHelpers";

const stretch = (id: string, repetitions = 1): Stretch => ({
  id,
  name: id,
  description: "Description",
  duration: 30,
  repetitions,
  how: "How",
  lookFor: "Feel",
  targetAreas: ["hips"],
});

const routine: StretchRoutine = {
  id: "custom_10",
  name: "Original",
  goal: "Goal",
  totalDuration: 30,
  stretches: [stretch("1")],
  category: "mobility",
  difficulty: "intermediate",
  tags: ["daily"],
};

describe("Routine Studio helpers", () => {
  it("provides bounded move targets and stable reordering", () => {
    expect(getMoveTarget(0, "up", 3)).toBeNull();
    expect(getMoveTarget(0, "down", 3)).toBe(1);
    expect(reorderItems(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
  });

  it("starts from the edited working order without sharing mutable metadata", () => {
    const working = [stretch("edited"), stretch("added")];
    const session = createWorkingSessionStretches(working);

    expect(session.map(({ id }) => id)).toEqual(["edited", "added"]);
    expect(session).not.toBe(working);
    expect(session[0]).not.toBe(working[0]);
    expect(session[0]?.targetAreas).not.toBe(working[0]?.targetAreas);
  });

  it("isolates draft edits from a paused live rest session", () => {
    const live = [stretch("live-1"), stretch("live-2")];
    const restState = {
      currentIndex: 0,
      currentRepetition: 1,
      isResting: true,
      nextStretchIndex: 1,
      nextRepetition: 1,
      timeRemaining: 7,
    };
    const draft = initializeRoutineStudioDraft(
      { mode: "manage" },
      "routine_1",
      live,
      [routine],
    ).stretches;

    const edited = draft.map((item) =>
      item.id === "live-1" ? { ...item, name: "Edited" } : item,
    );
    const deleted = edited.filter((item) => item.id !== "live-2");
    const reordered = reorderItems(draft, 0, 1);

    expect(draft).not.toBe(live);
    expect(draft[0]).not.toBe(live[0]);
    expect(live.map(({ name }) => name)).toEqual(["live-1", "live-2"]);
    expect(deleted).toHaveLength(1);
    expect(reordered.map(({ id }) => id)).toEqual(["live-2", "live-1"]);
    expect(restState).toEqual({
      currentIndex: 0,
      currentRepetition: 1,
      isResting: true,
      nextStretchIndex: 1,
      nextRepetition: 1,
      timeRemaining: 7,
    });
  });

  it("commits a cloned draft into a deterministic ready session", () => {
    const draft = [stretch("edited", 2), stretch("added")];
    const start = createStudioSessionStartState(draft);

    expect(start).toMatchObject({
      currentIndex: 0,
      currentRepetition: 1,
      timeRemaining: 30,
      isRunning: false,
      isPaused: false,
      isResting: false,
      isCompleted: false,
      nextStretchIndex: null,
      nextRepetition: null,
    });
    expect(start.stretches).toEqual(draft);
    expect(start.stretches).not.toBe(draft);
    expect(start.stretches[0]).not.toBe(draft[0]);
  });

  it("resolves browser create/edit intents and rejects editing default routines", () => {
    expect(
      resolveRoutineStudioIntent({ mode: "create" }, "routine_1", [routine]),
    ).toMatchObject({
      activeTab: "routines",
      routineMode: "create",
      managedRoutineId: "routine_1",
      hasExternalRoutineIntent: true,
    });
    expect(
      resolveRoutineStudioIntent(
        { mode: "edit", routineId: routine.id },
        "routine_1",
        [routine],
      ),
    ).toMatchObject({
      activeTab: "routines",
      routineMode: "edit",
      editingRoutine: routine,
      managedRoutineId: routine.id,
      hasExternalRoutineIntent: true,
    });
    expect(
      resolveRoutineStudioIntent(
        { mode: "edit", routineId: "routine_1" },
        "routine_1",
        [routine],
      ),
    ).toMatchObject({
      activeTab: "stretches",
      routineMode: "list",
      editingRoutine: null,
      hasExternalRoutineIntent: false,
    });
  });

  it("opens a browser edit draft without leaking selection or live stretches", () => {
    const live = [stretch("live")];
    const selectedRoutineId = "routine_1";
    const draftState = initializeRoutineStudioDraft(
      { mode: "edit", routineId: routine.id },
      selectedRoutineId,
      live,
      [routine],
    );

    expect(draftState.managedRoutineId).toBe(routine.id);
    expect(draftState.editingRoutine).toBe(routine);
    expect(draftState.stretches).toEqual(
      createRoutineWorkingStretches(routine),
    );
    expect(draftState.stretches).not.toBe(live);
    expect(selectedRoutineId).toBe("routine_1");
    expect(live.map(({ id }) => id)).toEqual(["live"]);
  });

  it("discards a changed draft without changing the selected live routine", () => {
    const live = [stretch("live")];
    const selectedRoutineId = "routine_1";
    const draft = initializeRoutineStudioDraft(
      { mode: "manage" },
      selectedRoutineId,
      live,
      [routine],
    ).stretches;

    draft[0] = { ...draft[0]!, name: "Unsaved edit" };
    draft.push(stretch("unsaved-addition"));

    expect(selectedRoutineId).toBe("routine_1");
    expect(live).toEqual([stretch("live")]);
  });

  it("recomputes duration and steps from repetitions", () => {
    expect(summarizeRoutine([stretch("1", 2), stretch("2", 3)])).toEqual({
      stretchCount: 2,
      totalDuration: 150,
      totalSteps: 5,
    });
  });

  it("normalizes only the active routine prefix and preserves metadata", () => {
    const draft = buildRoutineDraft(
      routine,
      { name: "  Updated ", goal: " New goal " },
      [stretch("custom_10_step_with_underscores", 2)],
    );
    expect(draft).toMatchObject({
      name: "Updated",
      goal: "New goal",
      totalDuration: 60,
      category: "mobility",
      difficulty: "intermediate",
      tags: ["daily"],
      stretches: [{ id: "step_with_underscores", targetAreas: ["hips"] }],
    });
  });

  it("supports create, update, and delete fallback without mutating IDs", () => {
    expect(createRoutine([], routine)).toEqual([routine]);
    expect(
      updateRoutineCollection([routine], routine.id, {
        ...routine,
        name: "Changed",
      }),
    ).toMatchObject([{ id: "custom_10", name: "Changed" }]);
    expect(
      deleteRoutineWithFallback([routine], routine.id, routine.id, "routine_1"),
    ).toEqual({ routines: [], selectedId: "routine_1" });
  });
});
