import { useCallback, useEffect, useRef, useState } from "react";
import {
  formatCoordinates,
  formatDateRange,
  formatDistance,
  journeySummary,
} from "./journey-data";
import JourneyMap, { type MapMode } from "./JourneyMap";
import type { Track } from "./gpx";
import {
  distanceKm,
  type JourneyPhase,
  type JourneyStop,
  type JourneyTimeline,
  type TimelineState,
} from "./timeline";
import type { JourneyPhoto } from "./types";
import { usePhotoPreload } from "./usePhotoPreload";

const CARD_PHASES = new Set<JourneyPhase>(["overview", "intro", "day", "outro", "complete"]);
/** The photo's size while it waits on its pin. The frame keeps its own shape inside these bounds. */
const TILE = { width: 76, height: 56 };
const pad = (value: number) => String(value).padStart(2, "0");
const clamp = (value: number) => Math.min(1, Math.max(0, value));
/** Moving time from the track, compact enough for a stat tile: "24 min" or "8 h 24 min". */
function formatMoving(totalSeconds: number) {
  const minutes = Math.round(totalSeconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${pad(minutes % 60)} min`;
}

export default function JourneyStage({
  photos,
  stops,
  track,
  summary,
  activeIndex,
  state,
  timeline,
  playing,
  reducedMotion,
  mapMode,
  kenBurns,
  title,
  speed,
  seekVersion,
  onTerrainState,
  onEngineFailed,
}: {
  photos: JourneyPhoto[];
  stops: JourneyStop[];
  track?: Track;
  summary: ReturnType<typeof journeySummary>;
  activeIndex: number;
  state: TimelineState;
  timeline: JourneyTimeline;
  playing: boolean;
  reducedMotion: boolean;
  mapMode: MapMode;
  kenBurns: boolean;
  title: string;
  speed: number;
  seekVersion: number;
  onTerrainState?: (state: { loading: boolean; failed: boolean }) => void;
  onEngineFailed?: () => void;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [marker, setMarker] = useState<{ x: number; y: number } | null>(null);
  const photo = photos[activeIndex];
  const stop = stops[activeIndex];
  const burst = timeline.stops[activeIndex]?.burst ?? false;
  const card = CARD_PHASES.has(state.phase);
  const traveling = state.phase === "approach";
  const expanded = !card && (reducedMotion || !traveling);
  usePhotoPreload(photos, activeIndex);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const onMarkerPosition = useCallback(
    (position: { x: number; y: number } | null) => {
      // Keep the last full-map position while the inset is resized for the reveal.
      if (state.phase !== "approach") return;
      const box = viewport.current?.getBoundingClientRect();
      // The map reports page coordinates; the hero is placed inside the stage.
      setMarker(position && box ? { x: position.x - box.left, y: position.y - box.top } : null);
    },
    [state.phase],
  );
  // While the camera travels, the photo waits as a small tile on its map pin and grows from there.
  // The whole move runs off the playback clock. A CSS transition cannot do this: the tile has to
  // track the pin exactly while the map flies, and a transition retargeted every frame drags
  // behind it. Growth is 0 on the pin and 1 filling the stage.
  const measured = size.width > 1 && size.height > 1;
  // A stop's index advances the moment its leg starts, so the photo mounted during the leg is
  // already the next one. It has to stay a tile on its own pin for the whole leg: opening it, or
  // folding it down from full size, shows the picture at a place it was not taken.
  const growth = !measured || reducedMotion || card || !state.approachDuration
    ? 1
    : state.phase === "approach"
      ? 0
      : state.phase === "reveal"
        ? clamp(state.phaseProgress)
        : 1;
  // One scale for both axes. Separate factors would squash the photo into the tile's shape and
  // then unsquash it during the grow, which reads as the picture moving inside its own frame.
  const tile = Math.min(TILE.width / size.width, TILE.height / size.height);
  const eased = 1 - (1 - growth) ** 3;
  const scale = tile + (1 - tile) * eased;
  const pinX = marker?.x ?? size.width / 2;
  const pinY = marker?.y ?? size.height / 2;
  // The frame's centre travels from the pin to the middle of the stage as it grows.
  const centerX = pinX + (size.width / 2 - pinX) * eased;
  const centerY = pinY + (size.height / 2 - pinY) * eased;
  const transform =
    growth === 1
      ? "none"
      : `translate(${centerX - (size.width * scale) / 2}px, ${centerY - (size.height * scale) / 2}px) scale(${scale})`;
  const previous = stops[activeIndex - 1]?.coordinates;
  const legKm =
    traveling && previous && stop?.coordinates
      ? distanceKm(previous, stop.coordinates)
      : undefined;
  return (
    <div
      ref={viewport}
      className="pj-viewport"
      data-hero={expanded ? "expanded" : "collapsed"}
      data-map={summary.locatedCount ? "on" : "off"}
      data-card={card}
      data-ken-burns={kenBurns && !reducedMotion && state.phase === "hold"}
      data-playing={playing}
      data-burst={burst}
    >
      <div
        className="pj-map"
        role="region"
        aria-label={
          summary.locatedCount
            ? "Map of photo locations"
            : "No photo locations available"
        }
      >
        <JourneyMap
          photos={photos}
          activeIndex={activeIndex}
          stops={stops}
          track={track}
          reducedMotion={reducedMotion}
          phase={state.phase}
          approachDuration={state.approachDuration}
          mapMode={mapMode}
          playing={playing}
          speed={speed}
          seekVersion={seekVersion}
          frame={size}
          onMarkerPosition={onMarkerPosition}
          onTerrainState={onTerrainState}
          onEngineFailed={onEngineFailed}
        />
        {!summary.locatedCount && (
          <div className="pj-map-empty">
            <strong>No GPS coordinates</strong>
            <span>The photos play as a slideshow.</span>
          </div>
        )}
      </div>
      {photo && (
        <div
          className="pj-hero"
          style={{
            transform,
            // A dark tint of the photo's own colour fills the letterbox around mixed aspect ratios.
            backgroundColor: photo.dominantColor
              ? `color-mix(in oklch, ${photo.dominantColor} 26%, #05090b)`
              : undefined,
          }}
        >
          {burst && !reducedMotion && photos[activeIndex - 1] && (
            <img
              className="pj-burst-previous"
              src={photos[activeIndex - 1].thumbnailUrl}
              alt=""
            />
          )}
          <img
            key={photo.id}
            className="pj-hero-img"
            src={photo.url}
            alt={photo.name}
          />
        </div>
      )}
      {photo && !card && (
        <Caption photo={photo} located={stop?.located ?? false} />
      )}
      {photo && traveling && !reducedMotion && (
        <div className="pj-travel" aria-hidden="true">
          <span className="pj-label">Next stop</span>
          <strong>{photo.metadata.place ?? photo.name}</strong>
          {legKm !== undefined && <span className="pj-travel-distance">{formatDistance(legKm)}</span>}
        </div>
      )}
      {card && (
        <JourneyCard
          phase={state.phase}
          dayLabel={state.dayLabel}
          title={title}
          summary={summary}
        />
      )}
      {photo && !card && (
        <div className="pj-counter" aria-hidden="true">
          {pad(activeIndex + 1)} <span>/ {pad(photos.length)}</span>
        </div>
      )}
    </div>
  );
}

