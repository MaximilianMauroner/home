interface TimeBetweenSettingsProps {
  timeBetween: number;
  onTimeBetweenChange: (value: number) => void;
  onClose: () => void;
}

export function TimeBetweenSettings({ timeBetween, onTimeBetweenChange, onClose }: TimeBetweenSettingsProps) {
  const presets = [0, 5, 10, 15, 20, 30];

  return (
    <div className="bg-card rounded-2xl p-5 sm:p-6 shadow-lg border border-border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Rest Between Stretches</h3>
        <button
          onClick={onClose}
          className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-4">
        {/* Preset buttons */}
        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => (
            <button
              key={preset}
              onClick={() => onTimeBetweenChange(preset)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                timeBetween === preset
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-foreground hover:bg-primary/10"
              }`}
            >
              {preset === 0 ? "None" : `${preset}s`}
            </button>
          ))}
        </div>

        {/* Custom input */}
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            Custom Duration (seconds)
          </label>
          <input
            type="number"
            value={timeBetween}
            onChange={(e) => onTimeBetweenChange(Math.max(0, parseInt(e.target.value) || 0))}
            min="0"
            className="w-full px-4 py-3 bg-muted border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-foreground"
          />
          <p className="text-xs text-muted-foreground mt-2">
            Rest time to prepare between stretches and repetitions. Set to 0 for no breaks.
          </p>
        </div>
      </div>
    </div>
  );
}
