interface TimeBetweenSettingsProps {
  timeBetween: number;
  onTimeBetweenChange: (value: number) => void;
  onClose: () => void;
}

export function TimeBetweenSettings({
  timeBetween,
  onTimeBetweenChange,
  onClose,
}: TimeBetweenSettingsProps) {
  const presets = [0, 5, 10, 15, 20, 30];

  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">
          Rest Between Stretches
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close rest settings"
          className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <div className="space-y-4">
        {/* Preset buttons */}
        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => (
            <button
              type="button"
              key={preset}
              onClick={() => onTimeBetweenChange(preset)}
              aria-pressed={timeBetween === preset}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
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
          <label
            htmlFor="rest-duration"
            className="mb-2 block text-sm font-medium text-muted-foreground"
          >
            Custom Duration (seconds)
          </label>
          <input
            id="rest-duration"
            type="number"
            aria-describedby="rest-duration-help"
            value={timeBetween}
            onChange={(e) =>
              onTimeBetweenChange(Math.max(0, parseInt(e.target.value) || 0))
            }
            min="0"
            className="w-full rounded-xl border border-border bg-muted px-4 py-3 text-foreground transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <p
            id="rest-duration-help"
            className="mt-2 text-xs text-muted-foreground"
          >
            Rest time to prepare between stretches and repetitions. Set to 0 for
            no breaks.
          </p>
        </div>
      </div>
    </div>
  );
}
