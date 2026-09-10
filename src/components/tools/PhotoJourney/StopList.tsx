import { ChevronDown, ChevronUp, Download, Package, Trash2 } from "lucide-react";
import { memo } from "react";
import { formatDistance, type journeySummary, type ExportFormat } from "./journey-data";
import type { Placement } from "./track";
import type { JourneyPhoto } from "./types";

const FORMATS: ExportFormat[] = ["gpx", "geojson", "json"];

function formatBytes(bytes: number) {
  return bytes >= 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${Math.round(bytes / 1e6)} MB`;
}

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
  packing,
  includePhotos,
  photoBytes,
  onSelect,
  onMove,
  onRemove,
  onExport,
  onIncludePhotos,
  onBundle,
}: {
  photos: JourneyPhoto[];
  placements: readonly Placement[];
  summary: ReturnType<typeof journeySummary>;
  activeIndex: number;
  busy: boolean;
  packing: boolean;
  includePhotos: boolean;
  photoBytes: number;
  onSelect: (index: number) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onRemove: (id: string) => void;
  onExport: (format: ExportFormat) => void;
  onIncludePhotos: (value: boolean) => void;
  onBundle: () => void;
}) {
  return (
    <section className="pj-panel pj-stops" aria-label="Journey order">
      <header className="pj-panel-head">
        <span className="pj-label">
          {summary.photoCount} photos · {summary.locatedCount} located · {formatDistance(summary.distanceKm)}
        </span>
        <h2>Stops</h2>
        <div className="pj-download">
          <button className="pj-pill" data-tone="accent" disabled={busy || packing} onClick={onBundle}>
            <Package size={16} aria-hidden="true" />
            {packing ? "Packing…" : "Download everything"}
          </button>
          <label className="pj-pill pj-toggle" data-size="sm">
            <input type="checkbox" checked={includePhotos} onChange={(event) => onIncludePhotos(event.target.checked)} />
            Include the photos ({formatBytes(photoBytes)})
          </label>
        </div>
        <div className="pj-exports" aria-label="Export one file">
          <Download size={14} aria-hidden="true" />
          {FORMATS.map((format) => (
            <button key={format} className="pj-pill" data-size="sm" onClick={() => onExport(format)}>
              {format === "geojson" ? "GeoJSON" : format.toUpperCase()}
            </button>
          ))}
        </div>
      </header>
      <ol className="pj-stop-list">
        {photos.map((photo, index) => {
          const placement = placements[index];
          const located = placement ? placement.source === "photo" || placement.source === "track" : Boolean(photo.metadata.coordinates);
          return (
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
                <small data-located={located}>
                  {photo.metadata.place ?? (located ? "On the track" : "No GPS")}
                  {photo.metadata.capturedAtLabel ? ` · ${photo.metadata.capturedAtLabel}` : ""}
                </small>
              </span>
              {placement?.source === "track" && (
                <span className="pj-stop-tag" title={placement.discrepancyM === undefined
                  ? "This photo has no GPS. The track places it by its timecode."
                  : `The camera's own fix was ${Math.round(placement.discrepancyM).toLocaleString("en")} m away, so the track places it by its timecode.`}>
                  by time
                </span>
              )}
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
          );
        })}
      </ol>
    </section>
  );
}

export default memo(StopList);
