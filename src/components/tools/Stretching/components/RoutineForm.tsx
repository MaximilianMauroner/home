import { useState } from "react";
import type {
  Stretch,
  StretchRoutine,
} from "@/components/tools/Stretching/types";
import { formatTime } from "@/components/tools/Stretching/utils";
import {
  buildRoutineDraft,
  summarizeRoutine,
} from "@/components/tools/Stretching/studioHelpers";

interface RoutineFormProps {
  routine: StretchRoutine | null;
  stretches: Stretch[];
  onSubmit: (routine: Omit<StretchRoutine, "id">) => void;
  onCancel: () => void;
}

export function RoutineForm({
  routine,
  stretches,
  onSubmit,
  onCancel,
}: RoutineFormProps) {
  const [name, setName] = useState(routine?.name ?? "");
  const [goal, setGoal] = useState(routine?.goal ?? "");
  const summary = summarizeRoutine(stretches);
  const isDirty =
    name !== (routine?.name ?? "") || goal !== (routine?.goal ?? "");

  const requestCancel = () => {
    if (isDirty && !window.confirm("Discard your unsaved routine changes?")) {
      return;
    }
    onCancel();
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !goal.trim()) return;
    onSubmit(buildRoutineDraft(routine, { name, goal }, stretches));
  };

  return (
    <form onSubmit={handleSubmit} className="min-w-0 pb-24 sm:pb-0">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            Routine Studio
          </p>
          <h3 className="truncate text-xl font-semibold text-foreground">
            {routine ? "Edit routine" : "Create routine"}
          </h3>
        </div>
        <button
          type="button"
          onClick={requestCancel}
          aria-label="Close routine form"
          className="min-h-11 min-w-11 rounded-full text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          ✕
        </button>
      </header>

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <fieldset className="min-w-0 space-y-5 rounded-2xl border border-border/60 p-4 sm:p-5">
          <legend className="px-2 text-sm font-semibold text-foreground">
            Basics
          </legend>
          <div>
            <label
              htmlFor="routine-name"
              className="mb-2 block text-sm font-medium"
            >
              Routine name
            </label>
            <input
              id="routine-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              autoFocus
              placeholder="Morning mobility flow"
              className="min-h-11 w-full min-w-0 rounded-xl border border-border bg-background px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>
          <div>
            <label
              htmlFor="routine-goal"
              className="mb-2 block text-sm font-medium"
            >
              Goal or description
            </label>
            <textarea
              id="routine-goal"
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              required
              rows={4}
              placeholder="A gentle reset for joints and posture."
              className="w-full min-w-0 resize-y rounded-xl border border-border bg-background px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>
          {routine &&
            (routine.category ||
              routine.difficulty ||
              routine.tags?.length) && (
              <p className="text-xs leading-relaxed text-muted-foreground">
                Existing category, difficulty, and tags are retained when you
                save.
              </p>
            )}
        </fieldset>

        <aside
          className="h-fit rounded-2xl bg-muted/40 p-5"
          aria-label="Routine summary"
        >
          <h4 className="mb-4 text-sm font-semibold text-foreground">
            Routine summary
          </h4>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Duration</dt>
              <dd className="font-medium">
                {formatTime(summary.totalDuration)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Stretches</dt>
              <dd className="font-medium">{summary.stretchCount}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Steps</dt>
              <dd className="font-medium">{summary.totalSteps}</dd>
            </div>
          </dl>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 flex gap-3 border-t border-border bg-card/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur sm:static sm:mt-6 sm:justify-end sm:border-0 sm:bg-transparent sm:p-0">
        <button
          type="button"
          onClick={requestCancel}
          className="min-h-11 flex-1 rounded-xl bg-secondary px-5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:flex-none"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="min-h-11 flex-1 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:flex-none"
        >
          {routine ? "Save changes" : "Create routine"}
        </button>
      </div>
    </form>
  );
}
