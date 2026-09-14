import {
  buildTimedIndex,
  pointAtTimedIndex,
  trackSegments,
  trackStats,
  type TimedIndex,
  type Track,
} from "./gpx";
import { isValidUtcOffsetMinutes } from "./metadata";
import { distanceKm, type JourneyStop } from "./timeline";
import type {
  Coordinates,
  JourneyPhoto,
  JourneyRecording,
  PhotoMetadata,
} from "./types";

/** Beyond this the recording was not close enough in time to place a photo. */
export const COVERAGE_LIMIT_SECONDS = 150;
/** A discrepancy this large is worth showing as a conflict, but never silently resolves one. */
export const DISCREPANCY_LIMIT_M = 60;
/** Photo GPS can locate an untimed photo on a nearby GPX without treating it as a time match. */
export const SPATIAL_FALLBACK_LIMIT_M = 5_000;

export type PlacementSource = "photo" | "track" | "carried" | "none";
export type PlacementChoice =
  | "photo"
  | "track"
  | { source: "track"; recordingId: string };

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
  /** Exact GPX sample selected for this photo, including when nearby samples share coordinates. */
  recordingSampleTime?: number;
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

type LookupSource = {
  id?: string;
  groups: TimedIndex["points"][];
  segments: Coordinates[][];
};

function sourceLookup(track: Track, id?: string): LookupSource {
  const groups = new Map<string, TimedIndex["points"]>();
  for (const entry of buildTimedIndex(track, id).points) {
    const key = `${entry.trackIndex ?? 0}:${entry.segmentIndex ?? 0}`;
    const group = groups.get(key);
    if (group) group.push(entry);
    else groups.set(key, [entry]);
  }
  return { id, groups: [...groups.values()], segments: trackSegments(track) };
}

function wrappedLongitudeDelta(from: number, to: number) {
  return ((to - from + 540) % 360) - 180;
}

/** Find the closest drawable point, including positions between recorded samples. */
function nearestRoutePoint(
  sources: readonly Pick<LookupSource, "segments">[],
  point: Coordinates,
) {
  const scale = Math.max(0.01, Math.cos((point.latitude * Math.PI) / 180));
  let nearest: { coordinates: Coordinates; distanceM: number } | undefined;
  const consider = (start: Coordinates, end: Coordinates) => {
    const endX = wrappedLongitudeDelta(start.longitude, end.longitude) * scale;
    const endY = end.latitude - start.latitude;
    const pointX =
      wrappedLongitudeDelta(start.longitude, point.longitude) * scale;
    const pointY = point.latitude - start.latitude;
    const lengthSquared = endX * endX + endY * endY;
    const fraction = lengthSquared
      ? Math.max(
          0,
          Math.min(1, (pointX * endX + pointY * endY) / lengthSquared),
        )
      : 0;
    const coordinates = {
      latitude: start.latitude + endY * fraction,
      longitude: start.longitude + (endX / scale) * fraction,
    };
    const distanceM = distanceKm(point, coordinates) * 1_000;
    if (!nearest || distanceM < nearest.distanceM)
      nearest = { coordinates, distanceM };
  };
  for (const source of sources) {
    for (const segment of source.segments) {
      if (segment.length === 1) consider(segment[0], segment[0]);
      for (let index = 1; index < segment.length; index += 1)
        consider(segment[index - 1], segment[index]);
    }
  }
  return nearest;
}

/**
 * EXIF dates are wall-clock readings. Preserve and use the raw value when available so the
 * viewer's timezone never changes the instant. The Date fallback keeps older in-memory photos
 * readable while they are re-imported.
 */
export function photoOffsetMinutes(
  metadata: PhotoMetadata,
  fallbackOffsetMinutes?: number,
) {
  return isValidUtcOffsetMinutes(metadata.utcOffsetMinutes)
    ? metadata.utcOffsetMinutes
    : isValidUtcOffsetMinutes(fallbackOffsetMinutes)
      ? fallbackOffsetMinutes
      : undefined;
}

export function photoInstant(
  metadata: PhotoMetadata,
  fallbackOffsetMinutes?: number,
) {
  const offset = photoOffsetMinutes(metadata, fallbackOffsetMinutes);
  if (offset === undefined) return undefined;
  if (metadata.capturedAtWallClock) {
    const wall = Date.parse(`${metadata.capturedAtWallClock}Z`);
    if (Number.isFinite(wall)) return wall - offset * 60_000;
  }
  const captured = metadata.capturedAt;
  if (!captured) return undefined;
  return (
    captured.getTime() - captured.getTimezoneOffset() * 60_000 - offset * 60_000
  );
}

function sourcesForTrack(track?: Track): LookupSource[] {
  return track ? [sourceLookup(track)] : [];
}

function sourcesForRecordings(recordings: readonly JourneyRecording[]) {
  return recordings
    .filter((recording) => recording.included)
    .map((recording) => sourceLookup(recording.track, recording.id));
}

