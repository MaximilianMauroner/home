import { useState } from "react";
import type {
  Stretch,
  StretchRoutine,
} from "@/components/tools/Stretching/types";
import { formatTime } from "@/components/tools/Stretching/utils";

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
  const [name, setName] = useState(routine?.name || "");
  const [goal, setGoal] = useState(routine?.goal || "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !goal.trim()) {
      alert("Please fill in all required fields");
      return;
    }
    const totalDuration = stretches.reduce((total, s) => {
      const reps = s.repetitions || 1;
      return total + s.duration * reps;
    }, 0);

    onSubmit({
      name: name.trim(),
      goal: goal.trim(),
      totalDuration,
      stretches: stretches.map((s) => ({
        ...s,
        id: s.id.split("_").pop() || s.id,
      })),
    });
  };

  const totalDuration = stretches.reduce((total, s) => {
    const reps = s.repetitions || 1;
    return total + s.duration * reps;
  }, 0);

  return (
    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-bold sm:text-xl">
          {routine ? "Edit Routine" : "Create New Routine"}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Close routine form"
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          ✕
        </button>
      </div>

      <div>
        <label
          htmlFor="routine-name"
          className="mb-2 block text-sm font-semibold text-foreground"
        >
          Routine Name *
        </label>
        <input
          id="routine-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="e.g., Morning Mobility Flow"
          className="w-full rounded-xl border border-border bg-background px-4 py-3 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      <div>
        <label
          htmlFor="routine-goal"
          className="mb-2 block text-sm font-semibold text-foreground"
        >
          Goal / Description *
        </label>
        <textarea
          id="routine-goal"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          required
          rows={2}
          placeholder="e.g., Gentle 8-minute reset routine to wake up joints and posture."
          className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      <div className="rounded-xl border border-border/50 bg-muted/30 p-4">
        <div className="mb-2 text-sm font-semibold text-foreground">
          Routine Summary
        </div>
        <div className="space-y-1 text-sm text-muted-foreground">
          <div>
            Total Duration:{" "}
            <span className="font-semibold text-foreground">
              {formatTime(totalDuration)}
            </span>
          </div>
          <div>
            Number of Stretches:{" "}
            <span className="font-semibold text-foreground">
              {stretches.length}
            </span>
          </div>
          <div>
            Total Steps:{" "}
            <span className="font-semibold text-foreground">
              {stretches.reduce((total, s) => total + (s.repetitions || 1), 0)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:gap-3">
        <button
          type="submit"
          className="min-h-[48px] flex-1 touch-manipulation rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          {routine ? "✓ Update Routine" : "+ Create Routine"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-[48px] flex-1 touch-manipulation rounded-xl bg-secondary/80 px-5 py-3 text-sm font-medium text-secondary-foreground shadow-sm transition-colors hover:bg-secondary active:bg-secondary/70 sm:flex-none"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
