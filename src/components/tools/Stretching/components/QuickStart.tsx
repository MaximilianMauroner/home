import type { StretchRoutine } from "@/components/tools/Stretching/types";
import { formatTime } from "@/components/tools/Stretching/utils";
import { DifficultyBadge } from "./DifficultyBadge";

interface QuickStartProps {
  featuredRoutines: StretchRoutine[];
  recentRoutine?: StretchRoutine;
  onSelectRoutine: (routineId: string) => void;
  onBrowseAll: () => void;
}

export function QuickStart({
  featuredRoutines,
  recentRoutine,
  onSelectRoutine,
  onBrowseAll,
}: QuickStartProps) {
  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="tool-panel-lg">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-4">
            <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Time to Stretch
            </h2>
            <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
              Take a moment to care for your body. Choose a routine and begin your practice.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <button
              onClick={onBrowseAll}
              className="tool-button-secondary px-6 py-3"
            >
              <span>Start Stretching</span>
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </button>
          </div>
        </div>
      </section>

      {/* Recent Routine */}
      {recentRoutine && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
            Continue where you left off
          </h2>
          <button
            onClick={() => onSelectRoutine(recentRoutine.id)}
            className="w-full rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-muted/30 sm:p-5"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="font-semibold text-foreground truncate">{recentRoutine.name}</h3>
                  {recentRoutine.difficulty && (
                    <DifficultyBadge difficulty={recentRoutine.difficulty} />
                  )}
                </div>
                <p className="text-sm text-muted-foreground truncate">{recentRoutine.goal}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span>{formatTime(recentRoutine.totalDuration)}</span>
                  <span>·</span>
                  <span>{recentRoutine.stretches.length} stretches</span>
                </div>
              </div>
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-border bg-background text-primary">
                <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </button>
        </section>
      )}

      {/* Featured Routines */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Featured routines
          </h2>
          <button
            onClick={onBrowseAll}
            className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          >
            Browse All
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {featuredRoutines.slice(0, 3).map((routine) => (
            <button
              key={routine.id}
              onClick={() => onSelectRoutine(routine.id)}
              className="rounded-lg border border-border bg-card p-5 text-left transition-colors hover:border-primary/40 hover:bg-muted/30"
            >
              {/* Category icon */}
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background">
                {routine.category === "posture-correction" && <span className="text-xl">🧍</span>}
                {routine.category === "pain-relief" && <span className="text-xl">💆</span>}
                {routine.category === "mobility" && <span className="text-xl">🏃</span>}
                {routine.category === "flexibility" && <span className="text-xl">🤸</span>}
                {routine.category === "warm-up" && <span className="text-xl">🔥</span>}
                {routine.category === "recovery" && <span className="text-xl">🌿</span>}
                {!routine.category && <span className="text-xl">🧘</span>}
              </div>

              <h3 className="font-semibold text-foreground mb-1 line-clamp-1">{routine.name}</h3>
              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{routine.goal}</p>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{formatTime(routine.totalDuration)}</span>
                  <span>·</span>
                  <span>{routine.stretches.length} stretches</span>
                </div>
                {routine.difficulty && (
                  <DifficultyBadge difficulty={routine.difficulty} />
                )}
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Category Quick Links */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: "Posture", icon: "🧍" },
          { label: "Pain Relief", icon: "💆" },
          { label: "Mobility", icon: "🏃" },
          { label: "Flexibility", icon: "🤸" },
        ].map((cat) => (
          <button
            key={cat.label}
            onClick={onBrowseAll}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            <span>{cat.icon}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
