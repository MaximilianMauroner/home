import { buildTimedIndex, pointAtTimedIndex, trackStats, type TimedIndex, type Track } from "./gpx";
import { isValidUtcOffsetMinutes } from "./metadata";
import { distanceKm, type JourneyStop } from "./timeline";
import type { Coordinates, JourneyPhoto, JourneyRecording, PhotoMetadata } from "./types";

/** Beyond this the recording was not close enough in time to place a photo. */
export const COVERAGE_LIMIT_SECONDS = 150;
/** A discrepancy this large is worth showing as a conflict, but never silently resolves one. */
export const DISCREPANCY_LIMIT_M = 60;

export type PlacementSource = "photo" | "track" | "carried" | "none";
export type PlacementChoice = "photo" | "track" | { source: "track"; recordingId: string };

export type Placement = {
  photoId: string;
  coordinates?: Coordinates;
  source: PlacementSource;
  discrepancyM?: number;
  gapSeconds?: number;
  elevation?: number;
  /** True instant once the camera wall-clock has a known offset. */
  instant?: number;
  /** Effective camera offset used to resolve the instant, including an explicit user fallback. */
  offsetMinutes?: number;
  /** Source recording for an unambiguous time match. */
  recordingId?: string;
  /** Source part/segment identity; visits never group across a recorded discontinuity. */
  recordingSegmentId?: string;
  /** Distance along the matched segment, used to distinguish a stop from a leave-and-return. */
  recordingDistanceKm?: number;
  /** Recording position kept alongside an original photo fix for an explicit choice. */
  trackCoordinates?: Coordinates;
  /** A source or GPS conflict needs a user decision. */
  conflict?: boolean;
  /** More than one included recording is equally close at this instant. */
  ambiguous?: boolean;
  /** A previously chosen recording no longer covers this photo's resolved instant. */
  choiceUnavailable?: boolean;
};

export type PlacementOptions = {
  /** Bulk fallback for photos that have no EXIF offset. */
  offsetMinutes?: number;
  /** Per-photo fallback/override, keyed by stable photo ID. */
  offsetMinutesByPhoto?: Readonly<Record<string, number | undefined>>;
  /** Explicitly chosen source for a photo/recording discrepancy. */
  choices?: Readonly<Record<string, PlacementChoice | undefined>>;
};

function isTrackChoice(choice: PlacementChoice | undefined) {
  return choice === "track" || (typeof choice === "object" && choice.source === "track");
}

function isPhotoChoice(choice: PlacementChoice | undefined) {
  return choice === "photo";
}

type LookupSource = { id?: string; groups: TimedIndex["points"][] };

function sourceLookup(track: Track, id?: string): LookupSource {
  const groups = new Map<string, TimedIndex["points"]>();
  for (const entry of buildTimedIndex(track, id).points) {
    const key = `${entry.trackIndex ?? 0}:${entry.segmentIndex ?? 0}`;
    const group = groups.get(key);
    if (group) group.push(entry);
    else groups.set(key, [entry]);
  }
  return { id, groups: [...groups.values()] };
}

/**
 * EXIF dates are wall-clock readings. Preserve and use the raw value when available so the
 * viewer's timezone never changes the instant. The Date fallback keeps older in-memory photos
 * readable while they are re-imported.
 */
export function photoOffsetMinutes(metadata: PhotoMetadata, fallbackOffsetMinutes?: number) {
  return isValidUtcOffsetMinutes(metadata.utcOffsetMinutes)
    ? metadata.utcOffsetMinutes
    : isValidUtcOffsetMinutes(fallbackOffsetMinutes)
      ? fallbackOffsetMinutes
      : undefined;
}

export function photoInstant(metadata: PhotoMetadata, fallbackOffsetMinutes?: number) {
  const offset = photoOffsetMinutes(metadata, fallbackOffsetMinutes);
  if (offset === undefined) return undefined;
  if (metadata.capturedAtWallClock) {
    const wall = Date.parse(`${metadata.capturedAtWallClock}Z`);
    if (Number.isFinite(wall)) return wall - offset * 60_000;
  }
  const captured = metadata.capturedAt;
  if (!captured) return undefined;
  return captured.getTime() - captured.getTimezoneOffset() * 60_000 - offset * 60_000;
}

