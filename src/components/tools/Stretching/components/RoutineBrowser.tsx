import { useState, useMemo } from "react";
import type {
  StretchRoutine,
  RoutineCategory,
  DifficultyLevel,
} from "@/components/tools/Stretching/types";
import { formatTime } from "@/components/tools/Stretching/utils";
import { FilterPills } from "./FilterPills";
import { DifficultyBadge } from "./DifficultyBadge";

interface RoutineBrowserProps {
  routines: StretchRoutine[];
  customRoutines: StretchRoutine[];
  selectedRoutineId: string;
  onSelectRoutine: (routineId: string) => void;
  onEditRoutine: (routine: StretchRoutine) => void;
  onDeleteRoutine: (routineId: string) => void;
  onCreateRoutine: () => void;
  onClose: () => void;
}

export function RoutineBrowser({
  routines,
  customRoutines,
  selectedRoutineId,
  onSelectRoutine,
  onEditRoutine,
  onDeleteRoutine,
  onCreateRoutine,
  onClose,
}: RoutineBrowserProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<
    RoutineCategory | "all"
  >("all");
  const [selectedDifficulty, setSelectedDifficulty] = useState<
    DifficultyLevel | "all"
  >("all");

  const filteredRoutines = useMemo(() => {
    const allRoutines = [...routines, ...customRoutines];
    return allRoutines.filter((routine) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = routine.name.toLowerCase().includes(query);
        const matchesGoal = routine.goal.toLowerCase().includes(query);
        const matchesTags = routine.tags?.some((tag) =>
          tag.toLowerCase().includes(query),
        );
        if (!matchesName && !matchesGoal && !matchesTags) return false;
      }

      // Category filter
      if (selectedCategory !== "all" && routine.category !== selectedCategory) {
        return false;
      }

      // Difficulty filter
      if (
        selectedDifficulty !== "all" &&
        routine.difficulty !== selectedDifficulty
      ) {
        return false;
      }

      return true;
    });
  }, [
    routines,
    customRoutines,
    searchQuery,
    selectedCategory,
    selectedDifficulty,
  ]);

  const getCategoryIcon = (category?: RoutineCategory) => {
    switch (category) {
      case "posture-correction":
        return "🧍";
      case "pain-relief":
        return "💆";
      case "mobility":
        return "🏃";
      case "flexibility":
        return "🤸";
      case "warm-up":
        return "🔥";
      case "recovery":
        return "🌿";
      default:
        return "🧘";
    }
  };

  const getCategoryLabel = (category?: RoutineCategory) => {
    switch (category) {
      case "posture-correction":
        return "Posture";
      case "pain-relief":
        return "Pain Relief";
      case "mobility":
        return "Mobility";
      case "flexibility":
        return "Flexibility";
      case "warm-up":
        return "Warm-Up";
      case "recovery":
        return "Recovery";
      default:
        return "General";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onClose}
            aria-label="Back to stretching overview"
            className="rounded-full p-2 transition-colors hover:bg-foreground/10"
          >
            <svg
              className="h-6 w-6 text-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <h2 className="font-serif text-2xl text-foreground">
            Browse Routines
          </h2>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          aria-label="Search routines"
          type="text"
          placeholder="Search routines..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-xl border border-border bg-card py-3 pl-10 pr-4 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {/* Filters */}
      <FilterPills
        selectedCategory={selectedCategory}
        selectedDifficulty={selectedDifficulty}
        onCategoryChange={setSelectedCategory}
        onDifficultyChange={setSelectedDifficulty}
      />

      {/* Routine Grid */}
      {filteredRoutines.length === 0 ? (
        <div className="py-16 text-center">
          <div className="mb-4 text-6xl">🔍</div>
          <h3 className="mb-2 text-xl font-semibold text-foreground">
            No routines found
          </h3>
          <p className="mb-6 text-muted-foreground">
            Try adjusting your search or filters
          </p>
          <button
            onClick={() => {
              setSearchQuery("");
              setSelectedCategory("all");
              setSelectedDifficulty("all");
            }}
            className="rounded-full bg-primary px-6 py-2 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredRoutines.map((routine) => {
            const isCustom = customRoutines.some((r) => r.id === routine.id);
            const isSelected = routine.id === selectedRoutineId;

            return (
              <div
                key={routine.id}
                className={`group relative overflow-hidden rounded-lg transition-colors ${
                  isSelected
                    ? "shadow-sm ring-2 ring-primary"
                    : "hover:shadow-sm"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectRoutine(routine.id)}
                  aria-pressed={isSelected}
                  className="w-full rounded-lg border border-border bg-card p-5 text-left"
                >
                  {/* Category badge */}
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                        <span className="text-base">
                          {getCategoryIcon(routine.category)}
                        </span>
                      </div>
                      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {getCategoryLabel(routine.category)}
                      </span>
                    </div>
                    {isCustom && (
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-400">
                        Custom
                      </span>
                    )}
                  </div>

                  {/* Title and description */}
                  <h3 className="mb-1 line-clamp-2 font-semibold text-foreground">
                    {routine.name}
                  </h3>
                  <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">
                    {routine.goal}
                  </p>

                  {/* Tags */}
                  {routine.tags && routine.tags.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-1">
                      {routine.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between border-t border-border pt-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatTime(routine.totalDuration)}</span>
                      <span>-</span>
                      <span>{routine.stretches.length} stretches</span>
                    </div>
                    {routine.difficulty && (
                      <DifficultyBadge difficulty={routine.difficulty} />
                    )}
                  </div>
                </button>

                {/* Edit/Delete buttons for custom routines */}
                {isCustom && (
                  <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                    <button
                      type="button"
                      aria-label={`Edit ${routine.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditRoutine(routine);
                      }}
                      className="rounded-lg bg-card/90 p-2 shadow-md backdrop-blur-sm transition-colors hover:bg-card"
                      title="Edit routine"
                    >
                      <svg
                        className="h-4 w-4 text-foreground"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${routine.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm("Delete this routine?")) {
                          onDeleteRoutine(routine.id);
                        }
                      }}
                      className="rounded-lg bg-card/90 p-2 shadow-md backdrop-blur-sm transition-colors hover:bg-red-50 dark:hover:bg-red-950/50"
                      title="Delete routine"
                    >
                      <svg
                        className="h-4 w-4 text-red-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create new routine button */}
      <div className="text-center">
        <button
          onClick={onCreateRoutine}
          className="inline-flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-6 py-3 text-sm font-medium text-primary transition hover:bg-primary/20"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          Create Custom Routine
        </button>
      </div>
    </div>
  );
}
