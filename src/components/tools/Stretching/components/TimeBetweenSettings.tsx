interface TimeBetweenSettingsProps {
  timeBetween: number;
  onTimeBetweenChange: (value: number) => void;
  onClose: () => void;
}

export function TimeBetweenSettings({ timeBetween, onTimeBetweenChange, onClose }: TimeBetweenSettingsProps) {
  return (
    <div className="bg-card rounded-2xl p-4 sm:p-6 shadow-lg border border-border/50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Time Between Stretches</h3>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          ✕
        </button>
      </div>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold mb-2 text-foreground">
            Rest Time (seconds)
          </label>
          <input
            type="number"
            value={timeBetween}
            onChange={(e) => onTimeBetweenChange(Math.max(0, parseInt(e.target.value) || 0))}
            min="0"
            className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Time to prepare between stretches and repetitions. Set to 0 to disable.
          </p>
        </div>
      </div>
    </div>
  );
}

