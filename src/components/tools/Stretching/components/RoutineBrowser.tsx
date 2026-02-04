import { useState, useMemo } from "react";
import type { StretchRoutine, RoutineCategory, DifficultyLevel } from "@/components/tools/Stretching/types";
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
  const [selectedCategory, setSelectedCategory] = useState<RoutineCategory | "all">("all");
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyLevel | "all">("all");

  const allRoutines = [...routines, ...customRoutines];

  const filteredRoutines = useMemo(() => {
    return allRoutines.filter((routine) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = routine.name.toLowerCase().includes(query);
        const matchesGoal = routine.goal.toLowerCase().includes(query);
        const matchesTags = routine.tags?.some((tag) => tag.toLowerCase().includes(query));
        if (!matchesName && !matchesGoal && !matchesTags) return false;
      }

      // Category filter
      if (selectedCategory !== "all" && routine.category !== selectedCategory) {
        return false;
      }

      // Difficulty filter
      if (selectedDifficulty !== "all" && routine.difficulty !== selectedDifficulty) {
        return false;
      }

      return true;
    });
  }, [allRoutines, searchQuery, selectedCategory, selectedDifficulty]);

  const getCategoryIcon = (category?: RoutineCategory) => {
    switch (category) {
      case "posture-correction": return "🧍";
      case "pain-relief": return "💆";
      case "mobility": return "🏃";
      case "flexibility": return "🤸";
      case "warm-up": return "🔥";
      case "recovery": return "🌿";
      default: return "🧘";
    }
  };

  const getCategoryLabel = (category?: RoutineCategory) => {
    switch (category) {
      case "posture-correction": return "Posture";
      case "pain-relief": return "Pain Relief";
      case "mobility": return "Mobility";
      case "flexibility": return "Flexibility";
      case "warm-up": return "Warm-Up";
      case "recovery": return "Recovery";
      default: return "General";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-foreground/10 transition-colors"
          >
            <svg className="w-6 h-6 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-2xl font-serif text-foreground">Browse Routines</h2>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search routines..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 rounded-xl bg-card border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-foreground placeholder:text-muted-foreground"
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
        <div className="text-center py-16">
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="text-xl font-semibold text-foreground mb-2">No routines found</h3>
          <p className="text-muted-foreground mb-6">Try adjusting your search or filters</p>
          <button
            onClick={() => {
              setSearchQuery("");
              setSelectedCategory("all");
              setSelectedDifficulty("all");
            }}
            className="px-6 py-2 rounded-full bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRoutines.map((routine) => {
            const isCustom = customRoutines.some((r) => r.id === routine.id);
            const isSelected = routine.id === selectedRoutineId;

            return (
              <div
                key={routine.id}
                className={`relative group rounded-2xl overflow-hidden transition-all ${
                  isSelected
                    ? "ring-2 ring-primary shadow-lg"
                    : "hover:shadow-md"
                }`}
              >
                <button
                  onClick={() => onSelectRoutine(routine.id)}
                  className="w-full text-left p-5 bg-card border border-border rounded-2xl"
                >
                  {/* Category badge */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                        <span className="text-base">{getCategoryIcon(routine.category)}</span>
                      </div>
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        {getCategoryLabel(routine.category)}
                      </span>
                    </div>
                    {isCustom && (
                      <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-400/10 px-2 py-0.5 rounded-full">
                        Custom
                      </span>
                    )}
                  </div>

                  {/* Title and description */}
                  <h3 className="font-semibold text-foreground mb-1 line-clamp-2">{routine.name}</h3>
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{routine.goal}</p>

                  {/* Tags */}
                  {routine.tags && routine.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {routine.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-2 border-t border-border">
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
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditRoutine(routine);
                      }}
                      className="p-2 bg-card/90 backdrop-blur-sm rounded-lg shadow-md hover:bg-card transition-colors"
                      title="Edit routine"
                    >
                      <svg className="w-4 h-4 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm("Delete this routine?")) {
                          onDeleteRoutine(routine.id);
                        }
                      }}
                      className="p-2 bg-card/90 backdrop-blur-sm rounded-lg shadow-md hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors"
                      title="Delete routine"
                    >
                      <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-primary/40 bg-primary/10 text-sm font-medium text-primary transition hover:bg-primary/20"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Custom Routine
        </button>
      </div>
    </div>
  );
}
