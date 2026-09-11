import { distanceKm } from "./timeline";
import type { Coordinates } from "./types";

/** One recorded fix. `time` is a true instant in epoch milliseconds; GPX always states UTC. */
export type TrackPoint = Coordinates & { elevation?: number; time?: number };

export type TrackPart = {
  name?: string;
  points: TrackPoint[];
  segmentStarts: number[];
};

export type Track = {
  name?: string;
  /** Every point, in recorded order, used for time lookup. */
  points: TrackPoint[];
  /** Index into `points` where each recorded segment starts. A pause splits a segment. */
  segmentStarts: number[];
  /** Supported `<trk>` boundaries retained for source-aware exports. */
  parts?: TrackPart[];
};

export type TimedPoint = {
  point: TrackPoint;
  /** Position in the original recorded geometry, never the sorted lookup order. */
  pointIndex: number;
  trackIndex?: number;
  segmentIndex?: number;
  sourceId?: string;
};

export type TimedIndex = { points: TimedPoint[]; sourceId?: string };

/** Returns explicit segment boundaries, treating a non-empty legacy track as one segment. */
function segmentStartsFor(track: Track) {
  if (track.segmentStarts.length) return track.segmentStarts;
  if (track.parts?.length) {
    const starts: number[] = [];
    let offset = 0;
    for (const part of track.parts) {
      const partStarts = part.segmentStarts.length ? part.segmentStarts : part.points.length ? [0] : [];
      for (const start of partStarts) starts.push(offset + start);
      offset += part.points.length;
    }
    return starts;
  }
  return track.points.length ? [0] : [];
}

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

/** GPX time is only comparable when the source states its zone explicitly. */
function parseTrackTime(value?: string | null) {
  const text = value?.trim();
  if (!text || !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)) return undefined;
  const parsed = Date.parse(text);
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
  const parts: TrackPart[] = [];
  for (const sourceTrack of Array.from(document.querySelectorAll("trk"))) {
    const points: TrackPoint[] = [];
    const segmentStarts: number[] = [];
    for (const segment of sourceTrack.querySelectorAll(":scope > trkseg")) {
      let opened = false;
      for (const node of segment.querySelectorAll(":scope > trkpt")) {
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
        const parsedTime = parseTrackTime(node.querySelector(":scope > time")?.textContent);
        if (!opened) {
          segmentStarts.push(points.length);
          opened = true;
        }
        points.push({
          latitude,
          longitude,
          elevation: readNumber(node.querySelector(":scope > ele")?.textContent?.trim() ?? null),
          time: parsedTime,
        });
      }
    }
    if (points.length) parts.push({
      name: sourceTrack.querySelector(":scope > name")?.textContent?.trim() || undefined,
      points,
      segmentStarts,
    });
  }
  // A few exporters omit `<trk>` and place segments directly under the root. Keep accepting that
  // shape while still giving the source one part for later exports.
  if (!parts.length) {
    const points: TrackPoint[] = [];
    const segmentStarts: number[] = [];
    for (const segment of document.querySelectorAll("trkseg")) {
      let opened = false;
      for (const node of segment.querySelectorAll("trkpt")) {
        const latitude = readNumber(node.getAttribute("lat"));
        const longitude = readNumber(node.getAttribute("lon"));
        if (latitude === undefined || longitude === undefined || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) continue;
        const parsedTime = parseTrackTime(node.querySelector("time")?.textContent);
        if (!opened) { segmentStarts.push(points.length); opened = true; }
        points.push({ latitude, longitude, elevation: readNumber(node.querySelector("ele")?.textContent?.trim() ?? null), time: parsedTime });
      }
    }
    if (points.length) parts.push({ points, segmentStarts });
  }
  const points = parts.flatMap((part) => part.points);
  const segmentStarts: number[] = [];
  let offset = 0;
  for (const part of parts) {
    for (const start of part.segmentStarts) segmentStarts.push(start + offset);
    offset += part.points.length;
  }
  if (!points.length) throw new Error("This GPX file has no track points.");
  return {
    name: parts[0]?.name ?? (document.querySelector("trk > name")?.textContent?.trim() || undefined),
    points,
    segmentStarts,
    parts,
  };
}

