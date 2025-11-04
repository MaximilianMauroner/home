import { useState } from "react";
import type { Stretch } from "../types";

interface StretchFormProps {
  stretch: Stretch | null;
  onSubmit: (stretch: Omit<Stretch, "id">) => void;
  onCancel: () => void;
}

export function StretchForm({ stretch, onSubmit, onCancel }: StretchFormProps) {
  const [name, setName] = useState(stretch?.name || "");
  const [description, setDescription] = useState(stretch?.description || "");
  const [duration, setDuration] = useState(stretch?.duration || 60);
  const [repetitions, setRepetitions] = useState((stretch as any)?.repetitions || 1);
  const [image, setImage] = useState(stretch?.image || "");
  const [how, setHow] = useState(stretch?.how || "");
  const [lookFor, setLookFor] = useState(stretch?.lookFor || "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      description,
      duration,
      repetitions,
      image: image || undefined,
      how,
      lookFor,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
      <div>
        <label className="block text-sm font-semibold mb-2 text-foreground">Name *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold mb-2 text-foreground">Description *</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          rows={2}
          className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-semibold mb-2 text-foreground">Duration (seconds) *</label>
          <input
            type="number"
            value={duration}
            onChange={(e) => setDuration(parseInt(e.target.value) || 60)}
            required
            min="1"
            className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-2 text-foreground">Repetitions *</label>
          <input
            type="number"
            value={repetitions}
            onChange={(e) => setRepetitions(Math.max(1, parseInt(e.target.value) || 1))}
            required
            min="1"
            className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
          />
          <p className="text-xs text-muted-foreground mt-1">e.g., 2 for left/right leg</p>
        </div>
        <div>
          <label className="block text-sm font-semibold mb-2 text-foreground">Image URL (optional)</label>
          <input
            type="url"
            value={image}
            onChange={(e) => setImage(e.target.value)}
            placeholder="https://..."
            className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-semibold mb-2 text-foreground">What to Do *</label>
        <textarea
          value={how}
          onChange={(e) => setHow(e.target.value)}
          required
          rows={4}
          className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none"
          placeholder="Include instructions and tempo/cues..."
        />
      </div>
      <div>
        <label className="block text-sm font-semibold mb-2 text-foreground">What to Feel *</label>
        <textarea
          value={lookFor}
          onChange={(e) => setLookFor(e.target.value)}
          required
          rows={3}
          className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none"
          placeholder="What sensations and feedback to look for..."
        />
      </div>
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-2">
        <button
          type="submit"
          className="flex-1 px-5 py-3 min-h-[48px] bg-gradient-to-r from-primary to-primary/90 text-primary-foreground rounded-xl hover:from-primary/90 hover:to-primary/80 active:scale-[0.98] transition-all font-semibold text-sm touch-manipulation shadow-lg"
        >
          {stretch ? "✓ Update Stretch" : "+ Add Stretch"}
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

