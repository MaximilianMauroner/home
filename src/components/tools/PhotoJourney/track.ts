import {
  buildTimedIndex,
  pointAtTimedIndex,
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
  /** The shutter fired inside a recording gap, so this uses its last known GPX fix. */
  recordingGap?: boolean;
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
  /** IANA zone used to resolve camera wall clocks that do not include their own offset. */
  timezone?: string;
  /** Explicitly chosen source for a photo/recording discrepancy. */
  choices?: Readonly<Record<string, PlacementChoice | undefined>>;
};

type WallClockParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const wallClockFormatterCache = new Map<
  string,
  Intl.DateTimeFormat | undefined
>();

function wallClockFormatter(timezone: string) {
  if (wallClockFormatterCache.has(timezone))
    return wallClockFormatterCache.get(timezone);
  let formatter: Intl.DateTimeFormat | undefined;
  try {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    formatter = undefined;
  }
  wallClockFormatterCache.set(timezone, formatter);
  return formatter;
}

function wallClockParts(value?: string): WallClockParts | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(
    value ?? "",
  );
  if (!match) return undefined;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] ?? "0"),
  };
}

function zonedParts(formatter: Intl.DateTimeFormat, instant: number) {
  const values = Object.fromEntries(
    formatter
      .formatToParts(new Date(instant))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  } satisfies WallClockParts;
}

function sameWallClock(first: WallClockParts, second: WallClockParts) {
  return (Object.keys(first) as Array<keyof WallClockParts>).every(
    (key) => first[key] === second[key],
  );
}

/** Resolve a zone-less EXIF clock in the selected trip zone, including daylight saving time. */
export function timezoneOffsetMinutesAtWallClock(
  wallClock: string | undefined,
  timezone: string | undefined,
) {
  const desired = wallClockParts(wallClock);
  if (!desired || !timezone) return undefined;
  const formatter = wallClockFormatter(timezone);
  if (!formatter) return undefined;
  const wallAsUtc = Date.UTC(
    desired.year,
    desired.month - 1,
    desired.day,
    desired.hour,
    desired.minute,
    desired.second,
  );
  let instant = wallAsUtc;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const local = zonedParts(formatter, instant);
    const localAsUtc = Date.UTC(
      local.year,
      local.month - 1,
      local.day,
      local.hour,
      local.minute,
      local.second,
    );
    const offsetMinutes = Math.round((localAsUtc - instant) / 60_000);
    instant = wallAsUtc - offsetMinutes * 60_000;
  }
  if (!sameWallClock(zonedParts(formatter, instant), desired)) return undefined;
  const offsetMinutes = Math.round((wallAsUtc - instant) / 60_000);
  return isValidUtcOffsetMinutes(offsetMinutes) ? offsetMinutes : undefined;
}

type LookupSource = {
  id?: string;
  points: TimedIndex["points"];
  groups: TimedIndex["points"][];
};

function sourceLookup(track: Track, id?: string): LookupSource {
  const points = buildTimedIndex(track, id).points;
  const groups = new Map<string, TimedIndex["points"]>();
  for (const entry of points) {
    const key = `${entry.trackIndex ?? 0}:${entry.segmentIndex ?? 0}`;
    const group = groups.get(key);
    if (group) group.push(entry);
    else groups.set(key, [entry]);
  }
  return { id, points, groups: [...groups.values()] };
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
  return photoInstantAtOffset(metadata, offset);
}

function photoInstantAtOffset(
  metadata: PhotoMetadata,
  offset: number | undefined,
) {
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

type FoundPoint = NonNullable<ReturnType<typeof pointAtTimedIndex>>;

/**
 * A stopped recorder has no samples to interpolate. The last fix before a gap is the only
 * GPX-backed statement about where the camera was, so hold that fix until recording resumes.
 */
function pointDuringRecordingGap(
  points: TimedIndex["points"],
  instant: number,
): FoundPoint | undefined {
  if (points.length < 2) return undefined;
  let low = 0;
  let high = points.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (points[middle].point.time! <= instant) low = middle + 1;
    else high = middle;
  }
  const previous = points[low - 1];
  const next = points[low];
  if (!previous || !next) return undefined;
  if (instant === previous.point.time) return undefined;
  const recordingGapMs = next.point.time! - previous.point.time!;
  if (recordingGapMs <= COVERAGE_LIMIT_SECONDS * 2 * 1000) return undefined;
  const alternatives = [] as TimedIndex["points"];
  for (let index = low - 2; index >= 0; index -= 1) {
    const alternative = points[index];
    if (alternative.point.time !== previous.point.time) break;
    alternatives.push(alternative);
  }
  return {
    index: previous.pointIndex,
    ...previous,
    gapMs: instant - previous.point.time!,
    alternatives,
  };
}

function foundCandidates(found: FoundPoint, instant: number): FoundPoint[] {
  return [
    found,
    ...found.alternatives.map((entry) => ({
      index: entry.pointIndex,
      ...entry,
      gapMs: Math.abs(entry.point.time! - instant),
      alternatives: [] as FoundPoint["alternatives"],
    })),
  ];
}

