import timezoneAt from "tz-lookup";

import { isValidUtcOffsetMinutes } from "./metadata";
import type { JourneyPhoto, JourneyRecording } from "./types";

const TRACK_SAMPLES_PER_RECORDING = 64;

function timezoneFor(latitude: number, longitude: number) {
  try {
    return timezoneAt(latitude, longitude);
  } catch {
    return undefined;
  }
}

/** Uses a single dominant EXIF offset when location data cannot identify an IANA timezone. */
export function inferJourneyOffsetMinutes(photos: readonly JourneyPhoto[]) {
  const counts = new Map<number, number>();
  for (const photo of photos) {
    const offset = photo.metadata.utcOffsetMinutes;
    if (!isValidUtcOffsetMinutes(offset)) continue;
    counts.set(offset, (counts.get(offset) ?? 0) + 1);
  }
  const ranked = [...counts].sort(
    ([firstOffset, firstCount], [secondOffset, secondCount]) =>
      secondCount - firstCount || firstOffset - secondOffset,
  );
  if (!ranked.length || ranked[0][1] === ranked[1]?.[1]) return undefined;
  return ranked[0][0];
}

/**
 * Infers one trip timezone from the geographic evidence already present in the journey.
 * GPX clocks are UTC instants and do not themselves state the activity's local timezone.
 */
export function inferJourneyTimezone(
  photos: readonly JourneyPhoto[],
  recordings: readonly JourneyRecording[],
) {
  const zones: string[] = [];
  for (const photo of photos) {
    const point = photo.metadata.coordinates;
    if (!point) continue;
    const zone = timezoneFor(point.latitude, point.longitude);
    if (zone) zones.push(zone);
  }
  for (const recording of recordings) {
    if (!recording.included || !recording.track.points.length) continue;
    const points = recording.track.points;
    const step = Math.max(
      1,
      Math.ceil(points.length / TRACK_SAMPLES_PER_RECORDING),
    );
    for (let index = 0; index < points.length; index += step) {
      const point = points[index];
      const zone = timezoneFor(point.latitude, point.longitude);
      if (zone) zones.push(zone);
    }
    const last = points.at(-1)!;
    const lastZone = timezoneFor(last.latitude, last.longitude);
    if (lastZone) zones.push(lastZone);
  }
  if (!zones.length) return undefined;
  const counts = new Map<string, number>();
  for (const zone of zones) counts.set(zone, (counts.get(zone) ?? 0) + 1);
  return [...counts].sort(
    ([firstZone, firstCount], [secondZone, secondCount]) =>
      secondCount - firstCount || firstZone.localeCompare(secondZone),
  )[0]?.[0];
}
