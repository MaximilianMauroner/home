import { useEffect, useRef, useState } from "react";
import {
  formatCoordinates,
  formatDayKeyRange,
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
import type { Placement } from "./track";
import { usePhotoPreload } from "./usePhotoPreload";

const CARD_PHASES = new Set<JourneyPhase>(["overview", "intro", "day", "outro", "complete"]);
const pad = (value: number) => String(value).padStart(2, "0");
const clamp = (value: number) => Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
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
  placements,
  summary,
  activeIndex,
  state,
  timeline,
  playing,
  reducedMotion,
  mapMode,
  title,
  timezone = "UTC",
  speed,
  seekVersion,
  onTerrainState,
  onEngineFailed,
}: {
  photos: JourneyPhoto[];
  stops: JourneyStop[];
  track?: Track;
  placements?: readonly Placement[];
  summary: ReturnType<typeof journeySummary>;
  activeIndex: number;
  state: TimelineState;
  timeline: JourneyTimeline;
  playing: boolean;
  reducedMotion: boolean;
  mapMode: MapMode;
  title: string;
  timezone?: string;
  speed: number;
  seekVersion: number;
  onTerrainState?: (state: { loading: boolean; failed: boolean }) => void;
  onEngineFailed?: () => void;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [previewFailure, setPreviewFailure] = useState<string>();
  // The clock is the source of truth during playback. Keep the direct index fallback while the
  // timeline contract lands, and for the empty/initial state.
  const timelineIndex = photos[state.photoIndex] ? state.photoIndex : activeIndex;
  const photo = photos[timelineIndex];
  const stop = stops[timelineIndex];
  const card = CARD_PHASES.has(state.phase);
  const traveling = state.phase === "approach";
  const phase = state.phase;
  const departing = phase === "departure";
  const hasMapData = summary.locatedCount > 0 || Boolean(track?.points.length);
  const dayChange = state.dayChange ?? Boolean(timeline.stops[timelineIndex]?.dayLabel);
  const preload = usePhotoPreload(photos, timelineIndex);
  const originalStatus = preload.statusFor(photo?.url);
  const originalReady = originalStatus === "ready";
  const handoff = card
    ? 0
    : reducedMotion
      ? phase === "approach" || departing ? 0 : 1
      : phase === "reveal"
        ? clamp(state.phaseProgress)
        : departing
          ? 1 - clamp(state.phaseProgress)
          : phase === "hold"
            ? 1
            : 0;
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
  const previous = stops[timelineIndex - 1]?.coordinates;
  const legKm =
    traveling && previous && stop?.coordinates
      ? distanceKm(previous, stop.coordinates)
      : undefined;
  return (
    <div
      ref={viewport}
      className="pj-viewport"
      data-map={hasMapData ? "on" : "off"}
      data-card={card}
      data-playing={playing}
      data-phase={phase}
    >
      <div
        className="pj-map"
        role="region"
        aria-label={
          hasMapData
            ? track?.points.length
              ? "Map of recorded route and photo locations"
              : "Map of photo locations"
            : "No route or photo locations available"
        }
      >
        <JourneyMap
          photos={photos}
          activeIndex={timelineIndex}
          stops={stops}
          track={track}
          reducedMotion={reducedMotion}
          phase={state.phase}
          dayChange={dayChange}
          approachDuration={state.approachDuration}
          phaseRemaining={state.phaseRemaining}
          currentLegProgress={state.currentLegProgress}
          currentLegEligible={state.currentLegEligible}
          legEligibility={timeline.stops.map((entry) => entry.legEligible)}
          dayChanges={timeline.stops.map((entry) => entry.dayChange)}
          placements={placements}
          mapMode={mapMode}
          playing={playing}
          speed={speed}
          seekVersion={seekVersion}
          frame={size}
          onTerrainState={onTerrainState}
          onEngineFailed={onEngineFailed}
        />
        {!hasMapData && (
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
            opacity: handoff,
            visibility: handoff > 0 ? "visible" : "hidden",
            // A dark tint of the photo's own colour fills the letterbox around mixed aspect ratios.
            backgroundColor: photo.dominantColor
              ? `color-mix(in oklch, ${photo.dominantColor} 26%, #05090b)`
              : undefined,
          }}
        >
          {previewFailure !== photo.id ? (
            <img
              key={`${photo.id}:preview`}
              className="pj-hero-preview"
              src={photo.thumbnailUrl}
              // The preview is present for the whole stop, so it carries the name. Naming the
              // original instead would move the accessible name on a decode race.
              alt={photo.name}
              onError={() => setPreviewFailure(photo.id)}
            />
          ) : (
            <div className="pj-photo-fallback" role="img" aria-label={`${photo.name}; preview unavailable`}>
              <span>Preview unavailable</span>
            </div>
          )}
          {originalReady && (
            <a
              className="pj-hero-original-link"
              href={photo.url}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open ${photo.name} at full resolution`}
            >
              <img className="pj-hero-img" src={photo.url} alt="" />
            </a>
          )}
        </div>
      )}
      {/* Outside .pj-hero: that subtree is `visibility: hidden` for most of the timeline, and a
          live region inside a hidden subtree is never announced. */}
      {photo && originalStatus === "error" && (
        <p className="pj-photo-status" role="status">Original image unavailable; showing preview.</p>
      )}
      {photo && !card && (
        <Caption
          photo={photo}
          placement={placements?.[timelineIndex]}
          located={stop?.located ?? false}
          handoff={handoff}
        />
      )}
      {photo && traveling && !reducedMotion && (
        <div className="pj-travel" aria-hidden="true">
          <span className="pj-label">Next stop</span>
          <strong>{placements?.[timelineIndex]?.conflict
            ? placements[timelineIndex]?.source === "photo"
              ? "Photo GPS selected"
              : placements[timelineIndex]?.source === "track"
                ? "Recorded position selected"
                : "Choose a location"
            : placements?.[timelineIndex]?.source === "track"
              ? (photo.metadata.place ?? "Recorded position")
              : photo.metadata.place ?? photo.name}</strong>
          {legKm !== undefined && <span className="pj-travel-distance">{formatDistance(legKm)}</span>}
        </div>
      )}
      {card && (
        <JourneyCard
          phase={state.phase}
          dayLabel={state.dayLabel}
          title={title}
          timezone={timezone}
          summary={summary}
        />
      )}
      {photo && !card && (
        <div className="pj-counter" aria-hidden="true">
          {pad(timelineIndex + 1)} <span>/ {pad(photos.length)}</span>
        </div>
      )}
    </div>
  );
}

function Caption({ photo, placement, located, handoff }: {
  photo: JourneyPhoto;
  placement?: Placement;
  located: boolean;
  handoff: number;
}) {
  const { metadata } = photo;
  const exposure = [metadata.focalLength, metadata.aperture, metadata.shutterSpeed, metadata.iso]
    .filter(Boolean)
    .join("  ");
  const provenance = placement?.source === "track"
    ? "Placed from recording"
    : placement?.source === "photo"
      ? "Photo GPS"
      : placement?.source === "carried"
        ? "Unassigned"
        : undefined;
  const unresolvedClock = Boolean(metadata.capturedAtWallClock && metadata.utcOffsetMinutes === undefined && placement?.instant === undefined);
  const facts = [metadata.capturedAtLabel ? `${metadata.capturedAtLabel}${unresolvedClock ? " · time not resolved" : ""}` : undefined, metadata.camera, exposure, provenance].filter(Boolean);
  const place = placement?.conflict && placement.source === "photo"
    ? "Photo GPS selected · recording differs"
    : placement?.conflict && placement.source === "track"
      ? "Recorded position selected"
      : placement?.conflict
        ? "Location needs a choice"
    : placement?.source === "track"
      ? (metadata.place ?? "Recorded position")
      : placement?.source === "carried"
        ? "Previous position (not this photo)"
        : !located
          ? "No GPS in this photo"
          : (metadata.place ?? (placement?.coordinates && formatCoordinates(placement.coordinates)));
  return (
    <section className="pj-caption" style={{ opacity: handoff, visibility: handoff > 0 ? "visible" : "hidden" }}>
      <p className="pj-caption-place" data-located={located}>{place}</p>
      <h2>{photo.name}</h2>
      {facts.length > 0 && (
        <p className="pj-caption-facts">
          {facts.map((fact) => (
            <span key={fact}>{fact}</span>
          ))}
        </p>
      )}
    </section>
  );
}

function JourneyCard({
  phase,
  dayLabel,
  title,
  timezone,
  summary,
}: {
  phase: JourneyPhase;
  dayLabel?: string;
  title: string;
  timezone: string;
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
  const dates = formatDayKeyRange(summary.startDateKey, summary.endDateKey)
    ?? formatDateRange(summary.startDate, summary.endDate, timezone);
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
