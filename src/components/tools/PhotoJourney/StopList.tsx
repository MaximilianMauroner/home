import { ChevronDown, ChevronUp, Download, Trash2 } from "lucide-react";
import { memo, useMemo } from "react";
import { formatDistance, journeySummary, type ExportFormat } from "./journey-data";
import type { JourneyPhoto } from "./types";

const FORMATS: ExportFormat[] = ["gpx", "geojson", "json"];

/**
 * The playback clock re-renders the tool on every frame. This panel holds one row per photo,
 * so it is memoized and takes only values that change when the journey itself changes.
 */
function StopList({
  photos,
  activeIndex,
  busy,
  onSelect,
  onMove,
  onRemove,
  onExport,
}: {
  photos: JourneyPhoto[];
  activeIndex: number;
  busy: boolean;
  onSelect: (index: number) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onRemove: (id: string) => void;
  onExport: (format: ExportFormat) => void;
}) {
  const summary = useMemo(() => journeySummary(photos), [photos]);
  return (
    <section className="pj-panel pj-stops" aria-label="Journey order">
      <header className="pj-panel-head">
        <span className="pj-label">
          {summary.photoCount} photos · {summary.locatedCount} located · {formatDistance(summary.distanceKm)}
        </span>
        <h2>Stops</h2>
        <div className="pj-exports" aria-label="Export journey">
          <Download size={14} aria-hidden="true" />
          {FORMATS.map((format) => (
            <button key={format} className="pj-pill" data-size="sm" onClick={() => onExport(format)}>
              {format === "geojson" ? "GeoJSON" : format.toUpperCase()}
            </button>
          ))}
        </div>
      </header>
      <ol className="pj-stop-list">
        {photos.map((photo, index) => (
          <li key={photo.id} data-selected={index === activeIndex}>
            <button
              className="pj-stop"
              aria-current={index === activeIndex ? "step" : undefined}
              onClick={() => onSelect(index)}
            >
              <img src={photo.thumbnailUrl} alt="" loading="lazy" />
              <span className="pj-stop-index">{String(index + 1).padStart(2, "0")}</span>
              <span className="pj-stop-text">
                <strong>{photo.name}</strong>
                <small data-located={Boolean(photo.metadata.coordinates)}>
                  {photo.metadata.place ?? "No GPS"}
                  {photo.metadata.capturedAtLabel ? ` · ${photo.metadata.capturedAtLabel}` : ""}
                </small>
              </span>
            </button>
            <div className="pj-stop-actions">
              <button disabled={busy || index === 0} onClick={() => onMove(index, -1)} aria-label={`Move ${photo.name} earlier`}>
                <ChevronUp />
              </button>
              <button disabled={busy || index === photos.length - 1} onClick={() => onMove(index, 1)} aria-label={`Move ${photo.name} later`}>
                <ChevronDown />
              </button>
              <button disabled={busy} onClick={() => onRemove(photo.id)} aria-label={`Remove ${photo.name}`}>
                <Trash2 />
              </button>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default memo(StopList);