function lookup(
  sources: readonly LookupSource[],
  instant: number,
  preferredSourceId?: string,
) {
  const matches: Array<{
    source: LookupSource;
    found: NonNullable<ReturnType<typeof pointAtTimedIndex>>;
  }> = [];
  const candidates = preferredSourceId
    ? sources.filter((source) => source.id === preferredSourceId)
    : sources;
  for (const source of candidates) {
    // Keep each recorded segment independent. A sorted index may contain adjacent timestamps
    // on opposite sides of a pause, but that boundary is still not a continuous candidate.
    for (const points of source.groups) {
      const found = pointAtTimedIndex({ points, sourceId: source.id }, instant);
      if (!found) continue;
      const candidates = [
        found,
        ...found.alternatives.map((entry) => ({
          index: entry.pointIndex,
          ...entry,
          gapMs: Math.abs(entry.point.time! - instant),
          alternatives: [] as typeof found.alternatives,
        })),
      ];
      for (const candidate of candidates) {
        if (candidate.gapMs <= COVERAGE_LIMIT_SECONDS * 1000)
          matches.push({ source, found: candidate });
      }
    }
  }
  matches.sort((a, b) => a.found.gapMs - b.found.gapMs);
  if (!matches.length) return undefined;
  const best = matches[0];
  const competing = matches.filter(
    (match) =>
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
  const hasRecordingData = sources.length > 0;
  let carried: Coordinates | undefined;
  return photos.map((photo) => {
    const own = photo.metadata.coordinates;
    const fallbackOffset =
      options.offsetMinutesByPhoto?.[photo.id] ?? options.offsetMinutes;
    const offsetMinutes = photoOffsetMinutes(photo.metadata, fallbackOffset);
    const instant = photoInstant(photo.metadata, fallbackOffset);
    const choice = choices[photo.id];
    const preferredRecordingId =
      typeof choice === "object" ? choice.recordingId : undefined;
    const match =
      instant === undefined
        ? undefined
        : lookup(sources, instant, preferredRecordingId);
    const choiceUnavailable = Boolean(preferredRecordingId && !match);
    if (match) {
      const onTrack = {
        latitude: match.found.point.latitude,
        longitude: match.found.point.longitude,
      };
      const discrepancyM = own ? distanceKm(own, onTrack) * 1000 : undefined;
      if (match.ambiguous) {
        // A generic source choice cannot decide which overlapping recording represents the
        // journey. Keep the photo unresolved until the user selects a recording by ID. Camera
        // GPS remains diagnostic data and never becomes route truth while a GPX is included.
        const coordinates = carried;
        const source: PlacementSource = coordinates ? "carried" : "none";
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
          recordingSampleTime: match.found.point.time,
          recordingDistanceKm: match.found.segmentDistanceKm,
          trackCoordinates: onTrack,
          conflict: true,
          ambiguous: true,
          choiceUnavailable,
        };
      }
      // The shutter instant and selected recording decide the route position. A camera fix can
      // expose clock or GPS errors, but even a legacy `photo` choice cannot move this stop off GPX.
      carried = onTrack;
      return {
        photoId: photo.id,
        coordinates: onTrack,
        source: "track",
        discrepancyM,
        gapSeconds: match.found.gapMs / 1000,
        elevation: match.found.point.elevation,
        instant,
        offsetMinutes,
        recordingId: match.source.id,
        recordingSegmentId: `${match.found.trackIndex ?? 0}:${match.found.segmentIndex ?? 0}`,
        recordingSampleTime: match.found.point.time,
        recordingDistanceKm: match.found.segmentDistanceKm,
        trackCoordinates: own ? onTrack : undefined,
        conflict: Boolean(
          own &&
          discrepancyM !== undefined &&
          discrepancyM > DISCREPANCY_LIMIT_M,
        ),
        ambiguous: match.ambiguous,
        choiceUnavailable,
      };
    }
    if (!hasRecordingData && own) {
      carried = own;
      return {
        photoId: photo.id,
        coordinates: own,
        source: "photo",
        elevation: photo.metadata.altitude,
        instant,
        offsetMinutes,
        choiceUnavailable,
      };
    }
    const spatialFallback = own ? nearestRoutePoint(sources, own) : undefined;
    if (
      spatialFallback &&
      spatialFallback.distanceM <= SPATIAL_FALLBACK_LIMIT_M
    ) {
      return {
        photoId: photo.id,
        coordinates: spatialFallback.coordinates,
        source: "none",
        discrepancyM: spatialFallback.distanceM,
        instant,
        offsetMinutes,
        trackCoordinates: spatialFallback.coordinates,
        choiceUnavailable,
      };
    }
    return {
      photoId: photo.id,
      coordinates: carried,
      source: carried ? "carried" : "none",
      instant,
      offsetMinutes,
      choiceUnavailable,
    };
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
export function overlappingRecordingIds(
  recordings: readonly JourneyRecording[],
) {
  const included = recordings
    .filter((recording) => recording.included)
    .map((recording) => ({ recording, stats: trackStats(recording.track) }))
    .filter(({ stats }) => stats.start && stats.end);
  const ids = new Set<string>();
  for (let first = 0; first < included.length; first += 1) {
    for (let second = first + 1; second < included.length; second += 1) {
      const a = included[first].stats;
      const b = included[second].stats;
      if (
        a.start!.valueOf() <= b.end!.valueOf() &&
        a.end!.valueOf() >= b.start!.valueOf()
      ) {
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
  const corrected = placements.filter(
    (placement) =>
      placement.source === "track" && placement.discrepancyM !== undefined,
  );
  const conflicts = placements.filter((placement) => placement.conflict);
  return {
    fromTrack: placements.filter((placement) => placement.source === "track")
      .length,
    fromPhoto: placements.filter((placement) => placement.source === "photo")
      .length,
    unplaced: placements.filter(
      (placement) =>
        placement.source !== "track" && placement.source !== "photo",
    ).length,
    conflictCount: conflicts.length,
    correctedCount: corrected.length,
    worstCorrectionM: corrected.reduce(
      (worst, placement) => Math.max(worst, placement.discrepancyM ?? 0),
      0,
    ),
  };
}
