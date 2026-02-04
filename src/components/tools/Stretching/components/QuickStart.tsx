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
      {/* Hero Section - matching codebase pattern */}
      <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-emerald-500/10 via-transparent to-teal-500/10 p-6 sm:p-8 shadow-lg backdrop-blur-sm dark:from-emerald-500/20 dark:to-teal-500/15">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.12),transparent_60%)]" />

        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-300">
              Wellness Toolkit
            </span>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Time to Stretch
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
              Take a moment to care for your body. Choose a routine and begin your practice.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <button
              onClick={onBrowseAll}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-6 py-3 text-sm font-medium text-primary transition hover:bg-primary/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:border-primary/30 dark:bg-primary/15 dark:text-primary-foreground"
            >
              <span>Start Stretching</span>
              <svg
                className="w-4 h-4 transition-transform group-hover:translate-x-1"
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
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Continue Where You Left Off
          </h2>
          <button
            onClick={() => onSelectRoutine(recentRoutine.id)}
            className="w-full text-left p-4 sm:p-5 rounded-2xl border border-border bg-card hover:border-primary/50 hover:shadow-md transition-all group touch-manipulation"
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
              <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
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
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Featured Routines
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
              className="text-left p-5 rounded-2xl border border-border bg-card hover:border-primary/40 hover:shadow-md transition-all group touch-manipulation"
            >
              {/* Category icon */}
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center mb-3">
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
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-card text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground transition-all touch-manipulation"
          >
            <span>{cat.icon}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
