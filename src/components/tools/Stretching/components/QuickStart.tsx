import type {
  RoutineCategory,
  StretchRoutine,
} from "@/components/tools/Stretching/types";
import { formatTime } from "@/components/tools/Stretching/utils";
import { getRoutineRepresentativeImage } from "../routineDiscovery";
import { DifficultyBadge } from "./DifficultyBadge";
import { RoutineCard } from "./RoutineCard";
import { StretchImage } from "./StretchImage";

interface QuickStartProps {
  featuredRoutines: StretchRoutine[];
  recentRoutine?: StretchRoutine;
  onSelectRoutine: (routineId: string) => void;
  onBrowseAll: (category?: RoutineCategory) => void;
}

const INTENT_LINKS: ReadonlyArray<{
  category: RoutineCategory;
  label: string;
  prompt: string;
}> = [
  {
    category: "pain-relief",
    label: "Release tension",
    prompt: "I feel stiff or sore",
  },
  {
    category: "posture-correction",
    label: "Reset posture",
    prompt: "I've been sitting",
  },
  {
    category: "mobility",
    label: "Move more freely",
    prompt: "I want an easy flow",
  },
  {
    category: "warm-up",
    label: "Get ready",
    prompt: "I'm about to train",
  },
];

export function QuickStart({
  featuredRoutines,
  recentRoutine,
  onSelectRoutine,
  onBrowseAll,
}: QuickStartProps) {
  return (
    <div className="space-y-8 sm:space-y-10">
      {recentRoutine && (
        <section aria-labelledby="continue-routine-heading">
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                Pick up gently
              </p>
              <h2
                id="continue-routine-heading"
                className="mt-1 text-xl font-semibold text-foreground sm:text-2xl"
              >
                Continue your recent routine
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onSelectRoutine(recentRoutine.id)}
            className="group grid w-full min-w-0 overflow-hidden rounded-2xl border border-border bg-card text-left transition-colors hover:border-primary/50 md:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]"
          >
            <div className="stretching-image-surface aspect-[16/10] rounded-none md:aspect-auto md:min-h-72">
              <StretchImage
                src={getRoutineRepresentativeImage(recentRoutine)}
                alt=""
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.015] motion-reduce:transform-none"
                sizes="(min-width: 768px) 60vw, 100vw"
              />
            </div>
            <div className="flex min-w-0 flex-col justify-center p-5 sm:p-7">
              <div className="flex flex-wrap items-center gap-2">
                {recentRoutine.difficulty && (
                  <DifficultyBadge difficulty={recentRoutine.difficulty} />
                )}
                <span className="text-xs text-muted-foreground">
                  {formatTime(recentRoutine.totalDuration)} · {recentRoutine.stretches.length} stretches
                </span>
              </div>
              <h3 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                {recentRoutine.name}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
                {recentRoutine.goal}
              </p>
              <span className="mt-5 inline-flex items-center gap-2 font-medium text-primary">
                View routine
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </span>
            </div>
          </button>
        </section>
      )}

      <section aria-labelledby="intent-heading">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Choose by how you feel</p>
            <h2 id="intent-heading" className="text-xl font-semibold text-foreground sm:text-2xl">
              What would help right now?
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onBrowseAll()}
            className="shrink-0 rounded-lg px-2 text-sm font-medium text-primary hover:bg-primary/10"
          >
            Browse all
          </button>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {INTENT_LINKS.map((intent) => (
            <button
              type="button"
              key={intent.category}
              onClick={() => onBrowseAll(intent.category)}
              className="min-w-0 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/50 hover:bg-primary/5"
            >
              <span className="block text-xs text-muted-foreground">{intent.prompt}</span>
              <span className="mt-1 block font-semibold text-foreground">{intent.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="featured-routines-heading">
        <h2 id="featured-routines-heading" className="mb-4 text-xl font-semibold text-foreground sm:text-2xl">
          A few calm places to start
        </h2>
        <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featuredRoutines.slice(0, 3).map((routine) => (
            <RoutineCard
              key={routine.id}
              routine={routine}
              onSelect={() => onSelectRoutine(routine.id)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
