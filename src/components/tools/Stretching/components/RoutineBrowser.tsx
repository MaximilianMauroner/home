import { useMemo, useState } from "react";
import type { StretchRoutine } from "@/components/tools/Stretching/types";
import {
  EMPTY_ROUTINE_FILTERS,
  filterRoutines,
  getActiveRoutineFilterCount,
  mergeRoutineCollections,
  type RoutineCategoryFilter,
  type RoutineDifficultyFilter,
} from "../routineDiscovery";
import { FilterPills } from "./FilterPills";
import { RoutineCard } from "./RoutineCard";

interface RoutineBrowserProps {
  customRoutines: StretchRoutine[];
  initialCategory?: RoutineCategoryFilter;
  onClose: () => void;
  onCreateRoutine: () => void;
  onDeleteRoutine: (routineId: string) => void;
  onEditRoutine: (routine: StretchRoutine) => void;
  onSelectRoutine: (routineId: string) => void;
  routines: StretchRoutine[];
  selectedRoutineId: string;
}

export function RoutineBrowser({
  routines,
  customRoutines,
  selectedRoutineId,
  initialCategory = "all",
  onSelectRoutine,
  onEditRoutine,
  onDeleteRoutine,
  onCreateRoutine,
  onClose,
}: RoutineBrowserProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] =
    useState<RoutineCategoryFilter>(initialCategory);
  const [selectedDifficulty, setSelectedDifficulty] =
    useState<RoutineDifficultyFilter>("all");

  const allRoutines = useMemo(
    () => mergeRoutineCollections(routines, customRoutines),
    [routines, customRoutines],
  );
  const filters = {
    query: searchQuery,
    category: selectedCategory,
    difficulty: selectedDifficulty,
  };
  const filteredRoutines = useMemo(
    () => filterRoutines(allRoutines, filters),
    [allRoutines, searchQuery, selectedCategory, selectedDifficulty],
  );
  const customRoutineIds = useMemo(
    () => new Set(customRoutines.map((routine) => routine.id)),
    [customRoutines],
  );
  const activeFilterCount = getActiveRoutineFilterCount(filters);

  const resetFilters = () => {
    setSearchQuery(EMPTY_ROUTINE_FILTERS.query);
    setSelectedCategory(EMPTY_ROUTINE_FILTERS.category);
    setSelectedDifficulty(EMPTY_ROUTINE_FILTERS.difficulty);
  };

  return (
    <div className="min-w-0 space-y-6">
      <header className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onClose}
          aria-label="Back to stretching overview"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full transition-colors hover:bg-foreground/10"
        >
          <svg className="h-6 w-6 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">Find the pace your body needs</p>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">Browse routines</h2>
        </div>
      </header>

      <div className="relative">
        <svg className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          aria-label="Search routines by name, goal, or tag"
          type="search"
          placeholder="Search by name, goal, or tag"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          className="w-full rounded-xl border border-border bg-card py-3 pl-10 pr-4 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <FilterPills
        selectedCategory={selectedCategory}
        selectedDifficulty={selectedDifficulty}
        activeFilterCount={activeFilterCount}
        resultCount={filteredRoutines.length}
        onCategoryChange={setSelectedCategory}
        onDifficultyChange={setSelectedDifficulty}
        onReset={resetFilters}
      />

      {filteredRoutines.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-border bg-card/50 px-4 py-14 text-center" aria-live="polite">
          <h3 className="text-xl font-semibold text-foreground">No routines match</h3>
          <p className="mt-2 text-muted-foreground">Try another phrase or clear the filters.</p>
          <button type="button" onClick={resetFilters} className="tool-button-secondary mt-5">
            Clear filters
          </button>
        </section>
      ) : (
        <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-live="polite">
          {filteredRoutines.map((routine) => {
            const isCustom = customRoutineIds.has(routine.id);

            return (
              <RoutineCard
                key={routine.id}
                routine={routine}
                isCustom={isCustom}
                isSelected={routine.id === selectedRoutineId}
                onSelect={() => onSelectRoutine(routine.id)}
                onEdit={() => onEditRoutine(routine)}
                onDelete={() => {
                  if (window.confirm(`Delete “${routine.name}”? This cannot be undone.`)) {
                    onDeleteRoutine(routine.id);
                  }
                }}
              />
            );
          })}
        </div>
      )}

      <div className="text-center">
        <button type="button" onClick={onCreateRoutine} className="tool-button-secondary px-6">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create custom routine
        </button>
      </div>
    </div>
  );
}
