import { useState } from "react";
import type { Stretch, StretchRoutine } from "../types";
import { formatTime } from "../utils";

interface RoutineFormProps {
  routine: StretchRoutine | null;
  stretches: Stretch[];
  onSubmit: (routine: Omit<StretchRoutine, "id">) => void;
  onCancel: () => void;
}

export function RoutineForm({ routine, stretches, onSubmit, onCancel }: RoutineFormProps) {
  const [name, setName] = useState(routine?.name || "");
  const [goal, setGoal] = useState(routine?.goal || "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !goal.trim()) {
      alert("Please fill in all required fields");
      return;
    }
    const totalDuration = stretches.reduce((total, s) => {
      const reps = (s as any).repetitions || 1;
      return total + (s.duration * reps);
    }, 0);
    
    onSubmit({
      name: name.trim(),
      goal: goal.trim(),
      totalDuration,
      stretches: stretches.map((s) => ({
        ...s,
        id: s.id.split('_').pop() || s.id,
      })),
    });
  };

  const totalDuration = stretches.reduce((total, s) => {
    const reps = (s as any).repetitions || 1;
    return total + (s.duration * reps);
  }, 0);

  return (
    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg sm:text-xl font-bold">
          {routine ? "Edit Routine" : "Create New Routine"}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          ✕
        </button>
      </div>

      <div>
        <label className="block text-sm font-semibold mb-2 text-foreground">Routine Name *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="e.g., Morning Mobility Flow"
          className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold mb-2 text-foreground">Goal / Description *</label>
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          required
          rows={2}
          placeholder="e.g., Gentle 8-minute reset routine to wake up joints and posture."
          className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none"
        />
      </div>

      <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
        <div className="text-sm font-semibold mb-2 text-foreground">Routine Summary</div>
        <div className="space-y-1 text-sm text-muted-foreground">
          <div>Total Duration: <span className="font-semibold text-foreground">{formatTime(totalDuration)}</span></div>
          <div>Number of Stretches: <span className="font-semibold text-foreground">{stretches.length}</span></div>
          <div>Total Steps: <span className="font-semibold text-foreground">
            {stretches.reduce((total, s) => total + ((s as any).repetitions || 1), 0)}
          </span></div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-2">
        <button
          type="submit"
          className="flex-1 px-5 py-3 min-h-[48px] bg-gradient-to-r from-primary to-primary/90 text-primary-foreground rounded-xl hover:from-primary/90 hover:to-primary/80 active:scale-[0.98] transition-all font-semibold text-sm touch-manipulation shadow-lg"
        >
          {routine ? "✓ Update Routine" : "+ Create Routine"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 sm:flex-none px-5 py-3 min-h-[48px] bg-secondary/80 text-secondary-foreground rounded-xl hover:bg-secondary active:bg-secondary/70 transition-all font-medium text-sm touch-manipulation shadow-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

