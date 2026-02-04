import type { RoutineCategory, DifficultyLevel } from "@/components/tools/Stretching/types";

interface FilterPillsProps {
  selectedCategory: RoutineCategory | "all";
  selectedDifficulty: DifficultyLevel | "all";
  onCategoryChange: (category: RoutineCategory | "all") => void;
  onDifficultyChange: (difficulty: DifficultyLevel | "all") => void;
}

const categories: { value: RoutineCategory | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "posture-correction", label: "Posture" },
  { value: "pain-relief", label: "Pain Relief" },
  { value: "mobility", label: "Mobility" },
  { value: "flexibility", label: "Flexibility" },
  { value: "warm-up", label: "Warm-Up" },
  { value: "recovery", label: "Recovery" },
];

const difficulties: { value: DifficultyLevel | "all"; label: string }[] = [
  { value: "all", label: "All Levels" },
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

export function FilterPills({
  selectedCategory,
  selectedDifficulty,
  onCategoryChange,
  onDifficultyChange,
}: FilterPillsProps) {
  return (
    <div className="space-y-3">
      {/* Category Pills */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat.value}
            onClick={() => onCategoryChange(cat.value)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
              selectedCategory === cat.value
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-foreground hover:bg-primary/10 border border-border"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Difficulty Pills */}
      <div className="flex flex-wrap gap-2">
        {difficulties.map((diff) => (
          <button
            key={diff.value}
            onClick={() => onDifficultyChange(diff.value)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
              selectedDifficulty === diff.value
                ? "bg-emerald-600 dark:bg-emerald-500 text-white shadow-sm"
                : "bg-muted text-foreground hover:bg-emerald-500/10 border border-border"
            }`}
          >
            {diff.label}
          </button>
        ))}
      </div>
    </div>
  );
}
