import { simplifyTrack, trackSegments, type Track, type TrackPoint } from "./gpx";
import { distanceKm } from "./timeline";
import type { Placement } from "./track";
import type { Coordinates } from "./types";

export type RecordedLeg = {
  /** The exact source segment slice between two explicitly resolved photo placements. */
  points: TrackPoint[];
  segmentIndex: number;
  /** Simplified once so playback frames never rescan a recording-sized source. */
  drawable: TrackPoint[];
  cumulativeKm: number[];
  distanceKm: number;
};

export type RouteStory = {
  /** Every honest recording segment, shown faintly as geographic context. */
  context: TrackPoint[][];
  /** Destination-indexed legs. Undefined means playback must not imply recorded movement. */
  legs: Array<RecordedLeg | undefined>;
};

function rawSegments(track: Track) {
  const parts = track.parts?.length
    ? track.parts
    : [{ points: track.points, segmentStarts: track.segmentStarts }];
  const segments: TrackPoint[][] = [];
  for (const part of parts) {
    const starts = part.segmentStarts.length ? part.segmentStarts : part.points.length ? [0] : [];
    const bounds = [...starts, part.points.length];
    for (let index = 0; index < starts.length; index += 1) {
      const points = part.points.slice(bounds[index], bounds[index + 1]);
      if (points.length) segments.push(points);
    }
  }
  return segments;
}

function sameCoordinates(point: Coordinates, placement: Placement) {
  const coordinates = placement.source === "track" ? placement.coordinates : placement.trackCoordinates;
  return Boolean(
    coordinates &&
    point.latitude === coordinates.latitude &&
    point.longitude === coordinates.longitude,
  );
}

/**
 * A track placement records its exact nearest-sample gap. Requiring both coordinate and gap
 * identity lets presentation recover that sample without making a second nearest-point choice.
 */
function isPlacementSample(point: TrackPoint, placement: Placement) {
  return Boolean(
    sameCoordinates(point, placement) &&
    point.time !== undefined &&
    placement.instant !== undefined &&
    placement.gapSeconds !== undefined &&
    (placement.recordingSampleTime === undefined || point.time === placement.recordingSampleTime) &&
    Math.abs(Math.abs(point.time - placement.instant) - placement.gapSeconds * 1000) < 0.5,
  );
}

type PlacementSample = { segmentIndex: number; pointIndex: number };

function exactPlacementSample(
  segments: readonly TrackPoint[][],
  placement: Placement,
): PlacementSample | undefined {
  if (placement.ambiguous || placement.choiceUnavailable) return undefined;
  const matches: PlacementSample[] = [];
  segments.forEach((segment, segmentIndex) => {
    segment.forEach((point, pointIndex) => {
      if (isPlacementSample(point, placement)) matches.push({ segmentIndex, pointIndex });
    });
  });
  return matches.length === 1 ? matches[0] : undefined;
}

function prepareLeg(candidate: Pick<RecordedLeg, "points" | "segmentIndex">): RecordedLeg {
  const drawable = simplifyTrack(candidate.points);
  const cumulativeKm = [0];
  let total = 0;
  for (let index = 1; index < drawable.length; index += 1) {
    total += distanceKm(drawable[index - 1], drawable[index]);
    cumulativeKm.push(total);
  }
  return { ...candidate, drawable, cumulativeKm, distanceKm: total };
}

export function buildRouteStory(
  track: Track,
  placements: readonly Placement[] | undefined,
  structuralEligibility: readonly boolean[] | undefined,
): RouteStory {
  const segments = rawSegments(track);
  const samples = (placements ?? []).map((placement) => exactPlacementSample(segments, placement));
  const reachedBySegment = new Map<number, number>();
  const legs = samples.map((sample, index) => {
    if (!sample) return undefined;
    const previous = reachedBySegment.get(sample.segmentIndex) ?? -1;
    if (sample.pointIndex <= previous) return undefined;
    reachedBySegment.set(sample.segmentIndex, sample.pointIndex);
    if (!structuralEligibility?.[index] || sample.pointIndex === 0) return undefined;
    const candidate = {
      segmentIndex: sample.segmentIndex,
      points: segments[sample.segmentIndex].slice(Math.max(0, previous), sample.pointIndex + 1),
    };
    const valid = candidate.points.every((point, pointIndex) =>
      point.time !== undefined && Number.isFinite(point.time) &&
      (pointIndex === 0 || point.time! > candidate.points[pointIndex - 1].time!),
    );
    return valid && candidate.points.length > 1 ? prepareLeg(candidate) : undefined;
  });
  return { context: trackSegments(track), legs };
}

