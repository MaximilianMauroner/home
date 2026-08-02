import { getStretchImage } from "./images";
import type {
  DifficultyLevel,
  RoutineCategory,
  StretchRoutine,
} from "./types";

export type RoutineCategoryFilter = RoutineCategory | "all";
export type RoutineDifficultyFilter = DifficultyLevel | "all";

export interface RoutineFilters {
  category: RoutineCategoryFilter;
  difficulty: RoutineDifficultyFilter;
  query: string;
}

export const EMPTY_ROUTINE_FILTERS: RoutineFilters = {
  category: "all",
  difficulty: "all",
  query: "",
};

export const ROUTINE_CATEGORIES: ReadonlyArray<{
  label: string;
  value: RoutineCategoryFilter;
}> = [
  { value: "all", label: "All" },
  { value: "posture-correction", label: "Posture" },
  { value: "pain-relief", label: "Pain relief" },
  { value: "mobility", label: "Mobility" },
  { value: "flexibility", label: "Flexibility" },
  { value: "warm-up", label: "Warm-up" },
  { value: "recovery", label: "Recovery" },
];

export const ROUTINE_DIFFICULTIES: ReadonlyArray<{
  label: string;
  value: RoutineDifficultyFilter;
}> = [
  { value: "all", label: "All levels" },
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

export function mergeRoutineCollections(
  defaultRoutines: StretchRoutine[],
  customRoutines: StretchRoutine[],
): StretchRoutine[] {
  const customIds = new Set(customRoutines.map((routine) => routine.id));
  return [
    ...defaultRoutines.filter((routine) => !customIds.has(routine.id)),
    ...customRoutines,
  ];
}

export function filterRoutines(
  routines: StretchRoutine[],
  filters: RoutineFilters,
): StretchRoutine[] {
  const query = filters.query.trim().toLocaleLowerCase();

  return routines.filter((routine) => {
    const matchesQuery =
      query.length === 0 ||
      routine.name.toLocaleLowerCase().includes(query) ||
      routine.goal.toLocaleLowerCase().includes(query) ||
      routine.tags?.some((tag) => tag.toLocaleLowerCase().includes(query));
    const matchesCategory =
      filters.category === "all" || routine.category === filters.category;
    const matchesDifficulty =
      filters.difficulty === "all" ||
      routine.difficulty === filters.difficulty;

    return Boolean(matchesQuery && matchesCategory && matchesDifficulty);
  });
}

export function getActiveRoutineFilterCount(filters: RoutineFilters): number {
  return (
    Number(filters.query.trim().length > 0) +
    Number(filters.category !== "all") +
    Number(filters.difficulty !== "all")
  );
}

export function getRoutineRepresentativeImage(routine: StretchRoutine): string {
  const firstImage = routine.stretches.find(
    (stretch) => stretch.image?.trim(),
  )?.image;
  return getStretchImage(firstImage, routine.category);
}
