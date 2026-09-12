import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  formatDayKeyRange,
  formatDateRange,
  formatDistance,
  journeySummary,
} from "./journey-data";
import JourneyMap, { type MapMode } from "./JourneyMap";
import PhotoCheckpointDrawer from "./PhotoCheckpointDrawer";
import { drawerLayout } from "./drawer-layout";
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
  onPause,
  onSelect,
  onContinue,
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
  onPause: () => void;
  onSelect: (index: number) => void;
  onContinue: () => void;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [manualCheckpoint, setManualCheckpoint] = useState<number>();
  const [manualClosed, setManualClosed] = useState(false);
  const [followSuspended, setFollowSuspended] = useState(false);
  const [drawerExpanded, setDrawerExpanded] = useState(false);
  const manualTrigger = useRef<HTMLElement | null>(null);
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
  const dayChange = state.dayChange;
  const preload = usePhotoPreload(photos, timelineIndex);
  const originalStatus = preload.statusFor(photo?.url);
  const checkpoint = timeline.stops[state.checkpointIndex];
  const checkpointPhotos = checkpoint?.photoIndices.map((index) => photos[index]).filter(Boolean) ?? [];
  const manualOpen = manualCheckpoint === state.checkpointIndex;
  const drawerPresentationProgress = reducedMotion && phase !== "approach" && !card
    ? 1
    : departing ? 1 - state.phaseProgress : state.drawerProgress;
  const checkpointPresentationProgress = reducedMotion && phase !== "approach" && !card
    ? 1
    : departing ? 1 - state.phaseProgress : state.checkpointProgress;
  const effectiveDrawerProgress = manualOpen && manualClosed ? 0 : drawerPresentationProgress;
  const layout = useMemo(
    () => drawerLayout(size, effectiveDrawerProgress, drawerExpanded),
    [size, effectiveDrawerProgress, drawerExpanded],
  );
  useEffect(() => {
    if (playing) {
      setManualCheckpoint(undefined);
      setManualClosed(false);
      setDrawerExpanded(false);
    }
  }, [playing]);
  const suspendFollow = useCallback(() => {
    setFollowSuspended(true);
    onPause();
  }, [onPause]);
  const selectCheckpoint = useCallback((index: number, trigger?: HTMLElement) => {
    manualTrigger.current = trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    onSelect(index);
    const selected = timeline.stops.find((entry) => entry.photoIndices.includes(index));
    setManualCheckpoint(selected?.checkpointIndex);
    setManualClosed(false);
  }, [onSelect, timeline]);
  const inspectCheckpoint = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) manualTrigger.current = document.activeElement;
    onPause();
    setManualCheckpoint(state.checkpointIndex);
    setManualClosed(false);
  }, [onPause, state.checkpointIndex]);
  const closeManualDrawer = useCallback(() => {
    onPause();
    setManualClosed(true);
    requestAnimationFrame(() => {
      const fallback = viewport.current?.parentElement?.querySelector<HTMLElement>(".pj-play");
      (manualTrigger.current?.isConnected ? manualTrigger.current : fallback)?.focus();
    });
  }, [onPause]);
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
          activeIndex={state.checkpointPhotoIndex}
          stops={stops}
          track={track}
          reducedMotion={reducedMotion}
          phase={state.phase}
          dayChange={dayChange}
          approachDuration={state.approachDuration}
          phaseRemaining={state.phaseRemaining}
          currentLegProgress={state.currentLegProgress}
          currentLegEligible={state.currentLegEligible}
          legEligibility={timeline.legEligibility}
          dayChanges={timeline.dayChanges}
          placements={placements}
          mapMode={mapMode}
          playing={playing}
          speed={speed}
          seekVersion={seekVersion}
          frame={size}
          onTerrainState={onTerrainState}
          onEngineFailed={onEngineFailed}
          timeline={timeline}
          cameraPadding={layout.padding}
          checkpointProgress={checkpointPresentationProgress}
          followSuspended={followSuspended}
          onUserMove={suspendFollow}
          onCheckpointSelect={selectCheckpoint}
        />
        {!hasMapData && (
          <div className="pj-map-empty">
            <strong>No GPS coordinates</strong>
            <span>The photos play as a slideshow.</span>
          </div>
        )}
      </div>
      {photo && !card && (state.drawerProgress > 0 || reducedMotion && phase !== "approach") && <PhotoCheckpointDrawer
        photos={checkpointPhotos}
        activePhotoId={photo.id}
        progress={drawerPresentationProgress}
        imageProgress={reducedMotion ? 1 : state.imageProgress}
        expanded={drawerExpanded}
        width={layout.width}
        height={layout.height}
        manuallyOpened={manualOpen}
        closed={manualOpen && manualClosed}
        originalStatus={originalStatus}
        placement={placements?.[timelineIndex]}
        located={stop?.located ?? false}
        onBrowse={(index) => onSelect(checkpoint!.photoIndices[index])}
        onClose={closeManualDrawer}
        onInteract={inspectCheckpoint}
        onExpandedChange={setDrawerExpanded}
      />}
      {manualOpen && manualClosed && <button className="pj-continue-journey" onClick={() => { setManualCheckpoint(undefined); setManualClosed(false); setDrawerExpanded(false); setFollowSuspended(false); onContinue(); }}>Continue journey</button>}
      {followSuspended && <button className="pj-resume-follow" onClick={() => setFollowSuspended(false)}>Resume follow</button>}
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