/** Merges several files into one track, ordered by time, so a split recording plays as one tour. */
export function mergeTracks(tracks: Track[]): Track {
  const ordered = [...tracks].sort(
    (a, b) => (a.points[0]?.time ?? 0) - (b.points[0]?.time ?? 0),
  );
  const points: TrackPoint[] = [];
  const segmentStarts: number[] = [];
  const parts: TrackPart[] = [];
  for (const track of ordered) {
    for (const start of segmentStartsFor(track)) segmentStarts.push(start + points.length);
    for (const point of track.points) points.push(point);
    if (track.parts?.length) {
      for (const part of track.parts) {
        parts.push({ name: part.name, points: [...part.points], segmentStarts: [...part.segmentStarts] });
      }
    } else {
      parts.push({ name: track.name, points: [...track.points], segmentStarts: [...track.segmentStarts] });
    }
  }
  return { name: ordered[0]?.name, points, segmentStarts, parts };
}

export function trackStats(track: Track): TrackStats {
  const { points } = track;
  let distance = 0;
  let ascent = 0;
  let descent = 0;
  let moving = 0;
  let minElevation: number | undefined;
  let maxElevation: number | undefined;
  let minTime: number | undefined;
  let maxTime: number | undefined;
  const starts = segmentStartsFor(track);
  const bounds = [...starts, points.length];
  for (let segmentIndex = 0; segmentIndex < bounds.length - 1; segmentIndex += 1) {
    const start = bounds[segmentIndex];
    const end = bounds[segmentIndex + 1];
    let anchor: number | undefined;
    let previous: TrackPoint | undefined;
    for (let index = start; index < end; index += 1) {
      const point = points[index];
      if (point.elevation !== undefined) {
        minElevation = minElevation === undefined ? point.elevation : Math.min(minElevation, point.elevation);
        maxElevation = maxElevation === undefined ? point.elevation : Math.max(maxElevation, point.elevation);
        if (anchor === undefined) anchor = point.elevation;
      }
      if (point.time !== undefined) {
        minTime = minTime === undefined ? point.time : Math.min(minTime, point.time);
        maxTime = maxTime === undefined ? point.time : Math.max(maxTime, point.time);
      }
      if (!previous) { previous = point; continue; }
      const step = distanceKm(previous, point);
      distance += step;
      const gap = point.time !== undefined && previous.time !== undefined ? point.time - previous.time : 0;
      // A pause is not travel. Long gaps and standing still are both excluded from moving time.
      if (gap > 0 && gap < 120_000 && step > 0.001) moving += gap / 1000;
      if (point.elevation !== undefined && anchor !== undefined) {
        if (point.elevation - anchor >= ASCENT_THRESHOLD_M) {
          ascent += point.elevation - anchor;
          anchor = point.elevation;
        } else if (anchor - point.elevation >= ASCENT_THRESHOLD_M) {
          descent += anchor - point.elevation;
          anchor = point.elevation;
        }
      }
      previous = point;
    }
  }
  return {
    distanceKm: distance,
    ascentM: ascent,
    descentM: descent,
    minElevation,
    maxElevation,
    start: minTime === undefined ? undefined : new Date(minTime),
    end: maxTime === undefined ? undefined : new Date(maxTime),
    movingSeconds: moving,
    pointCount: points.length,
  };
}

/**
 * Finds the point recorded closest to an instant. The series is time-ordered, so this is a binary
 * search rather than a scan; a day of one-second fixes is tens of thousands of points.
 */
export function pointAtTime(track: Track, instant: number) {
  return pointAtTimedIndex(buildTimedIndex(track), instant);
}

/** Sorts timestamp references without changing recorded geometry order. */
export function buildTimedIndex(track: Track, sourceId?: string): TimedIndex {
  const points: TimedPoint[] = [];
  if (track.parts?.length) {
    let offset = 0;
    for (const [trackIndex, part] of track.parts.entries()) {
      const starts = part.segmentStarts.length ? part.segmentStarts : [0];
      const bounds = [...starts, part.points.length];
      for (let segmentIndex = 0; segmentIndex < starts.length; segmentIndex += 1) {
        for (let localIndex = bounds[segmentIndex]; localIndex < bounds[segmentIndex + 1]; localIndex += 1) {
          const point = part.points[localIndex];
          if (point.time === undefined || !Number.isFinite(point.time)) continue;
          points.push({ point, pointIndex: offset + localIndex, trackIndex, segmentIndex, sourceId });
        }
      }
      offset += part.points.length;
    }
  } else {
    const starts = segmentStartsFor(track);
    const bounds = [...starts, track.points.length];
    for (let segmentIndex = 0; segmentIndex < starts.length; segmentIndex += 1) {
      for (let pointIndex = bounds[segmentIndex]; pointIndex < bounds[segmentIndex + 1]; pointIndex += 1) {
        const point = track.points[pointIndex];
        if (point.time === undefined || !Number.isFinite(point.time)) continue;
        points.push({ point, pointIndex, segmentIndex, sourceId });
      }
    }
  }
  points.sort((a, b) => (a.point.time! - b.point.time!) || (a.pointIndex - b.pointIndex));
  return { points, sourceId };
}

