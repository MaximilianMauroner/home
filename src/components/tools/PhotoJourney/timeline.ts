import type { Coordinates, JourneyPhoto } from "./types";

export type JourneyPhase =
  | "overview"
  | "intro"
  | "day"
  | "approach"
  | "reveal"
  | "hold"
  | "outro"
  | "complete";
export type TimelineState = {
  photoIndex: number;
  phase: JourneyPhase;
  phaseProgress: number;
  panelVisible: boolean;
  dayLabel?: string;
  approachDuration: number;
};
export type TimelineStop = {
  photoIndex: number;
  start: number;
  duration: number;
  approachDuration: number;
  revealStart: number;
  end: number;
  dayStart: number;
  dayLabel?: string;
  burst: boolean;
};
export type JourneyTimeline = { stops: TimelineStop[]; totalDuration: number };

export function distanceKm(a: Coordinates, b: Coordinates) {
  const radians = Math.PI / 180;
  const value =
    Math.sin(((b.latitude - a.latitude) * radians) / 2) ** 2 +
    Math.cos(a.latitude * radians) *
      Math.cos(b.latitude * radians) *
      Math.sin(((b.longitude - a.longitude) * radians) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, value)));
}

export function buildTimeline(photos: JourneyPhoto[]): JourneyTimeline {
  let offset = photos.length ? 2500 : 0;
  let day = 0;
  let lastDay: string | undefined;
  let lastPosition: Coordinates | undefined;
  const stops = photos.map((photo, photoIndex) => {
    const date = photo.metadata.capturedAt;
    const key = date?.toISOString().slice(0, 10);
    let dayLabel: string | undefined;
    if (key && key !== lastDay) {
      day += 1;
      dayLabel = `Day ${day} · ${date!.toLocaleDateString("en", { day: "numeric", month: "long", timeZone: "UTC" })}`;
      lastDay = key;
    }
    const dayStart = offset;
    if (dayLabel) offset += 1500;
    const own = photo.metadata.coordinates;
    const previous = photos[photoIndex - 1];
    const previousDate = previous?.metadata.capturedAt;
    const burst = Boolean(
      own &&
        previous?.metadata.coordinates &&
        date &&
        previousDate &&
        Math.floor(date.getTime() / 60000) ===
          Math.floor(previousDate.getTime() / 60000) &&
        distanceKm(own, previous.metadata.coordinates) < 0.05,
    );
    const distance = own && lastPosition ? distanceKm(lastPosition, own) : 0;
    const approachDuration =
      !own || burst || distance < 0.001
        ? 0
        : Math.min(3000, Math.max(600, 600 + Math.log10(1 + distance) * 650));
    if (own) lastPosition = own;
    const start = offset;
    const revealStart = start + approachDuration;
    offset = revealStart + (burst ? 2000 : 4500);
    return {
      photoIndex,
      start,
      duration: offset - start,
      approachDuration,
      revealStart,
      end: offset,
      dayStart,
      dayLabel,
      burst,
    };
  });
  return { stops, totalDuration: photos.length ? offset + 3000 : 0 };
}
export function timelineAt(
  elapsed: number,
  timeline: JourneyTimeline,
): TimelineState {
  const base = {
    photoIndex: 0,
    phaseProgress: 0,
    panelVisible: false,
    approachDuration: 0,
  };
  if (!timeline.stops.length) return { ...base, phase: "overview" };
  const safe = Math.max(0, elapsed);
  if (safe < 2500)
    return { ...base, phase: "intro", phaseProgress: safe / 2500 };
  const stop = timeline.stops.find((entry) => safe < entry.end);
  if (!stop)
    return {
      ...base,
      photoIndex: timeline.stops.length - 1,
      phase: safe >= timeline.totalDuration ? "complete" : "outro",
      phaseProgress: Math.min(1, (safe - timeline.stops.at(-1)!.end) / 3000),
    };
  const state = {
    ...base,
    photoIndex: stop.photoIndex,
    approachDuration: stop.approachDuration,
  };
  if (safe < stop.start)
    return {
      ...state,
      phase: "day",
      dayLabel: stop.dayLabel,
      phaseProgress: (safe - stop.dayStart) / (stop.start - stop.dayStart),
    };
  if (safe < stop.revealStart)
    return {
      ...state,
      phase: "approach",
      phaseProgress: (safe - stop.start) / stop.approachDuration,
    };
  const revealEnd = stop.revealStart + 500;
  return {
    ...state,
    phase: safe < revealEnd ? "reveal" : "hold",
    panelVisible: true,
    phaseProgress:
      safe < revealEnd
        ? (safe - stop.revealStart) / 500
        : (safe - revealEnd) / (stop.end - revealEnd),
  };
}

export type JourneyStop = {
  photoId: string;
  /** Where the map sits for this stop: the photo's own GPS, or the last known position. */
  coordinates?: Coordinates;
  /** True when the photo carries its own GPS rather than an inherited position. */
  located: boolean;
};

/**
 * A photo without GPS should not move the map. Each such stop inherits the position of the
 * last located photo before it, so the camera holds still instead of falling back to 0°, 0°.
 */
export function resolveStops(photos: JourneyPhoto[]): JourneyStop[] {
  let carried: Coordinates | undefined;
  return photos.map((photo) => {
    const own = photo.metadata.coordinates;
    if (own) carried = own;
    return {
      photoId: photo.id,
      coordinates: own ?? carried,
      located: Boolean(own),
    };
  });
}

export type CameraMove = {
  center: Coordinates;
  /** The position the map is expected to be leaving. Undefined for the first fix of a journey. */
  from?: Coordinates;
};

function samePlace(a: Coordinates, b: Coordinates) {
  return (
    Math.abs(a.latitude - b.latitude) < 1e-6 &&
    Math.abs(a.longitude - b.longitude) < 1e-6
  );
}

/**
 * The camera target for a stop. Returns undefined while no position is known yet, which leaves
 * the map wherever it already is rather than jumping to a default centre.
 */
export function cameraFor(
  stops: JourneyStop[],
  photoIndex: number,
): CameraMove | undefined {
  const center = stops[photoIndex]?.coordinates;
  if (!center) return undefined;
  const previous = stops[photoIndex - 1]?.coordinates;
  if (!previous || samePlace(previous, center)) return { center };
  return { center, from: previous };
}

/**
 * Splits the route wherever it crosses the antimeridian, so a hop from 179° to -179° draws as
 * two segments instead of one line back across the whole map.
 */
export function routeSegments(points: Coordinates[]): Coordinates[][] {
  if (!points.length) return [];
  const segments: Coordinates[][] = [];
  let segment = [points[0]];
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const point = points[index];
    if (Math.abs(point.longitude - previous.longitude) > 180) {
      const adjusted =
        point.longitude + (point.longitude < previous.longitude ? 360 : -360);
      const edge = adjusted > previous.longitude ? 180 : -180;
      const fraction =
        (edge - previous.longitude) / (adjusted - previous.longitude);
      const latitude =
        previous.latitude + fraction * (point.latitude - previous.latitude);
      segment.push({ latitude, longitude: edge });
      segments.push(segment);
      segment = [{ latitude, longitude: -edge }];
    }
    segment.push(point);
  }
  if (segment.length > 1) segments.push(segment);
  return segments;
}

export function locatedPoints(photos: JourneyPhoto[]): Coordinates[] {
  return photos.flatMap((photo) => photo.metadata.coordinates ?? []);
}