function lookup(
  sources: readonly LookupSource[],
  instant: number,
  preferredSourceId?: string,
) {
  type Match = {
    source: LookupSource;
    found: FoundPoint;
  };
  const exactMatches: Match[] = [];
  const pauseMatches: Match[] = [];
  const candidates = preferredSourceId
    ? sources.filter((source) => source.id === preferredSourceId)
    : sources;
  for (const source of candidates) {
    const gap = pointDuringRecordingGap(source.points, instant);
    if (gap) {
      for (const candidate of foundCandidates(gap, instant))
        pauseMatches.push({ source, found: candidate });
      continue;
    }
    // Keep each recorded segment independent for direct nearest-sample matching. Gap placement
    // above may hold the prior endpoint across segments, but it never implies a connecting leg.
    for (const points of source.groups) {
      const firstTime = points[0]?.point.time;
      const lastTime = points.at(-1)?.point.time;
      if (
        firstTime === undefined ||
        lastTime === undefined ||
        instant < firstTime ||
        instant > lastTime
      )
        continue;
      const found = pointAtTimedIndex({ points, sourceId: source.id }, instant);
      if (found) {
        for (const candidate of foundCandidates(found, instant)) {
          if (candidate.gapMs <= COVERAGE_LIMIT_SECONDS * 1000)
            exactMatches.push({ source, found: candidate });
        }
      }
    }
  }
  const recordingGap = exactMatches.length === 0;
  const matches = recordingGap ? pauseMatches : exactMatches;
  matches.sort((a, b) => a.found.gapMs - b.found.gapMs);
  if (!matches.length) return undefined;
  const best = matches[0];
  const competing = matches.filter(
    (match) =>
      Math.abs(match.found.gapMs - best.found.gapMs) <= 1000 &&
      distanceKm(match.found.point, best.found.point) * 1000 > 5,
  );
  return { ...best, ambiguous: competing.length > 0, recordingGap };
}

function resolve(
  photos: readonly JourneyPhoto[],
  sources: readonly LookupSource[],
  options: PlacementOptions,
): Placement[] {
  const choices = options.choices ?? {};
  const placements: Placement[] = photos.map((photo): Placement => {
    const own = photo.metadata.coordinates;
    const explicitOffset = options.offsetMinutesByPhoto?.[photo.id];
    const fallbackOffset =
      options.offsetMinutes ??
      timezoneOffsetMinutesAtWallClock(
        photo.metadata.capturedAtWallClock,
        options.timezone,
      );
    const offsetMinutes = isValidUtcOffsetMinutes(explicitOffset)
      ? explicitOffset
      : photoOffsetMinutes(photo.metadata, fallbackOffset);
    const instant = photoInstantAtOffset(photo.metadata, offsetMinutes);
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
        return {
          photoId: photo.id,
          source: "none",
          discrepancyM,
          gapSeconds: match.found.gapMs / 1000,
          instant,
          offsetMinutes,
          recordingId: match.source.id,
          recordingSegmentId: `${match.found.trackIndex ?? 0}:${match.found.segmentIndex ?? 0}`,
          recordingSampleTime: match.found.point.time,
          recordingDistanceKm: match.found.segmentDistanceKm,
          recordingGap: match.recordingGap,
          trackCoordinates: onTrack,
          conflict: true,
          ambiguous: true,
          choiceUnavailable,
        };
      }
      // The shutter instant and selected recording decide the route position. A camera fix can
      // expose clock or GPS errors, but even a legacy `photo` choice cannot move this stop off GPX.
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
        recordingGap: match.recordingGap,
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
    if (own) {
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
    return {
      photoId: photo.id,
      coordinates: undefined,
      source: "none",
      instant,
      offsetMinutes,
      choiceUnavailable,
    };
  });

  // A photo's own GPS remains useful outside a recording's time range. For photos without GPS,
  // use the closest photo-owned fix in journey order as a transparent estimate. This works in
  // both directions, so the first photos in a photo-only upload are not left behind simply
  // because the first GPS-bearing image comes later.
  const photoFixes = photos.flatMap((photo, index) =>
    photo.metadata.coordinates
      ? [{ index, coordinates: photo.metadata.coordinates }]
      : [],
  );
  let nearestFixIndex = 0;
  return placements.map((placement, index) => {
    if (
      placement.source !== "none" ||
      placement.ambiguous ||
      placement.choiceUnavailable
    )
      return placement;
    while (
      photoFixes[nearestFixIndex + 1] &&
      Math.abs(photoFixes[nearestFixIndex + 1].index - index) <
        Math.abs(photoFixes[nearestFixIndex].index - index)
    )
      nearestFixIndex += 1;
    const nearest = photoFixes[nearestFixIndex];
    return nearest
      ? { ...placement, coordinates: nearest.coordinates, source: "carried" }
      : placement;
  });
}

/** True when presentation and exports can use the resolved or estimated position. */
export function placementIsLocated(placement: Placement | undefined) {
  return Boolean(placement?.coordinates && placement.source !== "none");
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
    located: placementIsLocated(placement),
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
    unplaced: placements.filter((placement) => !placementIsLocated(placement))
      .length,
    conflictCount: conflicts.length,
    correctedCount: corrected.length,
    worstCorrectionM: corrected.reduce(
      (worst, placement) => Math.max(worst, placement.discrepancyM ?? 0),
      0,
    ),
  };
}