export function pointAtTimedIndex(index: TimedIndex, instant: number) {
  const timed = index.points;
  if (!timed.length) return undefined;
  let low = 0;
  let high = timed.length - 1;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (timed[middle].point.time! < instant) low = middle + 1;
    else high = middle;
  }
  let best = low;
  let bestGap = Number.POSITIVE_INFINITY;
  for (const candidate of [low - 1, low, low + 1]) {
    const entry = timed[candidate];
    if (!entry) continue;
    const gapMs = Math.abs(entry.point.time! - instant);
    if (gapMs < bestGap) { best = candidate; bestGap = gapMs; }
  }
  // Keep ties at the same nearest distance so callers can surface duplicate timestamps at
  // different positions instead of silently picking the first source/segment.
  const alternatives: TimedPoint[] = [];
  for (let candidate = best - 1; candidate >= 0; candidate -= 1) {
    const gapMs = Math.abs(timed[candidate].point.time! - instant);
    if (gapMs > bestGap) break;
    if (candidate !== best) alternatives.push(timed[candidate]);
  }
  for (let candidate = best + 1; candidate < timed.length; candidate += 1) {
    const gapMs = Math.abs(timed[candidate].point.time! - instant);
    if (gapMs > bestGap) break;
    alternatives.push(timed[candidate]);
  }
  return { index: timed[best].pointIndex, ...timed[best], gapMs: bestGap, alternatives };
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
  const starts = segmentStartsFor(track);
  const bounds = [...starts, track.points.length];
  const segments: TrackPoint[][] = [];
  for (let index = 0; index < bounds.length - 1; index += 1) {
    const slice = track.points.slice(bounds[index], bounds[index + 1]);
    if (slice.length) segments.push(simplifyTrack(slice, toleranceM));
  }
  return segments;
}

const escapeXml = (value: string) =>
  value.replace(/[<>&"']/g, (character) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[character] ?? character,
  );

export type GpxWaypoint = { name: string; time?: Date } & Coordinates & { elevation?: number };

/**
 * Writes the supported recorded structure back out with one waypoint per placed photo. The
 * destination tool decides whether and how those waypoints are applied; source files stay intact.
 */
export function buildGpx(title: string, track: Track | undefined, waypoints: GpxWaypoint[]) {
  const point = (node: GpxWaypoint | TrackPoint, tag: "wpt" | "trkpt", name?: string) => {
    const rawTime = node.time instanceof Date ? node.time.valueOf() : node.time;
    const time = typeof rawTime === "number" && Number.isFinite(rawTime) ? new Date(rawTime) : undefined;
    return (
    `<${tag} lat="${node.latitude}" lon="${node.longitude}">` +
    (node.elevation === undefined ? "" : `<ele>${node.elevation}</ele>`) +
    (time === undefined
      ? ""
      : `<time>${time.toISOString()}</time>`) +
    (name ? `<name>${escapeXml(name)}</name>` : "") +
    `</${tag}>`
    );
  };
  const waypointXml = waypoints.map((mark) => point(mark, "wpt", mark.name)).join("\n");
  const sourceParts = track?.parts?.length
    ? track.parts
    : track
      ? [{ name: track.name, points: track.points, segmentStarts: track.segmentStarts }]
      : [];
  const trackXml = sourceParts
    .map((part) => {
      const starts = part.segmentStarts.length ? part.segmentStarts : [0];
      const bounds = [...starts, part.points.length];
      const segments = starts
        .map((start, index) => `<trkseg>${part.points.slice(start, bounds[index + 1]).map((node) => point(node, "trkpt")).join("")}</trkseg>`)
        .join("");
      return `<trk>${part.name ? `<name>${escapeXml(part.name)}</name>` : `<name>${escapeXml(title)}</name>`}${segments}</trk>`;
    })
    .join("");
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<gpx version="1.1" creator="Photo Journey" xmlns="http://www.topografix.com/GPX/1/1">` +
    `<metadata><name>${escapeXml(title)}</name></metadata>${waypointXml}${trackXml}</gpx>`
  );
}