function sourcesForTrack(track?: Track): LookupSource[] {
  return track ? [sourceLookup(track)] : [];
}

function sourcesForRecordings(recordings: readonly JourneyRecording[]) {
  return recordings
    .filter((recording) => recording.included)
    .map((recording) => sourceLookup(recording.track, recording.id));
}

function lookup(sources: readonly LookupSource[], instant: number, preferredSourceId?: string) {
  const matches: Array<{ source: LookupSource; found: NonNullable<ReturnType<typeof pointAtTimedIndex>> }> = [];
  const candidates = preferredSourceId ? sources.filter((source) => source.id === preferredSourceId) : sources;
  for (const source of candidates) {
    // Keep each recorded segment independent. A sorted index may contain adjacent timestamps
    // on opposite sides of a pause, but that boundary is still not a continuous candidate.
    for (const points of source.groups) {
      const found = pointAtTimedIndex({ points, sourceId: source.id }, instant);
      if (!found) continue;
      const candidates = [found, ...found.alternatives.map((entry) => ({
        index: entry.pointIndex,
        ...entry,
        gapMs: Math.abs(entry.point.time! - instant),
        alternatives: [] as typeof found.alternatives,
      }))];
      for (const candidate of candidates) {
        if (candidate.gapMs <= COVERAGE_LIMIT_SECONDS * 1000) matches.push({ source, found: candidate });
      }
    }
  }
  matches.sort((a, b) => a.found.gapMs - b.found.gapMs);
  if (!matches.length) return undefined;
  const best = matches[0];
  const competing = matches.filter((match) =>
    Math.abs(match.found.gapMs - best.found.gapMs) <= 1000 &&
    distanceKm(match.found.point, best.found.point) * 1000 > 5,
  );
  return { ...best, ambiguous: competing.length > 0 };
}

function resolve(
  photos: readonly JourneyPhoto[],
  sources: readonly LookupSource[],
  options: PlacementOptions,
): Placement[] {
  const choices = options.choices ?? {};
  let carried: Coordinates | undefined;
  return photos.map((photo) => {
    const own = photo.metadata.coordinates;
    const fallbackOffset = options.offsetMinutesByPhoto?.[photo.id] ?? options.offsetMinutes;
    const offsetMinutes = photoOffsetMinutes(photo.metadata, fallbackOffset);
    const instant = photoInstant(photo.metadata, fallbackOffset);
    const choice = choices[photo.id];
    const preferredRecordingId = typeof choice === "object" ? choice.recordingId : undefined;
    const match = instant === undefined ? undefined : lookup(sources, instant, preferredRecordingId);
    const choiceUnavailable = Boolean(preferredRecordingId && !match);
    if (match) {
      const onTrack = { latitude: match.found.point.latitude, longitude: match.found.point.longitude };
      const discrepancyM = own ? distanceKm(own, onTrack) * 1000 : undefined;
      if (match.ambiguous) {
        // An overlapping recording is not evidence that lets us choose a position. Keep a
        // camera fix visible by default, and leave a photo without one unresolved until the
        // viewer explicitly chooses the recording position.
        const useTrack = isTrackChoice(choice) && Boolean(onTrack);
        const usePhoto = !isTrackChoice(choice) && Boolean(own);
        const coordinates = useTrack ? onTrack : usePhoto ? own : carried;
        const source: PlacementSource = useTrack ? "track" : usePhoto ? "photo" : coordinates ? "carried" : "none";
        carried = source === "photo" || source === "track" ? coordinates : carried;
        return {
          photoId: photo.id,
          coordinates,
          source,
          discrepancyM,
          gapSeconds: match.found.gapMs / 1000,
          instant,
          offsetMinutes,
          recordingId: match.source.id,
          recordingSegmentId: `${match.found.trackIndex ?? 0}:${match.found.segmentIndex ?? 0}`,
          recordingDistanceKm: match.found.segmentDistanceKm,
          trackCoordinates: onTrack,
          conflict: true,
          ambiguous: true,
          choiceUnavailable,
        };
      }
      // The shutter instant decides the position, like a Garmin/Strava flyover. A camera
      // fix never wins on its own; it is only used when the viewer explicitly picks photo GPS.
      const useTrack = !isPhotoChoice(choice) || !own;
      const coordinates = useTrack ? onTrack : own;
      carried = coordinates;
      return {
        photoId: photo.id,
        coordinates,
        source: useTrack ? "track" : "photo",
        discrepancyM,
        gapSeconds: match.found.gapMs / 1000,
        elevation: useTrack ? match.found.point.elevation : photo.metadata.altitude,
        instant,
        offsetMinutes,
        recordingId: match.source.id,
        recordingSegmentId: `${match.found.trackIndex ?? 0}:${match.found.segmentIndex ?? 0}`,
        recordingDistanceKm: match.found.segmentDistanceKm,
        trackCoordinates: own ? onTrack : undefined,
        conflict: Boolean(own && discrepancyM !== undefined && discrepancyM > DISCREPANCY_LIMIT_M),
        ambiguous: match.ambiguous,
        choiceUnavailable,
      };
    }
    if (own) {
      carried = own;
      return { photoId: photo.id, coordinates: own, source: "photo", elevation: photo.metadata.altitude, instant, offsetMinutes, choiceUnavailable };
    }
    return { photoId: photo.id, coordinates: carried, source: carried ? "carried" : "none", instant, offsetMinutes, choiceUnavailable };
  });
}

