import { distanceKm } from "./timeline";
import type { Coordinates } from "./types";

/** One recorded fix. `time` is a true instant in epoch milliseconds; GPX always states UTC. */
export type TrackPoint = Coordinates & { elevation?: number; time?: number };

export type Track = {
  name?: string;
  /** Every point, in recorded order, used for time lookup. */
  points: TrackPoint[];
  /** Index into `points` where each recorded segment starts. A pause splits a segment. */
  segmentStarts: number[];
};

/** Climb below this is instrument noise rather than ascent, so it does not count. */
export const ASCENT_THRESHOLD_M = 10;

export type TrackStats = {
  distanceKm: number;
  ascentM: number;
  descentM: number;
  minElevation?: number;
  maxElevation?: number;
  start?: Date;
  end?: Date;
  /** Elapsed time with the pauses removed. */
  movingSeconds: number;
  pointCount: number;
};

function readNumber(value: string | null) {
  if (value === null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Reads the track out of a GPX file. Only `trkpt` matters here: waypoints and routes describe
 * planned places, while this tool needs the fixes that were actually recorded, with their times.
 */
export function parseGpx(text: string): Track {
  const document = new DOMParser().parseFromString(text, "application/xml");
  if (document.querySelector("parsererror")) {
    throw new Error("This file is not readable GPX.");
  }
  const points: TrackPoint[] = [];
  const segmentStarts: number[] = [];
  for (const segment of document.querySelectorAll("trkseg")) {
    let opened = false;
    for (const node of segment.querySelectorAll("trkpt")) {
      const latitude = readNumber(node.getAttribute("lat"));
      const longitude = readNumber(node.getAttribute("lon"));
      if (
        latitude === undefined ||
        longitude === undefined ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
      ) {
        continue;
      }
      const timeText = node.querySelector("time")?.textContent?.trim();
      const parsedTime = timeText ? Date.parse(timeText) : Number.NaN;
      if (!opened) {
        segmentStarts.push(points.length);
        opened = true;
      }
      points.push({
        latitude,
        longitude,
        elevation: readNumber(node.querySelector("ele")?.textContent?.trim() ?? null),
        time: Number.isNaN(parsedTime) ? undefined : parsedTime,
      });
    }
  }
  if (!points.length) throw new Error("This GPX file has no track points.");
  return {
    name: document.querySelector("trk > name")?.textContent?.trim() || undefined,
    points,
    segmentStarts,
  };
}

/** Merges several files into one track, ordered by time, so a split recording plays as one tour. */
export function mergeTracks(tracks: Track[]): Track {
  const ordered = [...tracks].sort(
    (a, b) => (a.points[0]?.time ?? 0) - (b.points[0]?.time ?? 0),
  );
  const points: TrackPoint[] = [];
  const segmentStarts: number[] = [];
  for (const track of ordered) {
    for (const start of track.segmentStarts) segmentStarts.push(start + points.length);
    points.push(...track.points);
  }
  return { name: ordered[0]?.name, points, segmentStarts };
}

export function trackStats(track: Track): TrackStats {
  const { points } = track;
  let distance = 0;
  let ascent = 0;
  let descent = 0;
  let moving = 0;
  let anchor = points[0]?.elevation;
  const elevations: number[] = [];
  for (const [index, point] of points.entries()) {
    if (point.elevation !== undefined) elevations.push(point.elevation);
    if (index === 0) continue;
    const previous = points[index - 1];
    const step = distanceKm(previous, point);
    distance += step;
    const gap = point.time !== undefined && previous.time !== undefined ? point.time - previous.time : 0;
    // A pause is not travel. Long gaps and standing still are both excluded from moving time.
    if (gap > 0 && gap < 120_000 && step > 0.001) moving += gap / 1000;
    if (point.elevation === undefined) continue;
    if (anchor === undefined) anchor = point.elevation;
    else if (point.elevation - anchor >= ASCENT_THRESHOLD_M) {
      ascent += point.elevation - anchor;
      anchor = point.elevation;
    } else if (anchor - point.elevation >= ASCENT_THRESHOLD_M) {
      descent += anchor - point.elevation;
      anchor = point.elevation;
    }
  }
  const times = points.flatMap((point) => (point.time === undefined ? [] : [point.time]));
  return {
    distanceKm: distance,
    ascentM: ascent,
    descentM: descent,
    minElevation: elevations.length ? Math.min(...elevations) : undefined,
    maxElevation: elevations.length ? Math.max(...elevations) : undefined,
    start: times.length ? new Date(Math.min(...times)) : undefined,
    end: times.length ? new Date(Math.max(...times)) : undefined,
    movingSeconds: moving,
    pointCount: points.length,
  };
}

/**
 * Finds the point recorded closest to an instant. The series is time-ordered, so this is a binary
 * search rather than a scan; a day of one-second fixes is tens of thousands of points.
 */
export function pointAtTime(track: Track, instant: number) {
  const timed = track.points;
  let low = 0;
  let high = timed.length - 1;
  while (low < high) {
    const middle = (low + high) >> 1;
    if ((timed[middle].time ?? Number.POSITIVE_INFINITY) < instant) low = middle + 1;
    else high = middle;
  }
  let best = low;
  let bestGap = Number.POSITIVE_INFINITY;
  for (const index of [low - 1, low, low + 1]) {
    const time = timed[index]?.time;
    if (time === undefined) continue;
    const gap = Math.abs(time - instant);
    if (gap < bestGap) {
      bestGap = gap;
      best = index;
    }
  }
  if (bestGap === Number.POSITIVE_INFINITY) return undefined;
  return { index: best, point: timed[best], gapMs: bestGap };
}

/** Perpendicular distance in metres, flat-earth within a segment, which is exact enough here. */
function offsetMetres(point: Coordinates, start: Coordinates, end: Coordinates) {
  const scale = Math.cos((point.latitude * Math.PI) / 180);
  const px = (point.longitude - start.longitude) * scale;
  const py = point.latitude - start.latitude;
  const ex = (end.longitude - start.longitude) * scale;
  const ey = end.latitude - start.latitude;
  const lengthSquared = ex * ex + ey * ey;
  const t = lengthSquared ? Math.max(0, Math.min(1, (px * ex + py * ey) / lengthSquared)) : 0;
  const dx = px - ex * t;
  const dy = py - ey * t;
  return Math.hypot(dx, dy) * 111_320;
}

/**
 * Ramer-Douglas-Peucker. The map draws the simplified line; the full series stays in memory for
 * time lookup, because dropping a point there would move a photo.
 */
export function simplifyTrack(points: TrackPoint[], toleranceM = 8): TrackPoint[] {
  if (points.length < 3) return [...points];
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop()!;
    let farthest = -1;
    let worst = toleranceM;
    for (let index = first + 1; index < last; index += 1) {
      const distance = offsetMetres(points[index], points[first], points[last]);
      if (distance > worst) {
        worst = distance;
        farthest = index;
      }
    }
    if (farthest > 0) {
      keep[farthest] = 1;
      stack.push([first, farthest], [farthest, last]);
    }
  }
  return points.filter((_, index) => keep[index] === 1);
}

/** Splits the drawn line wherever recording paused, so a gap is not drawn as a straight leg. */
export function trackSegments(track: Track, toleranceM = 8): TrackPoint[][] {
  const bounds = [...track.segmentStarts, track.points.length];
  const segments: TrackPoint[][] = [];
  for (let index = 0; index < bounds.length - 1; index += 1) {
    const slice = track.points.slice(bounds[index], bounds[index + 1]);
    if (slice.length > 1) segments.push(simplifyTrack(slice, toleranceM));
  }
  return segments;
}

const escapeXml = (value: string) =>
  value.replace(/[<>&"']/g, (character) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[character] ?? character,
  );

export type GpxWaypoint = { name: string; time?: Date } & Coordinates & { elevation?: number };

/**
 * Writes the track back out with one waypoint per photo. Photo libraries geotag from exactly this
 * shape, so a journey corrected against the watch can be applied to the originals elsewhere.
 */
export function buildGpx(title: string, track: Track | undefined, waypoints: GpxWaypoint[]) {
  const point = (node: GpxWaypoint | TrackPoint, tag: "wpt" | "trkpt", name?: string) =>
    `<${tag} lat="${node.latitude}" lon="${node.longitude}">` +
    (node.elevation === undefined ? "" : `<ele>${node.elevation}</ele>`) +
    (node.time === undefined
      ? ""
      : `<time>${new Date(node.time).toISOString()}</time>`) +
    (name ? `<name>${escapeXml(name)}</name>` : "") +
    `</${tag}>`;
  const waypointXml = waypoints.map((mark) => point(mark, "wpt", mark.name)).join("\n");
  const trackXml = track
    ? `<trk><name>${escapeXml(title)}</name>${track.segmentStarts
        .map((start, index) => {
          const end = track.segmentStarts[index + 1] ?? track.points.length;
          return `<trkseg>${track.points
            .slice(start, end)
            .map((node) => point(node, "trkpt"))
            .join("")}</trkseg>`;
        })
        .join("")}</trk>`
    : "";
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<gpx version="1.1" creator="Photo Journey" xmlns="http://www.topografix.com/GPX/1/1">` +
    `<metadata><name>${escapeXml(title)}</name></metadata>${waypointXml}${trackXml}</gpx>`
  );
}
