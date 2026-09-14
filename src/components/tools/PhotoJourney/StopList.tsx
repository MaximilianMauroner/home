import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { Fragment, memo } from "react";
import { formatDistance, type journeySummary } from "./journey-data";
import type { Placement } from "./track";
import type { JourneyPhoto } from "./types";

/**
 * The playback clock re-renders the tool on every frame. This panel holds one row per photo,
 * so it is memoized and takes only values that change when the journey itself changes.
 */
function StopList({
  photos,
  placements,
  summary,
  activeIndex,
  busy,
  editingOrder,
  dayKeys,
  dayLabels,
  onSelect,
  onMove,
  canMove,
  onRemove,
}: {
  photos: JourneyPhoto[];
  placements: readonly Placement[];
  summary: ReturnType<typeof journeySummary>;
  activeIndex: number;
  busy: boolean;
  editingOrder: boolean;
  dayKeys: readonly (string | undefined)[];
  dayLabels: readonly (string | undefined)[];
  onSelect: (index: number) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  canMove: (index: number, direction: -1 | 1) => boolean;
  onRemove: (id: string) => void;
}) {
  return (
    <section className="pj-panel pj-stops" aria-label="Journey order">
      <header className="pj-panel-head">
        <span className="pj-label">
          {summary.photoCount} photos · {summary.locatedCount} located ·{" "}
          {formatDistance(summary.distanceKm)}
        </span>
        <h2>Stops</h2>
      </header>
      <ol className="pj-stop-list">
        {photos.map((photo, index) => {
          const placement = placements[index];
          const dayKey = dayKeys[index];
          const previousDayKey = dayKeys[index - 1];
          const located = placement
            ? placement.source === "photo" || placement.source === "track"
            : Boolean(photo.metadata.coordinates);
          const place = placement?.ambiguous
            ? "Choose a recording"
            : placement?.source === "track"
              ? placement.recordingGap
                ? "Recording gap · last GPX position"
                : "Matched to recording"
              : placement?.source === "carried"
                ? "Previous position · not this photo"
                : summary.track
                  ? "Not matched to recording"
                  : (photo.metadata.place ?? (located ? "Located" : "No GPS"));
          return (
            <Fragment key={photo.id}>
              {dayKey && dayKey !== previousDayKey && (
                <li className="pj-stop-day">
                  <span role="heading" aria-level={3}>
                    {dayLabels[index] ?? dayKey}
                  </span>
                </li>
              )}
              <li data-selected={index === activeIndex}>
                <button
                  className="pj-stop"
                  aria-current={index === activeIndex ? "step" : undefined}
                  onClick={() => onSelect(index)}
                >
                  <img src={photo.thumbnailUrl} alt="" loading="lazy" />
                  <span className="pj-stop-index">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="pj-stop-text">
                    <strong>{photo.name}</strong>
                    <small data-located={located}>
                      {place}
                      {photo.metadata.capturedAtLabel
                        ? ` · ${photo.metadata.capturedAtLabel}${photo.metadata.capturedAtWallClock && photo.metadata.utcOffsetMinutes === undefined && placement?.instant === undefined ? " · time not resolved" : ""}`
                        : ""}
                    </small>
                  </span>
                  {(placement?.ambiguous || placement?.choiceUnavailable) && (
                    <span className="pj-stop-tag" data-conflict="true">
                      {placement.ambiguous ? "overlap" : "review"}
                    </span>
                  )}
                  {placement?.source === "track" &&
                    !placement.ambiguous &&
                    !placement.choiceUnavailable && (
                      <span
                        className="pj-stop-tag"
                        title={
                          placement.recordingGap
                            ? placement.discrepancyM === undefined
                              ? "The capture time is inside a recording gap. The last known GPX position is used."
                              : `The capture time is inside a recording gap. The last known GPX position is used, and the camera GPS differs by ${Math.round(placement.discrepancyM).toLocaleString("en")} m.`
                            : placement.discrepancyM === undefined
                              ? "The recording places this photo by its capture time."
                              : `Matched to the recording by capture time. The camera GPS differs by ${Math.round(placement.discrepancyM).toLocaleString("en")} m.`
                        }
                      >
                        GPX
                      </span>
                    )}
                </button>
                <div className="pj-stop-actions">
                  <button
                    disabled={busy || !editingOrder || !canMove(index, -1)}
                    onClick={() => onMove(index, -1)}
                    aria-label={`Move ${photo.name} earlier`}
                  >
                    <ChevronUp />
                  </button>
                  <button
                    disabled={busy || !editingOrder || !canMove(index, 1)}
                    onClick={() => onMove(index, 1)}
                    aria-label={`Move ${photo.name} later`}
                  >
                    <ChevronDown />
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => onRemove(photo.id)}
                    aria-label={`Remove ${photo.name}`}
                  >
                    <Trash2 />
                  </button>
                </div>
              </li>
            </Fragment>
          );
        })}
      </ol>
    </section>
  );
}

export default memo(StopList);
