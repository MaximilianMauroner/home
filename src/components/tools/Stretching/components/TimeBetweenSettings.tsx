import { useState } from "react";

interface TimeBetweenSettingsProps {
  timeBetween: number;
  onApply: (value: number) => void;
  onCancel: () => void;
}

export function TimeBetweenSettings({
  timeBetween,
  onApply,
  onCancel,
}: TimeBetweenSettingsProps) {
  const presets = [0, 5, 10, 15, 20, 30];
  const [draft, setDraft] = useState(timeBetween);

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/30 sm:items-start sm:justify-end sm:bg-transparent sm:p-6">
      <button
        type="button"
        aria-label="Cancel rest settings"
        onClick={onCancel}
        className="absolute inset-0 h-full w-full cursor-default sm:bg-black/20"
      />
      <section
        aria-describedby="rest-settings-description"
        aria-labelledby="rest-settings-title"
        aria-modal="true"
        className="stretching-sheet relative z-10 w-full rounded-b-none p-5 sm:w-[24rem] sm:rounded-xl sm:p-6"
        role="dialog"
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">
            <span id="rest-settings-title">Rest between steps</span>
          </h3>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close rest settings"
            className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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

        <p
          id="rest-settings-description"
          className="mb-4 text-sm text-muted-foreground"
        >
          This duration applies after each repetition and stretch. Changes take
          effect only when you apply them.
        </p>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => (
              <button
                type="button"
                key={preset}
                onClick={() => setDraft(preset)}
                aria-pressed={draft === preset}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                  draft === preset
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted text-foreground hover:bg-primary/10"
                }`}
              >
                {preset === 0 ? "None" : `${preset}s`}
              </button>
            ))}
          </div>

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
              value={draft}
              onChange={(e) =>
                setDraft(Math.max(0, Number.parseInt(e.target.value, 10) || 0))
              }
              min="0"
              className="w-full rounded-xl border border-border bg-muted px-4 py-3 text-foreground transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <p
              id="rest-duration-help"
              className="mt-2 text-xs text-muted-foreground"
            >
              Rest time to prepare between stretches and repetitions. Set to 0
              for no breaks.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 border-t border-border pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl bg-muted px-4 py-3 font-medium text-foreground transition-colors hover:bg-muted/70"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onApply(draft)}
              className="rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Apply
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
