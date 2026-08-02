import { describe, expect, it } from "vitest";
import type {
  Stretch,
  StretchRoutine,
} from "@/components/tools/Stretching/types";
import {
  buildRoutineDraft,
  createRoutine,
  createWorkingSessionStretches,
  deleteRoutineWithFallback,
  getCurrentIndexAfterMove,
  getMoveTarget,
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

  it("keeps the current stretch pointing at the same item after a move", () => {
    expect(getCurrentIndexAfterMove(0, 0, 2)).toBe(2);
    expect(getCurrentIndexAfterMove(1, 0, 2)).toBe(0);
    expect(getCurrentIndexAfterMove(1, 2, 0)).toBe(2);
    expect(getCurrentIndexAfterMove(3, 0, 2)).toBe(3);
  });

  it("starts from the edited working order without sharing mutable metadata", () => {
    const working = [stretch("edited"), stretch("added")];
    const session = createWorkingSessionStretches(working);

    expect(session.map(({ id }) => id)).toEqual(["edited", "added"]);
    expect(session).not.toBe(working);
    expect(session[0]).not.toBe(working[0]);
    expect(session[0]?.targetAreas).not.toBe(working[0]?.targetAreas);
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
