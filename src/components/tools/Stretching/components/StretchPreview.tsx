import type { StretchRoutine } from "@/components/tools/Stretching/types";
import { formatTime } from "@/components/tools/Stretching/utils";
import { PLACEHOLDER_IMAGE } from "../images";
import { getRoutineRepresentativeImage } from "../routineDiscovery";
import { StretchImage } from "./StretchImage";

interface StretchPreviewProps {
  onBack: () => void;
  onBegin: () => void;
  routine: StretchRoutine;
}

export function StretchPreview({ routine, onBegin, onBack }: StretchPreviewProps) {
  const totalSteps = routine.stretches.reduce(
    (total, stretch) => total + (stretch.repetitions || 1),
    0,
  );

  return (
    <div className="min-w-0 space-y-6 pb-28 sm:pb-0">
      <header className="flex min-w-0 items-start gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to routine browser"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full transition-colors hover:bg-foreground/10"
        >
          <svg className="h-6 w-6 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="min-w-0 pt-1">
          <p className="text-sm text-muted-foreground">Routine preview</p>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {routine.name}
          </h2>
        </div>
      </header>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.2fr)] lg:items-start">
        <aside className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card lg:sticky lg:top-6">
          <div className="stretching-image-surface aspect-[16/10] rounded-none">
            <StretchImage
              src={getRoutineRepresentativeImage(routine)}
              alt=""
              className="h-full w-full object-cover"
              sizes="(min-width: 1024px) 38vw, 100vw"
            />
          </div>

          <div className="space-y-5 p-5 sm:p-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Outcome</p>
              <p className="mt-2 leading-relaxed text-foreground">{routine.goal}</p>
            </div>

            <dl className="grid grid-cols-2 overflow-hidden rounded-xl border border-border">
              <div className="border-b border-r border-border p-3">
                <dt className="text-xs text-muted-foreground">Duration</dt>
                <dd className="mt-1 font-semibold text-foreground">{formatTime(routine.totalDuration)}</dd>
              </div>
              <div className="border-b border-border p-3">
                <dt className="text-xs text-muted-foreground">Difficulty</dt>
                <dd className="mt-1 font-semibold capitalize text-foreground">{routine.difficulty ?? "All levels"}</dd>
              </div>
              <div className="border-r border-border p-3">
                <dt className="text-xs text-muted-foreground">Movements</dt>
                <dd className="mt-1 font-semibold text-foreground">{routine.stretches.length} stretches</dd>
              </div>
              <div className="p-3">
                <dt className="text-xs text-muted-foreground">Sequence</dt>
                <dd className="mt-1 font-semibold text-foreground">{totalSteps} steps</dd>
              </div>
            </dl>

            <button type="button" onClick={onBegin} className="tool-button hidden w-full py-3 text-base sm:inline-flex">
              Begin routine
            </button>
          </div>
        </aside>

        <section className="min-w-0" aria-labelledby="movement-list-heading">
          <div className="mb-4">
            <p className="text-sm text-muted-foreground">In this order</p>
            <h3 id="movement-list-heading" className="text-xl font-semibold text-foreground">
              Your movements
            </h3>
          </div>

          <ol className="space-y-3">
            {routine.stretches.map((stretch, index) => (
              <li key={`${stretch.id}-${index}`} className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card">
                <div className="grid min-w-0 grid-cols-[5.5rem_minmax(0,1fr)] gap-3 p-3 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-4 sm:p-4">
                  <div className="stretching-image-surface aspect-square">
                    <StretchImage
                      src={stretch.image || PLACEHOLDER_IMAGE}
                      alt=""
                      className="h-full w-full object-cover"
                      sizes="(min-width: 640px) 112px, 88px"
                    />
                  </div>

                  <div className="min-w-0 self-center">
                    <div className="flex min-w-0 items-start gap-2">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {index + 1}
                      </span>
                      <h4 className="min-w-0 font-semibold leading-snug text-foreground">{stretch.name}</h4>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{stretch.description}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <span>{formatTime(stretch.duration)}</span>
                      {(stretch.repetitions || 1) > 1 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{stretch.repetitions} repetitions</span>
                        </>
                      )}
                      {stretch.targetAreas && stretch.targetAreas.length > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{stretch.targetAreas.slice(0, 2).join(", ")}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-[max(1rem,env(safe-area-inset-left))] pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_hsl(var(--foreground)/0.08)] backdrop-blur sm:hidden">
        <button type="button" onClick={onBegin} className="tool-button mx-auto flex w-full max-w-xl py-3 text-base">
          Begin routine
        </button>
      </div>
    </div>
  );
}
