import type { DifficultyLevel } from "@/components/tools/Stretching/types";

interface DifficultyBadgeProps {
  difficulty: DifficultyLevel;
  size?: "sm" | "md";
}

const difficultyConfig: Record<DifficultyLevel, { label: string; bgClass: string; textClass: string }> = {
  beginner: {
    label: "Beginner",
    bgClass: "bg-emerald-500/15 dark:bg-emerald-400/15",
    textClass: "text-emerald-700 dark:text-emerald-300",
  },
  intermediate: {
    label: "Intermediate",
    bgClass: "bg-amber-500/15 dark:bg-amber-400/15",
    textClass: "text-amber-700 dark:text-amber-300",
  },
  advanced: {
    label: "Advanced",
    bgClass: "bg-rose-500/15 dark:bg-rose-400/15",
    textClass: "text-rose-700 dark:text-rose-300",
  },
};

export function DifficultyBadge({ difficulty, size = "sm" }: DifficultyBadgeProps) {
  const config = difficultyConfig[difficulty];
  const sizeClasses = size === "sm"
    ? "text-xs px-2 py-0.5"
    : "text-sm px-3 py-1";

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${config.bgClass} ${config.textClass} ${sizeClasses}`}
    >
      {config.label}
    </span>
  );
}