function Caption({ photo, located }: { photo: JourneyPhoto; located: boolean }) {
  const { metadata } = photo;
  const exposure = [metadata.focalLength, metadata.aperture, metadata.shutterSpeed, metadata.iso]
    .filter(Boolean)
    .join("  ");
  const facts = [metadata.capturedAtLabel, metadata.camera, exposure].filter(Boolean);
  const place = !located
    ? "No GPS in this photo"
    : (metadata.place ??
      (metadata.coordinates && formatCoordinates(metadata.coordinates)));
  return (
    <div className="pj-caption" aria-hidden="true">
      <p className="pj-caption-place" data-located={located}>{place}</p>
      <h2>{photo.name}</h2>
      {facts.length > 0 && (
        <p className="pj-caption-facts">
          {facts.map((fact) => (
            <span key={fact}>{fact}</span>
          ))}
        </p>
      )}
    </div>
  );
}

function JourneyCard({
  phase,
  dayLabel,
  title,
  summary,
}: {
  phase: JourneyPhase;
  dayLabel?: string;
  title: string;
  summary: ReturnType<typeof journeySummary>;
}) {
  if (phase === "day")
    return (
      <div className="pj-card" data-kind="day">
        <span className="pj-label">Next day</span>
        <h2>{dayLabel}</h2>
      </div>
    );
  const closing = phase === "outro" || phase === "complete";
  const dates = formatDateRange(summary.startDate, summary.endDate);
  const altitude =
    summary.altitudeMin === undefined
      ? undefined
      : `${Math.round(summary.altitudeMin)}–${Math.round(summary.altitudeMax ?? summary.altitudeMin)} m`;
  // A recorded track knows the climb, the high point and the moving time; without one the
  // photo altitudes are the best estimate.
  const trackStats = summary.track;
  return (
    <div className="pj-card" data-kind={closing ? "outro" : "intro"}>
      <span className="pj-label">{closing ? "Journey complete" : "Photo journey"}</span>
      <h2>{title.trim() || "A journey in photographs"}</h2>
      {dates && <p className="pj-card-dates">{dates}</p>}
      <dl className="pj-card-stats">
        <div>
          <dt>Photos</dt>
          <dd>{summary.photoCount}</dd>
        </div>
        <div>
          <dt>Located</dt>
          <dd>{summary.locatedCount}</dd>
        </div>
        <div>
          <dt>Distance</dt>
          <dd>{formatDistance(summary.distanceKm)}</dd>
        </div>
        {summary.tripDays > 0 && (
          <div>
            <dt>Days</dt>
            <dd>{summary.tripDays}</dd>
          </div>
        )}
        {closing && trackStats && trackStats.ascentM >= 20 && (
          <div>
            <dt>Ascent</dt>
            <dd>{Math.round(trackStats.ascentM).toLocaleString("en")} m</dd>
          </div>
        )}
        {closing && trackStats?.maxElevation !== undefined && (
          <div>
            <dt>High point</dt>
            <dd>{Math.round(trackStats.maxElevation).toLocaleString("en")} m</dd>
          </div>
        )}
        {closing && trackStats && trackStats.movingSeconds >= 60 && (
          <div>
            <dt>Moving</dt>
            <dd>{formatMoving(trackStats.movingSeconds)}</dd>
          </div>
        )}
        {closing && !trackStats && altitude && (
          <div>
            <dt>Altitude</dt>
            <dd>{altitude}</dd>
          </div>
        )}
      </dl>
      {closing && summary.cameras.length > 0 && (
        <p className="pj-card-dates">{summary.cameras.join(" · ")}</p>
      )}
    </div>
  );
}
