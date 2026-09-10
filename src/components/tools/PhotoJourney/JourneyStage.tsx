import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  formatCoordinates,
  formatDateRange,
  formatDistance,
  journeySummary,
} from "./journey-data";
import JourneyMap from "./JourneyMap";
import {
  distanceKm,
  resolveStops,
  type JourneyPhase,
  type JourneyTimeline,
  type TimelineState,
} from "./timeline";
import type { JourneyPhoto } from "./types";
import { usePhotoPreload } from "./usePhotoPreload";

const CARD_PHASES = new Set<JourneyPhase>(["overview", "intro", "day", "outro", "complete"]);
const pad = (value: number) => String(value).padStart(2, "0");

export default function JourneyStage({
  photos,
  activeIndex,
  state,
  timeline,
  playing,
  reducedMotion,
  offline,
  kenBurns,
  title,
  speed,
  seekVersion,
}: {
  photos: JourneyPhoto[];
  activeIndex: number;
  state: TimelineState;
  timeline: JourneyTimeline;
  playing: boolean;
  reducedMotion: boolean;
  offline: boolean;
  kenBurns: boolean;
  title: string;
  speed: number;
  seekVersion: number;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [marker, setMarker] = useState<{ x: number; y: number } | null>(null);
  const stops = useMemo(() => resolveStops(photos), [photos]);
  const summary = useMemo(() => journeySummary(photos), [photos]);
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
      if (state.phase === "approach") setMarker(position);
    },
    [state.phase],
  );
  // While the camera travels, the photo waits as a small tile on its map pin and grows from there.
  const transform =
    expanded || reducedMotion
      ? "none"
      : `translate(${(marker?.x ?? size.width / 2) - 28}px, ${(marker?.y ?? size.height / 2) - 21}px) scale(${56 / size.width}, ${42 / size.height})`;
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
          reducedMotion={reducedMotion}
          phase={state.phase}
          approachDuration={state.approachDuration}
          offline={offline}
          playing={playing}
          speed={speed}
          seekVersion={seekVersion}
          frame={size}
          onMarkerPosition={onMarkerPosition}
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
        {closing && altitude && (
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
