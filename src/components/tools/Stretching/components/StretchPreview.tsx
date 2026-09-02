import { useState } from "react";
import type { StretchRoutine } from "@/components/tools/Stretching/types";
import { formatTime } from "@/components/tools/Stretching/utils";
import { buildRailSegments } from "../rail";
import { PLACEHOLDER_IMAGE } from "../images";
import { getRoutineRepresentativeImage } from "../routineDiscovery";
import { DurationRail } from "./DurationRail";
import { StretchPreviewDialog } from "./StretchPreviewDialog";
import { StretchImage } from "./StretchImage";

interface StretchPreviewProps {
  onBack: () => void;
  onBegin: () => void;
  routine: StretchRoutine;
}

export function StretchPreview({
  routine,
  onBegin,
  onBack,
}: StretchPreviewProps) {
  const [selectedStretchIndex, setSelectedStretchIndex] = useState<
    number | null
  >(null);
  const totalSteps = routine.stretches.reduce(
    (total, stretch) => total + (stretch.repetitions || 1),
    0,
  );
  const railSegments = buildRailSegments(routine.stretches, {
    index: 0,
    repetition: 1,
    timeRemaining: routine.stretches[0]?.duration ?? 0,
    isResting: false,
    isCompleted: false,
  });
  const selectedStretch =
    selectedStretchIndex === null
      ? null
      : (routine.stretches[selectedStretchIndex] ?? null);

  const previewStretch = (index: number) => {
    if (index < 0 || index >= routine.stretches.length) return;
    setSelectedStretchIndex(index);
  };

  return (
    <div className="min-w-0 space-y-6 pb-28 sm:pb-0">
      <header className="flex min-w-0 items-start gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to routine browser"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full transition-colors hover:bg-foreground/10"
        >
          <svg
            className="h-6 w-6 text-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
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
          <div className="stretching-image-surface aspect-[4/3] rounded-none">
            <StretchImage
              src={getRoutineRepresentativeImage(routine)}
              alt=""
              className="h-full w-full object-contain object-center"
              sizes="(min-width: 1024px) 38vw, 100vw"
            />
          </div>

          <div className="space-y-5 p-5 sm:p-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                Outcome
              </p>
              <p className="mt-2 leading-relaxed text-foreground">
                {routine.goal}
              </p>
            </div>

            <dl className="grid grid-cols-2 overflow-hidden rounded-xl border border-border">
              <div className="border-b border-r border-border p-3">
                <dt className="text-xs text-muted-foreground">Duration</dt>
                <dd className="mt-1 font-semibold text-foreground">
                  {formatTime(routine.totalDuration)}
                </dd>
              </div>
              <div className="border-b border-border p-3">
                <dt className="text-xs text-muted-foreground">Difficulty</dt>
                <dd className="mt-1 font-semibold capitalize text-foreground">
                  {routine.difficulty ?? "All levels"}
                </dd>
              </div>
              <div className="border-r border-border p-3">
                <dt className="text-xs text-muted-foreground">Movements</dt>
                <dd className="mt-1 font-semibold text-foreground">
                  {routine.stretches.length} stretches
                </dd>
              </div>
              <div className="p-3">
                <dt className="text-xs text-muted-foreground">Sequence</dt>
                <dd className="mt-1 font-semibold text-foreground">
                  {totalSteps} steps
                </dd>
              </div>
            </dl>

            <div className="stretching-preview-rail">
              <div className="mb-2 flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                <span>Sequence</span>
                <span>{formatTime(routine.totalDuration)}</span>
              </div>
              <DurationRail
                segments={railSegments}
                onJumpTo={previewStretch}
                selectedIndex={selectedStretchIndex}
                actionLabel="Preview"
                size="preview"
                label={`${routine.name} sequence rail`}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Select a segment or movement to preview it.
              </p>
            </div>

            <button
              type="button"
              onClick={onBegin}
              className="tool-button hidden w-full py-3 text-base sm:inline-flex"
            >
              Begin routine
            </button>
          </div>
        </aside>

        <section className="min-w-0" aria-labelledby="movement-list-heading">
          <div className="mb-4">
            <p className="text-sm text-muted-foreground">In this order</p>
            <h3
              id="movement-list-heading"
              className="text-xl font-semibold text-foreground"
            >
              Your movements
            </h3>
          </div>

          <ol className="space-y-3">
            {routine.stretches.map((stretch, index) => (
              <li
                key={`${stretch.id}-${index}`}
                className={`min-w-0 overflow-hidden rounded-2xl border bg-card transition-colors ${selectedStretchIndex === index ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
              >
                <button
                  type="button"
                  onClick={() => previewStretch(index)}
                  aria-haspopup="dialog"
                  aria-label={`Preview ${stretch.name}`}
                  title={`Preview ${stretch.name}`}
                  className="group block w-full min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                >
                  <div className="grid min-w-0 grid-cols-[5.5rem_minmax(0,1fr)] gap-3 p-3 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-4 sm:p-4">
                    <div className="stretching-image-surface aspect-[4/3]">
                      <StretchImage
                        src={stretch.image || PLACEHOLDER_IMAGE}
                        alt=""
                        className="h-full w-full object-contain object-center transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transform-none"
                        sizes="(min-width: 640px) 112px, 88px"
                      />
                    </div>

                    <div className="min-w-0 self-center">
                      <div className="flex min-w-0 items-start gap-2">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {index + 1}
                        </span>
                        <h4 className="min-w-0 font-semibold leading-snug text-foreground">
                          {stretch.name}
                        </h4>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                        {stretch.description}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <span>{formatTime(stretch.duration)} each</span>
                        {(stretch.repetitions || 1) > 1 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>
                              {stretch.repetitions === 2
                                ? "Left side · Right side"
                                : `${stretch.repetitions} rounds`}
                            </span>
                          </>
                        )}
                        {stretch.targetAreas &&
                          stretch.targetAreas.length > 0 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>
                                {stretch.targetAreas.slice(0, 2).join(", ")}
                              </span>
                            </>
                          )}
                      </div>
                      {stretch.progressions &&
                        stretch.progressions.length > 0 && (
                          <p className="mt-2 line-clamp-1 text-xs text-primary">
                            Next level:{" "}
                            {stretch.progressions.find(
                              (progression) =>
                                progression.tier === "harder" ||
                                progression.tier === "hardest",
                            )?.name ?? "Progression available"}
                          </p>
                        )}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {selectedStretch && selectedStretchIndex !== null && (
        <StretchPreviewDialog
          index={selectedStretchIndex}
          onClose={() => setSelectedStretchIndex(null)}
          stretch={selectedStretch}
          total={routine.stretches.length}
        />
      )}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-[max(1rem,env(safe-area-inset-left))] pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_hsl(var(--foreground)/0.08)] backdrop-blur sm:hidden">
        <button
          type="button"
          onClick={onBegin}
          className="tool-button mx-auto flex w-full max-w-xl py-3 text-base"
        >
          Begin routine
        </button>
      </div>
    </div>
  );
}
