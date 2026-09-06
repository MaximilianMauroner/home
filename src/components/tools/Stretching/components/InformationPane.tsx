import type {
  ProgressionTier,
  Stretch,
} from "@/components/tools/Stretching/types";

const tierLabels: Record<ProgressionTier, string> = {
  easier: "Easier",
  standard: "Standard",
  harder: "Harder",
  hardest: "Hardest",
};

interface InformationPaneProps {
  stretch: Stretch;
  timeBetween: number;
  onEditTimeBetween: () => void;
}

/**
 * The reading half of the session. It owns its own scrollbar so that reading a
 * progression list never moves the pose or the countdown beside it.
 */
export function InformationPane({
  stretch,
  timeBetween,
  onEditTimeBetween,
}: InformationPaneProps) {
  const progressions = stretch.progressions ?? [];

  return (
    <aside
      className="stretching-infopane"
      aria-label={`Guidance for ${stretch.name}`}
    >
      <header className="stretching-infopane__head">
        <h3>Information</h3>
      </header>
      <div className="stretching-infoscroll">
        <section>
          <h4>How to do it</h4>
          <p className="whitespace-pre-line">{stretch.how}</p>
        </section>

        <hr />

        <section>
          <h4>What to feel</h4>
          <p className="whitespace-pre-line">{stretch.lookFor}</p>
        </section>

        {progressions.length > 0 && (
          <>
            <hr />
            <section>
              <h4>Pick your level</h4>
              <ol className="stretching-infoscroll__levels">
                {progressions.map((progression) => (
                  <li key={progression.name}>
                    <span className="stretching-infoscroll__tier">
                      {tierLabels[progression.tier]}
                    </span>
                    <strong>{progression.name}.</strong>{" "}
                    <span>{progression.detail}</span>
                  </li>
                ))}
              </ol>
            </section>
          </>
        )}

        <hr />

        <section>
          <h4>Session settings</h4>
          <button
            type="button"
            onClick={onEditTimeBetween}
            className="stretching-infoscroll__setting"
          >
            Rest between steps
            <span className="tabular-nums text-muted-foreground">
              {timeBetween}s
            </span>
          </button>
          <p className="stretching-infoscroll__keys">
            Space to pause · ← / → to move · R to reset
          </p>
        </section>
      </div>
    </aside>
  );
}
