import type {
  RoutineCategory,
  DifficultyLevel,
} from "@/components/tools/Stretching/types";

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
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Routine category"
      >
        {categories.map((cat) => (
          <button
            type="button"
            key={cat.value}
            onClick={() => onCategoryChange(cat.value)}
            aria-pressed={selectedCategory === cat.value}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              selectedCategory === cat.value
                ? "bg-primary text-primary-foreground shadow-sm"
                : "border border-border bg-muted text-foreground hover:bg-primary/10"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Difficulty Pills */}
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Difficulty level"
      >
        {difficulties.map((diff) => (
          <button
            type="button"
            key={diff.value}
            onClick={() => onDifficultyChange(diff.value)}
            aria-pressed={selectedDifficulty === diff.value}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              selectedDifficulty === diff.value
                ? "bg-emerald-600 text-white shadow-sm dark:bg-emerald-500"
                : "border border-border bg-muted text-foreground hover:bg-emerald-500/10"
            }`}
          >
            {diff.label}
          </button>
        ))}
      </div>
    </div>
  );
}
