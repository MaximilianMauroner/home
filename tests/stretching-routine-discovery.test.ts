import { describe, expect, test } from "vitest";

import { PLACEHOLDER_IMAGE } from "../src/components/tools/Stretching/images";
import {
  EMPTY_ROUTINE_FILTERS,
  filterRoutines,
  getActiveRoutineFilterCount,
  getRoutineRepresentativeImage,
  mergeRoutineCollections,
} from "../src/components/tools/Stretching/routineDiscovery";
import type { StretchRoutine } from "../src/components/tools/Stretching/types";

function routine(
  overrides: Partial<StretchRoutine> & Pick<StretchRoutine, "id" | "name">,
): StretchRoutine {
  return {
    goal: "A calm daily reset",
    totalDuration: 300,
    stretches: [],
    ...overrides,
  };
}

const routines = [
  routine({
    id: "posture",
    name: "Desk reset",
    category: "posture-correction",
    difficulty: "beginner",
    tags: ["office", "daily"],
  }),
  routine({
    id: "mobility",
    name: "Hip flow",
    goal: "Prepare for leg day",
    category: "mobility",
    difficulty: "intermediate",
    tags: ["warmup"],
  }),
];

describe("routine discovery helpers", () => {
  test("combines name, goal, and tag search with category and difficulty", () => {
    expect(
      filterRoutines(routines, {
        query: "leg day",
        category: "mobility",
        difficulty: "intermediate",
      }).map(({ id }) => id),
    ).toEqual(["mobility"]);

    expect(
      filterRoutines(routines, {
        query: "office",
        category: "mobility",
        difficulty: "all",
      }),
    ).toEqual([]);
  });

  test("merges custom routines after defaults and lets a custom ID replace a default", () => {
    const replacement = routine({ id: "posture", name: "My desk reset" });
    const evening = routine({ id: "evening", name: "Evening ease" });

    expect(mergeRoutineCollections(routines, [replacement, evening])).toEqual([
      routines[1],
      replacement,
      evening,
    ]);
  });

  test("reports active filter count and resets to the full result set", () => {
    const activeFilters = {
      query: "reset",
      category: "posture-correction" as const,
      difficulty: "all" as const,
    };

    expect(getActiveRoutineFilterCount(activeFilters)).toBe(2);
    expect(filterRoutines(routines, activeFilters)).toHaveLength(1);
    expect(getActiveRoutineFilterCount(EMPTY_ROUTINE_FILTERS)).toBe(0);
    expect(filterRoutines(routines, EMPTY_ROUTINE_FILTERS)).toHaveLength(2);
  });

  test("uses the first available stretch image and the existing fallback", () => {
    expect(
      getRoutineRepresentativeImage(
        routine({
          id: "image",
          name: "Image routine",
          stretches: [
            {
              id: "empty",
              name: "No image",
              description: "",
              duration: 30,
              repetitions: 1,
              image: "",
              how: "",
              lookFor: "",
            },
            {
              id: "pictured",
              name: "Pictured",
              description: "",
              duration: 30,
              repetitions: 1,
              image: "/stretches/cat-pose.png",
              how: "",
              lookFor: "",
            },
          ],
        }),
      ),
    ).toBe("/stretches/cat-pose.png");

    expect(
      getRoutineRepresentativeImage(
        routine({ id: "fallback", name: "Fallback routine" }),
      ),
    ).toBe(PLACEHOLDER_IMAGE);
  });
});