/** Resolves against one legacy/derived track. New callers should use recordings. */
export function resolvePlacements(
  photos: readonly JourneyPhoto[],
  track?: Track,
  options: PlacementOptions = {},
) {
  return resolve(photos, sourcesForTrack(track), options);
}

/** Resolves each photo against independently retained recording sources. */
export function resolvePlacementsForRecordings(
  photos: readonly JourneyPhoto[],
  recordings: readonly JourneyRecording[],
  options: PlacementOptions = {},
) {
  return resolve(photos, sourcesForRecordings(recordings), options);
}

/** Returns included sources whose recorded time ranges overlap another included source. */
export function overlappingRecordingIds(recordings: readonly JourneyRecording[]) {
  const included = recordings
    .filter((recording) => recording.included)
    .map((recording) => ({ recording, stats: trackStats(recording.track) }))
    .filter(({ stats }) => stats.start && stats.end);
  const ids = new Set<string>();
  for (let first = 0; first < included.length; first += 1) {
    for (let second = first + 1; second < included.length; second += 1) {
      const a = included[first].stats;
      const b = included[second].stats;
      if (a.start!.valueOf() <= b.end!.valueOf() && a.end!.valueOf() >= b.start!.valueOf()) {
        ids.add(included[first].recording.id);
        ids.add(included[second].recording.id);
      }
    }
  }
  return ids;
}

export function journeyStops(placements: readonly Placement[]): JourneyStop[] {
  return placements.map((placement) => ({
    photoId: placement.photoId,
    coordinates: placement.coordinates,
    located: placement.source === "photo" || placement.source === "track",
  }));
}

export function placementSummary(placements: readonly Placement[]) {
  const corrected = placements.filter((placement) => placement.source === "track" && placement.discrepancyM !== undefined);
  const conflicts = placements.filter((placement) => placement.conflict);
  return {
    fromTrack: placements.filter((placement) => placement.source === "track").length,
    fromPhoto: placements.filter((placement) => placement.source === "photo").length,
    unplaced: placements.filter((placement) => placement.source !== "track" && placement.source !== "photo").length,
    conflictCount: conflicts.length,
    correctedCount: corrected.length,
    worstCorrectionM: corrected.reduce((worst, placement) => Math.max(worst, placement.discrepancyM ?? 0), 0),
  };
}
