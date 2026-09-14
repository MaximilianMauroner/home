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
import {
  recordedElevationProfile,
  recordedDepartureProgressStats,
  recordedPhotoProgressStats,
  recordedProgressStats,
  type RecordedElevationProfile,
  type RecordedProgressStats,
  type RouteStory,
} from "./route-progress";
import { localDisplayMoment, photoDisplayMoment } from "./time-display";
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
const DESKTOP_PHOTO_SHARE = 0.5;
const pad = (value: number) => String(value).padStart(2, "0");
/** Moving time from the track, compact enough for a stat tile: "24 min" or "8 h 24 min". */
function formatMoving(totalSeconds: number) {
  const minutes = Math.round(totalSeconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${pad(minutes % 60)} min`;
}

function formatElapsed(totalSeconds: number | undefined) {
  if (totalSeconds === undefined) return "—";
  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}:${pad(minutes)}:${pad(seconds % 60)}`;
}

function formatTrailDistance(distanceKm: number) {
  return `${distanceKm.toFixed(distanceKm < 10 ? 2 : 1)} km`;
}

function formatPace(stats: RecordedProgressStats) {
  if (stats.distanceKm < 0.05 || stats.movingSeconds < 30) return "—";
  const seconds = Math.round(stats.movingSeconds / stats.distanceKm);
  return `${Math.floor(seconds / 60)}:${pad(seconds % 60)} /km`;
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
  const traveling = state.phase === "approach" || state.phase === "trail";
  const transitionCheckpoint = !state.dayChange
    ? timeline.stops[state.checkpointIndex - 1]
    : undefined;
  const presentationIndex = timelineIndex;
  const transitionPhotoIndex = transitionCheckpoint?.photoIndices.at(-1);
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
  const checkpoint = timeline.stops[state.checkpointIndex];
  const checkpointPresentationProgress = motion.checkpoint;
  const placement = placements?.[presentationIndex];
  const targetPlacement = placements?.[state.checkpointPhotoIndex];
  const trailStats =
    traveling && state.currentLegEligible
      ? state.phase === "trail"
        ? recordedDepartureProgressStats(
            routeStory,
            state.checkpointPhotoIndex,
            motion.leg,
          )
        : recordedProgressStats(
            routeStory,
            state.checkpointPhotoIndex,
            motion.leg,
          )
      : undefined;
  const photoStats =
    !traveling && !card && photo
      ? recordedPhotoProgressStats(routeStory, presentationIndex)
      : undefined;
  const progressStats = traveling ? trailStats : photoStats;
  const progressPhotoIndex = traveling
    ? state.checkpointPhotoIndex
    : presentationIndex;
  const elevationProfile = progressStats
    ? recordedElevationProfile(
        routeStory,
        progressPhotoIndex,
        progressStats.distanceKm,
      )
    : undefined;
  const showTrailProgress = traveling && progressStats !== undefined;
  const originalError =
    originalStatus === "error" || originalFailed === photo?.id;
  const panelProgress = !playing && state.panelVisible ? 1 : motion.panel;
  const cameraPadding = useMemo(
    () => ({
      top: 0,
      right: 0,
      bottom: showTrailProgress ? (size.width > 640 ? 220 : 205) : 0,
      left:
        size.width > 640
          ? Math.round(size.width * DESKTOP_PHOTO_SHARE * panelProgress)
          : 0,
    }),
    [panelProgress, showTrailProgress, size.width],
  );
  const photoProgress =
    !playing || traveling || card
      ? 1
      : burstPhotoProgress(
          state,
          checkpoint?.photoIndices.indexOf(timelineIndex) ?? 0,
          reducedMotion,
        );
  const previousPhoto =
    state.phase === "reveal" ? undefined : photos[presentationIndex - 1];
  const captureMoment = photo
    ? photoDisplayMoment(
        photo.metadata,
        placement?.instant,
        placement?.offsetMinutes,
        timezone,
      )
    : undefined;
  const captureClock = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: captureMoment?.timeZone ?? normalizeTimezone(timezone),
      }),
    [captureMoment?.timeZone, timezone],
  );
  const capturedAt = captureMoment
    ? captureClock.format(captureMoment.instant)
    : (photo?.metadata.capturedAtLabel ?? "Time unknown");
  const progressPlacement = traveling ? targetPlacement : placement;
  const trailMoment =
    progressStats?.time === undefined
      ? undefined
      : localDisplayMoment(
          progressStats.time,
          progressPlacement?.offsetMinutes,
          timezone,
        );
  const trailClock = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZone: trailMoment?.timeZone ?? normalizeTimezone(timezone),
      }),
    [timezone, trailMoment?.timeZone],
  );
  const trailTime = trailMoment ? trailClock.format(trailMoment.instant) : "—";
  const locationLabel =
    placement?.source === "track"
      ? placement.recordingGap
        ? "Recording gap · last GPX position"
        : "Matched to recording"
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
  useEffect(() => {
    if (!playing) return;
    if (traveling) setMobileView("map");
    else if (state.phase === "reveal") setMobileView("photo");
  }, [playing, state.phase, traveling]);
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
        data-route-only={traveling}
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
            activePhotoIndex={timelineIndex}
            stops={stops}
            track={track}
            routeStory={routeStory}
            reducedMotion={reducedMotion}
            phase={state.phase}
            dayChange={dayChange}
            approachDuration={state.approachDuration}
            phaseDuration={state.phaseDuration}
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
            cameraPadding={cameraPadding}
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
        {progressStats && (
          <JourneyProgressCard
            stats={progressStats}
            profile={elevationProfile}
            localTime={trailTime}
            compact={!traveling}
          />
        )}
        {photo && !traveling && (
          <section
            className="pj-album-photo"
            aria-label="Current photo"
            style={
              {
                "--pj-photo-matte": photo.dominantColor ?? "#030607",
                opacity: Math.min(1, panelProgress * 1.8),
                transform: `translate3d(${(panelProgress - 1) * 100}%, 0, 0)`,
              } as CSSProperties
            }
          >
            <img
              className="pj-album-backdrop"
              src={photo.thumbnailUrl}
              alt=""
              aria-hidden="true"
            />
            {photoProgress < 1 && previousPhoto && (
              <img
                className="pj-album-image"
                src={previousPhoto.thumbnailUrl}
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
        {photo && !card && !traveling && (
          <div className="pj-counter" aria-hidden="true">
            {pad(presentationIndex + 1)} <span>/ {pad(photos.length)}</span>
          </div>
        )}
      </div>
      <div className="pj-album-context">
        <p>
          {traveling ? (
            <>
              <span className="pj-album-place">Following recorded trail</span>
              <span>
                {trailStats
                  ? `${formatTrailDistance(trailStats.distanceKm)} · ${formatElapsed(trailStats.elapsedSeconds)} elapsed`
                  : "Next photo appears at the recorded stop"}
              </span>
            </>
          ) : photo ? (
            <>
              <span className="pj-album-place">{place ?? photo.name}</span>
              <span>{capturedAt}</span>
              <span className="pj-album-match">{locationLabel}</span>
            </>
          ) : (
            "Recorded route"
          )}
        </p>
        {photos.length > 0 && !traveling && (
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

function JourneyProgressCard({
  stats,
  profile,
  localTime,
  compact,
}: {
  stats: RecordedProgressStats;
  profile?: RecordedElevationProfile;
  localTime: string;
  compact: boolean;
}) {
  return (
    <aside
      className="pj-trail-progress"
      data-compact={compact}
      aria-label="Current hike progress"
    >
      {profile && <ElevationProfile profile={profile} />}
      <dl>
        <div className="pj-progress-primary">
          <dt>Elevation</dt>
          <dd>
            {stats.elevationM === undefined
              ? "—"
              : `${Math.round(stats.elevationM).toLocaleString("en")} m`}
          </dd>
        </div>
        <div className="pj-progress-elevation-gain">
          <dt>Elevation gain</dt>
          <dd>{Math.round(stats.ascentM).toLocaleString("en")} m</dd>
        </div>
        <div className="pj-progress-local-time">
          <dt>Local time</dt>
          <dd>{localTime}</dd>
        </div>
        <div>
          <dt>Time since start</dt>
          <dd>{formatElapsed(stats.elapsedSeconds)}</dd>
        </div>
        <div>
          <dt>Distance</dt>
          <dd>{formatTrailDistance(stats.distanceKm)}</dd>
        </div>
        <div className="pj-progress-secondary">
          <dt>Avg. pace</dt>
          <dd>{formatPace(stats)}</dd>
        </div>
      </dl>
    </aside>
  );
}

function ElevationProfile({ profile }: { profile: RecordedElevationProfile }) {
  const width = 300;
  const top = 6;
  const bottom = 54;
  const distanceScale = Math.max(profile.totalDistanceKm, Number.EPSILON);
  const elevationScale = Math.max(
    profile.maxElevationM - profile.minElevationM,
    Number.EPSILON,
  );
  const coordinates = profile.points.map((point) => ({
    x: (point.distanceKm / distanceScale) * width,
    y:
      bottom -
      ((point.elevationM - profile.minElevationM) / elevationScale) *
        (bottom - top),
  }));
  if (!coordinates.length) return null;
  const line = coordinates
    .map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`)
    .join(" ");
  const area = `${line} L${width},${bottom} L0,${bottom} Z`;
  const currentX = Math.min(
    width,
    Math.max(0, (profile.currentDistanceKm / distanceScale) * width),
  );
  const current = coordinates.reduce((closest, point) =>
    Math.abs(point.x - currentX) < Math.abs(closest.x - currentX)
      ? point
      : closest,
  );
  return (
    <svg
      className="pj-elevation-profile"
      viewBox={`0 0 ${width} 62`}
      preserveAspectRatio="none"
      aria-label={`Elevation profile, ${profile.totalDistanceKm.toFixed(1)} kilometres total`}
    >
      <path className="pj-elevation-profile-future" d={area} />
      <path
        className="pj-elevation-profile-complete"
        d={area}
        style={{ clipPath: `inset(0 ${100 - (currentX / width) * 100}% 0 0)` }}
      />
      <line x1={currentX} x2={currentX} y1={top} y2={bottom} />
      <circle cx={currentX} cy={current.y} r="3.5" />
      <text x="0" y="61">
        0
      </text>
      <text x={width} y="61" textAnchor="end">
        {profile.totalDistanceKm.toFixed(1)} km
      </text>
    </svg>
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
