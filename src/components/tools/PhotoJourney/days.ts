import type { Track, TrackPart, TrackPoint } from "./gpx";
import type { Placement } from "./track";
import type { JourneyPhoto, JourneyRecording } from "./types";

/** The value used by the picker for the complete trip. */
export const ALL_DAYS = "all" as const;
/** Photos and fixes whose calendar date cannot be established. */
export const UNDATED_DAY = "undated" as const;
export type DayScope = typeof ALL_DAYS | typeof UNDATED_DAY | string;

export type JourneyDay = {
  key: string;
  label: string;
  photoIds: string[];
  recordingIds: string[];
  recordedPointCount: number;
  /** A date day has a calendar key; Undated is intentionally separate. */
  undated: boolean;
};

const timezoneCache = new Map<string, string>();
const dayFormatterCache = new Map<string, Intl.DateTimeFormat>();

function validTimezone(timezone: string) {
  const cached = timezoneCache.get(timezone);
  if (cached) return cached;
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone }).format();
    timezoneCache.set(timezone, timezone);
    return timezone;
  } catch {
    timezoneCache.set(timezone, "UTC");
    return "UTC";
  }
}

/** Keeps an invalid persisted/browser timezone from making the journey unusable. */
export function normalizeTimezone(timezone?: string) {
  return validTimezone(timezone?.trim() || "UTC");
}

function datePart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  return parts.find((part) => part.type === type)?.value ?? "";
}

/** Returns YYYY-MM-DD in the chosen trip timezone. */
export function dayKeyFromInstant(instant: number, timezone = "UTC") {
  if (!Number.isFinite(instant)) return undefined;
  const zone = normalizeTimezone(timezone);
  let formatter = dayFormatterCache.get(zone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    dayFormatterCache.set(zone, formatter);
  }
  const parts = formatter.formatToParts(new Date(instant));
  const year = datePart(parts, "year");
  const month = datePart(parts, "month");
  const day = datePart(parts, "day");
  return year && month && day ? `${year}-${month}-${day}` : undefined;
}

/** A camera wall clock remains on its stated calendar date until a user supplies an offset. */
function cameraDayKey(photo: JourneyPhoto) {
  const wall = photo.metadata.capturedAtWallClock;
  const wallMatch = wall && /^(\d{4})[-:](\d{2})[-:](\d{2})/.exec(wall);
  if (wallMatch) return `${wallMatch[1]}-${wallMatch[2]}-${wallMatch[3]}`;
  const captured = photo.metadata.capturedAt;
  return captured && Number.isFinite(captured.valueOf()) ? captured.toISOString().slice(0, 10) : undefined;
}

/** Chooses the resolved instant when available and otherwise preserves the camera date. */
export function photoDayKey(photo: JourneyPhoto, placement?: Placement, timezone = "UTC") {
  if (placement?.instant !== undefined) return dayKeyFromInstant(placement.instant, timezone);
  return cameraDayKey(photo);
}

function trackDayKey(point: TrackPoint, timezone: string) {
  return point.time === undefined || !Number.isFinite(point.time) ? UNDATED_DAY : dayKeyFromInstant(point.time, timezone);
}

function sourceParts(track: Track): TrackPart[] {
  if (track.parts?.length) return track.parts;
  return [{ name: track.name, points: track.points, segmentStarts: track.segmentStarts }];
}

/**
 * Keeps only points belonging to a day while opening a new segment for every omitted run. This
 * preserves pauses and never invents a midnight point or reconnects two separated samples.
 */
export function filterTrackToDay(track: Track | undefined, day: DayScope, timezone = "UTC") {
  if (!track || day === ALL_DAYS) return track;
  const parts: TrackPart[] = [];
  for (const part of sourceParts(track)) {
    const starts = part.segmentStarts.length ? part.segmentStarts : [0];
    const bounds = [...starts, part.points.length];
    const points: TrackPoint[] = [];
    const segmentStarts: number[] = [];
    for (let segmentIndex = 0; segmentIndex < starts.length; segmentIndex += 1) {
      let opened = false;
      for (let index = bounds[segmentIndex]; index < bounds[segmentIndex + 1]; index += 1) {
        const point = part.points[index];
        if (trackDayKey(point, timezone) !== day) {
          opened = false;
          continue;
        }
        if (!opened) {
          segmentStarts.push(points.length);
          opened = true;
        }
        points.push(point);
      }
    }
    if (points.length) parts.push({ name: part.name, points, segmentStarts });
  }
  if (!parts.length) return undefined;
  const points: TrackPoint[] = [];
  const segmentStarts: number[] = [];
  for (const part of parts) {
    const offset = points.length;
    for (const start of part.segmentStarts) segmentStarts.push(offset + start);
    for (const point of part.points) points.push(point);
  }
  return { name: track.name, points, segmentStarts, parts } satisfies Track;
}

function newDay(key: string): JourneyDay {
  return {
    key,
    label: key === UNDATED_DAY ? "Undated" : formatDayLabel(key),
    photoIds: [],
    recordingIds: [],
    recordedPointCount: 0,
    undated: key === UNDATED_DAY,
  };
}

function formatDayLabel(key: string) {
  // Formatting in UTC is deliberate: `key` has already been calculated in the selected trip
  // zone, and formatting it in the viewer's zone could shift midnight to a different label.
  const date = new Date(`${key}T12:00:00.000Z`);
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "full",
    timeZone: "UTC",
  }).format(date);
}

/** Derives the single day list used by the picker, timeline, map scope, and exports. */
export function deriveJourneyDays(
  photos: readonly JourneyPhoto[],
  placements: readonly Placement[] = [],
  recordings: readonly JourneyRecording[] = [],
  timezone = "UTC",
) {
  const zone = normalizeTimezone(timezone);
  const byKey = new Map<string, JourneyDay>();
  const get = (key: string) => {
    const existing = byKey.get(key);
    if (existing) return existing;
    const created = newDay(key);
    byKey.set(key, created);
    return created;
  };
  photos.forEach((photo, index) => {
    const key = photoDayKey(photo, placements[index], zone) ?? UNDATED_DAY;
    get(key).photoIds.push(photo.id);
  });
  for (const recording of recordings) {
    if (!recording.included) continue;
    const keys = new Set<string>();
    for (const point of recording.track.points) {
      const key = trackDayKey(point, zone) ?? UNDATED_DAY;
      keys.add(key);
      get(key).recordedPointCount += 1;
    }
    for (const key of keys) get(key).recordingIds.push(recording.id);
  }
  return [...byKey.values()].sort((a, b) => {
    if (a.undated) return b.undated ? 0 : 1;
    if (b.undated) return -1;
    return a.key.localeCompare(b.key);
  });
}

export function scopedPhotos(
  photos: readonly JourneyPhoto[],
  placements: readonly Placement[],
  day: DayScope,
  timezone = "UTC",
) {
  if (day === ALL_DAYS) return photos.map((photo, index) => ({ photo, placement: placements[index] }));
  return photos.flatMap((photo, index) => (photoDayKey(photo, placements[index], timezone) ?? UNDATED_DAY) === day
    ? [{ photo, placement: placements[index] }]
    : []);
}

export function dayLabel(days: readonly JourneyDay[], day: DayScope) {
  if (day === ALL_DAYS) return "All days";
  return days.find((entry) => entry.key === day)?.label ?? "All days";
}
