import { Download, Eye, EyeOff, Trash2 } from "lucide-react";
import { memo } from "react";
import { formatDateRange, formatDistance } from "./journey-data";
import { trackStats } from "./gpx";
import type { JourneyRecording } from "./types";

function RecordingList({
  recordings,
  overlappingIds,
  busy,
  onToggle,
  onRemove,
  onDownload,
  timezone,
}: {
  recordings: readonly JourneyRecording[];
  overlappingIds?: ReadonlySet<string>;
  busy: boolean;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onDownload: (recording: JourneyRecording) => void;
  timezone?: string;
}) {
  if (!recordings.length) return null;
  return (
    <section className="pj-panel pj-recordings" aria-label="GPX recordings">
      <header className="pj-panel-head">
        <span className="pj-label">{recordings.length} recording{recordings.length === 1 ? "" : "s"}</span>
        <h2>Recordings</h2>
      </header>
      <ul className="pj-recording-list">
        {recordings.map((recording) => {
          const stats = trackStats(recording.track);
          const dates = formatDateRange(stats.start, stats.end, timezone);
          return (
            <li key={recording.id} data-included={recording.included}>
              <div className="pj-recording-main">
                <strong title={recording.file.name}>{recording.file.name}</strong>
                <small>
                  {recording.included ? "Included" : "Excluded"} · {dates ?? "Time unavailable"} · {stats.pointCount.toLocaleString("en")} points · {formatDistance(stats.distanceKm)}
                </small>
                {overlappingIds?.has(recording.id) && <small className="pj-recording-warning">Included recording overlaps another; distance totals may count it twice</small>}
                {recording.warnings.map((warning) => <small className="pj-recording-warning" key={warning}>{warning}</small>)}
              </div>
              <div className="pj-recording-actions">
                <button disabled={busy} onClick={() => onToggle(recording.id)} aria-label={`${recording.included ? "Exclude" : "Include"} ${recording.file.name}`}>
                  {recording.included ? <Eye /> : <EyeOff />}
                </button>
                <button disabled={busy} onClick={() => onDownload(recording)} aria-label={`Download original ${recording.file.name}`}>
                  <Download />
                </button>
                <button disabled={busy} onClick={() => onRemove(recording.id)} aria-label={`Remove ${recording.file.name}`}>
                  <Trash2 />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default memo(RecordingList);