function normalizedLongitude(longitude: number) {
  const wrapped = ((longitude + 180) % 360 + 360) % 360 - 180;
  return wrapped === -180 && longitude > 0 ? 180 : wrapped;
}

function interpolate(start: TrackPoint, end: TrackPoint, progress: number): TrackPoint {
  const longitudeDelta = ((end.longitude - start.longitude + 540) % 360) - 180;
  const elevation = start.elevation === undefined || end.elevation === undefined
    ? undefined
    : start.elevation + (end.elevation - start.elevation) * progress;
  const time = start.time === undefined || end.time === undefined
    ? undefined
    : start.time + (end.time - start.time) * progress;
  return {
    latitude: start.latitude + (end.latitude - start.latitude) * progress,
    longitude: normalizedLongitude(start.longitude + longitudeDelta * progress),
    elevation,
    time,
  };
}

/** Clips a known recorded leg by travelled distance, retaining an exact, monotonic prefix. */
export function routePrefix(points: readonly TrackPoint[], progress: number): TrackPoint[] {
  if (!points.length) return [];
  if (progress <= 0) return [points[0]];
  if (progress >= 1) return [...points];
  const distances: number[] = [];
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += distanceKm(points[index - 1], points[index]);
    distances.push(total);
  }
  if (total === 0) return [points[0]];
  const target = total * progress;
  const output: TrackPoint[] = [points[0]];
  for (let index = 1; index < points.length; index += 1) {
    const before = distances[index - 2] ?? 0;
    const after = distances[index - 1];
    if (after <= target) {
      output.push(points[index]);
      continue;
    }
    output.push(interpolate(points[index - 1], points[index], (target - before) / (after - before)));
    break;
  }
  return output;
}

/** Uses precomputed distances so each animation frame only locates and copies its visible prefix. */
export function recordedLegPrefix(leg: RecordedLeg, progress: number): TrackPoint[] {
  if (!leg.drawable.length) return [];
  if (progress <= 0 || leg.distanceKm === 0) return [leg.drawable[0]];
  if (progress >= 1) return [...leg.drawable];
  const target = leg.distanceKm * progress;
  let low = 1;
  let high = leg.cumulativeKm.length - 1;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (leg.cumulativeKm[middle] < target) low = middle + 1;
    else high = middle;
  }
  const before = leg.cumulativeKm[low - 1];
  const after = leg.cumulativeKm[low];
  return [
    ...leg.drawable.slice(0, low),
    interpolate(leg.drawable[low - 1], leg.drawable[low], (target - before) / (after - before)),
  ];
}

function pointAtDistance(leg: RecordedLeg, target: number) {
  if (!leg.drawable.length) return undefined;
  if (target <= 0) return leg.drawable[0];
  if (target >= leg.distanceKm) return leg.drawable.at(-1);
  let low = 1;
  let high = leg.cumulativeKm.length - 1;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (leg.cumulativeKm[middle] < target) low = middle + 1;
    else high = middle;
  }
  const before = leg.cumulativeKm[low - 1];
  const after = leg.cumulativeKm[low];
  return interpolate(leg.drawable[low - 1], leg.drawable[low], (target - before) / Math.max(Number.EPSILON, after - before));
}

/** One deterministic sample feeds the revealed line, moving marker, and route-window camera. */
export function recordedLegFrame(leg: RecordedLeg, progress: number, behindKm = 0.25, aheadKm = 0.75) {
  const travelledKm = Math.min(leg.distanceKm, Math.max(0, leg.distanceKm * progress));
  const startKm = Math.max(0, travelledKm - behindKm);
  const endKm = Math.min(leg.distanceKm, travelledKm + aheadKm);
  const window = [pointAtDistance(leg, startKm)!];
  leg.drawable.forEach((point, index) => {
    const distance = leg.cumulativeKm[index];
    if (distance > startKm && distance < endKm) window.push(point);
  });
  const end = pointAtDistance(leg, endKm);
  if (end) window.push(end);
  const revealed = recordedLegPrefix(leg, progress);
  return { revealed, tip: revealed.at(-1), window, travelledKm };
}
