import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  formatDayKeyRange,
  formatDateRange,
  formatDistance,
  journeySummary,
} from "./journey-data";
import JourneyMap, { type MapMode } from "./JourneyMap";
import JourneyFilmstrip from "./JourneyFilmstrip";
import { normalizeTimezone } from "./days";
import { burstPhotoProgress, journeyMotion } from "./motion";
import type { Track } from "./gpx";
import type { RouteStory } from "./route-progress";
import {
  type JourneyPhase,
  type JourneyStop,
  type JourneyTimeline,
  type TimelineState,
} from "./timeline";
import type { JourneyPhoto } from "./types";
import type { Placement } from "./track";
import { usePhotoPreload } from "./usePhotoPreload";

const CARD_PHASES = new Set<JourneyPhase>([
  "overview",
  "intro",
  "day",
  "outro",
  "complete",
]);
const MAP_PADDING = { top: 0, right: 0, bottom: 0, left: 0 };
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
  routeStory,
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
  onPlaybackReady,
  onPause,
  onSelect,
  onContinue,
}: {
  photos: JourneyPhoto[];
  stops: JourneyStop[];
  track?: Track;
  routeStory?: RouteStory;
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
  onPlaybackReady?: (ready: boolean) => void;
  onPause: () => void;
  onSelect: (index: number) => void;
  onContinue: () => void;
}) {
  const mapFrame = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [followSuspended, setFollowSuspended] = useState(false);
  const [mobileView, setMobileView] = useState<"photo" | "map">("photo");
  const [previewFailed, setPreviewFailed] = useState<string>();
  const [originalFailed, setOriginalFailed] = useState<string>();
  // The playback clock selects the photo, with an index fallback for the initial state.
  const timelineIndex = photos[state.photoIndex]
    ? state.photoIndex
    : activeIndex;
  const card = CARD_PHASES.has(state.phase);
  const traveling = state.phase === "approach";
  // Keep the last photo in view while the route continues toward the next one.
  // The destination still owns the clock, route progress, and camera; only presentation lags.
  const previousCheckpoint =
    traveling && !state.dayChange
      ? timeline.stops[state.checkpointIndex - 1]
      : undefined;
  const transitionCheckpoint = !state.dayChange
    ? timeline.stops[state.checkpointIndex - 1]
    : undefined;
  const presentationIndex =
    previousCheckpoint?.photoIndices.at(-1) ?? timelineIndex;
  const transitionPhotoIndex = transitionCheckpoint?.photoIndices.at(-1);
  const transitionPhoto =
    transitionPhotoIndex === undefined
      ? undefined
      : photos[transitionPhotoIndex];
  const photo = photos[presentationIndex];
  const phase = state.phase;
  const motion = journeyMotion(state, reducedMotion);
  const hasMapData = summary.locatedCount > 0 || Boolean(track?.points.length);
  const dayChange = state.dayChange;
  const retainedPreloadIndex =
    state.phase === "reveal" && transitionPhotoIndex !== undefined
      ? transitionPhotoIndex
      : presentationIndex;
  const preload = usePhotoPreload(photos, timelineIndex, retainedPreloadIndex);
  const originalStatus = preload.statusFor(photo?.url);
  const transitionOriginalStatus = preload.statusFor(transitionPhoto?.url);
  const checkpoint =
    previousCheckpoint ?? timeline.stops[state.checkpointIndex];
  const checkpointPresentationProgress = motion.checkpoint;
  const placement = placements?.[presentationIndex];
  const originalError =
    originalStatus === "error" || originalFailed === photo?.id;
  const photoProgress =
    !playing || traveling || card
      ? 1
      : state.phase === "reveal" && transitionPhoto
        ? motion.photoTransition
        : burstPhotoProgress(
            state,
            checkpoint?.photoIndices.indexOf(timelineIndex) ?? 0,
            reducedMotion,
          );
  const previousPhoto =
    state.phase === "reveal" ? transitionPhoto : photos[presentationIndex - 1];
  const clock = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: normalizeTimezone(timezone),
      }),
    [timezone],
  );
  const capturedAt =
    placement?.instant !== undefined && Number.isFinite(placement.instant)
      ? clock.format(placement.instant)
      : (photo?.metadata.capturedAtLabel ?? "Time unknown");
  const locationLabel =
    placement?.source === "track"
      ? "Matched to recording"
      : track?.points.length
        ? "Not matched to recording"
        : stops[presentationIndex]?.located
          ? "Photo location"
          : "Location unknown";
  const place =
    placement?.source === "track"
      ? placement.discrepancyM !== undefined && placement.discrepancyM <= 60
        ? photo?.metadata.place
        : undefined
      : !track?.points.length && stops[presentationIndex]?.located
        ? photo?.metadata.place
        : undefined;
  const suspendFollow = useCallback(() => {
    setFollowSuspended(true);
    onPause();
  }, [onPause]);
  const selectCheckpoint = useCallback(
    (index: number) => {
      onPause();
      onSelect(index);
      setMobileView("photo");
    },
    [onPause, onSelect],
  );
  useEffect(() => {
    const element = mapFrame.current;
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
  return (
    <div className="pj-album">
      <div
        className="pj-viewport"
        data-mobile-view={photos.length ? mobileView : "map"}
        data-photos={photos.length > 0}
        data-map={hasMapData ? "on" : "off"}
        data-card={card}
        data-playing={playing}
        data-phase={phase}
      >
        <div
          ref={mapFrame}
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
            routeStory={routeStory}
            reducedMotion={reducedMotion}
            phase={state.phase}
            dayChange={dayChange}
            approachDuration={state.approachDuration}
            phaseRemaining={state.phaseRemaining}
            currentLegProgress={motion.leg}
            currentLegEligible={state.currentLegEligible}
            dayChanges={timeline.dayChanges}
            placements={placements}
            mapMode={mapMode}
            playing={playing}
            speed={speed}
            seekVersion={seekVersion}
            frame={size}
            onTerrainState={onTerrainState}
            onEngineFailed={onEngineFailed}
            onPlaybackReady={onPlaybackReady}
            timeline={timeline}
            cameraPadding={MAP_PADDING}
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
        {photo && (
          <section className="pj-album-photo" aria-label="Current photo">
            {photoProgress < 1 && previousPhoto && (
              <img
                className="pj-album-image"
                src={
                  state.phase === "reveal" &&
                  transitionOriginalStatus === "ready"
                    ? previousPhoto.url
                    : previousPhoto.thumbnailUrl
                }
                alt=""
                aria-hidden="true"
              />
            )}
            <div
              className="pj-album-current"
              style={{ opacity: photoProgress }}
            >
              {previewFailed === photo.id ? (
                <div
                  className="pj-photo-fallback"
                  role="img"
                  aria-label={`${photo.name}; preview unavailable`}
                >
                  <span>Preview unavailable</span>
                </div>
              ) : (
                <img
                  className="pj-album-image"
                  src={photo.thumbnailUrl}
                  alt={photo.name}
                  onError={() => setPreviewFailed(photo.id)}
                />
              )}
              {originalStatus === "ready" && !originalError && (
                <img
                  className="pj-album-image"
                  src={photo.url}
                  alt=""
                  onError={() => setOriginalFailed(photo.id)}
                />
              )}
            </div>
            {originalError && (
              <p className="pj-photo-status" role="status">
                Original unavailable; showing preview.
              </p>
            )}
            {!card && (
              <a
                className="pj-full-resolution"
                href={photo.url}
                target="_blank"
                rel="noreferrer"
                onClick={onPause}
              >
                Full resolution
              </a>
            )}
          </section>
        )}
        {followSuspended && (
          <button
            className="pj-resume-follow"
            onClick={() => {
              setFollowSuspended(false);
              onContinue();
            }}
          >
            Resume journey
          </button>
        )}
        {card && (
          <JourneyCard
            phase={state.phase}
            dayLabel={state.dayLabel}
            title={title}
            timezone={timezone}
            summary={summary}
            progress={motion.card}
            backdropProgress={motion.cardBackdrop}
          />
        )}
        {photo && !card && (
          <div className="pj-counter" aria-hidden="true">
            {pad(presentationIndex + 1)} <span>/ {pad(photos.length)}</span>
          </div>
        )}
      </div>
      <div className="pj-album-context">
        <p>
          {photo ? (
            <>
              <span className="pj-album-place">{place ?? photo.name}</span>
              <span>{capturedAt}</span>
              <span className="pj-album-match">{locationLabel}</span>
            </>
          ) : (
            "Recorded route"
          )}
        </p>
        {photos.length > 0 && (
          <div className="pj-album-view" role="group" aria-label="Player view">
            <button
              aria-pressed={mobileView === "photo"}
              onClick={() => setMobileView("photo")}
            >
              Photo
            </button>
            <button
              aria-pressed={mobileView === "map"}
              onClick={() => setMobileView("map")}
            >
              Map
            </button>
          </div>
        )}
      </div>
      <JourneyFilmstrip
        photos={photos}
        placements={placements}
        timezone={timezone}
        activeIndex={presentationIndex}
        onSelect={selectCheckpoint}
      />
    </div>
  );
}

function JourneyCard({
  phase,
  dayLabel,
  title,
  timezone,
  summary,
  progress,
  backdropProgress,
}: {
  phase: JourneyPhase;
  dayLabel?: string;
  title: string;
  timezone: string;
  summary: ReturnType<typeof journeySummary>;
  progress: number;
  backdropProgress: number;
}) {
  if (phase === "day")
    return (
      <div
        className="pj-card"
        data-kind="day"
        style={
          {
            "--pj-card-progress": progress,
            "--pj-card-backdrop": backdropProgress,
          } as CSSProperties
        }
      >
        <span className="pj-label">Next day</span>
        <h2>{dayLabel}</h2>
      </div>
    );
  const closing = phase === "outro" || phase === "complete";
  const dates =
    formatDayKeyRange(summary.startDateKey, summary.endDateKey) ??
    formatDateRange(summary.startDate, summary.endDate, timezone);
  const altitude =
    summary.altitudeMin === undefined
      ? undefined
      : `${Math.round(summary.altitudeMin)}–${Math.round(summary.altitudeMax ?? summary.altitudeMin)} m`;
  // A recorded track knows the climb, the high point and the moving time; without one the
  // photo altitudes are the best estimate.
  const trackStats = summary.track;
  return (
    <div
      className="pj-card"
      data-kind={closing ? "outro" : "intro"}
      style={
        {
          "--pj-card-progress": progress,
          "--pj-card-backdrop": backdropProgress,
        } as CSSProperties
      }
    >
      <span className="pj-label">
        {closing ? "Journey complete" : "Photo journey"}
      </span>
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
            <dd>
              {Math.round(trackStats.maxElevation).toLocaleString("en")} m
            </dd>
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
