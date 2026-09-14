import {
  ASCENT_THRESHOLD_M,
  simplifyTrack,
  trackSegments,
  type Track,
  type TrackPoint,
} from "./gpx";
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
  /** Exact indexes in the unsimplified source segment used by progress statistics. */
  startPointIndex?: number;
  endPointIndex?: number;
};

type RouteProgressProfile = {
  points: TrackPoint[];
  startTime?: number;
  cumulativeKm: number[];
  cumulativeAscentM: number[];
  cumulativeMovingSeconds: number[];
};

export type RecordedProgressStats = {
  time?: number;
  elapsedSeconds?: number;
  movingSeconds: number;
  distanceKm: number;
  elevationM?: number;
  ascentM: number;
};

export type RouteStory = {
  /** Every honest recording segment, shown faintly as geographic context. */
  context: TrackPoint[][];
  /** Destination-indexed legs. Undefined means playback must not imply recorded movement. */
  legs: Array<RecordedLeg | undefined>;
  /** Unsimplified cumulative values, built once so the live hike panel stays cheap per frame. */
  profiles: RouteProgressProfile[];
};

type SourceSegment = {
  points: TrackPoint[];
  /** Segments from one GPX track share hike totals across recorder pauses. */
  groupIndex: number;
};

function rawSegments(track: Track): SourceSegment[] {
  const parts = track.parts?.length
    ? track.parts
    : [{ points: track.points, segmentStarts: track.segmentStarts }];
  const segments: SourceSegment[] = [];
  for (const [groupIndex, part] of parts.entries()) {
    const starts = part.segmentStarts.length
      ? part.segmentStarts
      : part.points.length
        ? [0]
        : [];
    const bounds = [...starts, part.points.length];
    for (let index = 0; index < starts.length; index += 1) {
      const points = part.points.slice(bounds[index], bounds[index + 1]);
      if (points.length) segments.push({ points, groupIndex });
    }
  }
  return segments;
}

function sameCoordinates(point: Coordinates, placement: Placement) {
  const coordinates =
    placement.source === "track"
      ? placement.coordinates
      : placement.trackCoordinates;
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
    (placement.recordingSampleTime === undefined ||
      point.time === placement.recordingSampleTime) &&
    Math.abs(
      Math.abs(point.time - placement.instant) - placement.gapSeconds * 1000,
    ) < 0.5,
  );
}

type PlacementSample = { segmentIndex: number; pointIndex: number };

function exactPlacementSample(
  segments: readonly SourceSegment[],
  placement: Placement,
): PlacementSample | undefined {
  if (placement.ambiguous || placement.choiceUnavailable) return undefined;
  const matches: PlacementSample[] = [];
  segments.forEach((segment, segmentIndex) => {
    segment.points.forEach((point, pointIndex) => {
      if (isPlacementSample(point, placement))
        matches.push({ segmentIndex, pointIndex });
    });
  });
  return matches.length === 1 ? matches[0] : undefined;
}

function prepareLeg(
  candidate: Pick<
    RecordedLeg,
    "points" | "segmentIndex" | "startPointIndex" | "endPointIndex"
  >,
): RecordedLeg {
  const drawable = simplifyTrack(candidate.points);
  const cumulativeKm = [0];
  let total = 0;
  for (let index = 1; index < drawable.length; index += 1) {
    total += distanceKm(drawable[index - 1], drawable[index]);
    cumulativeKm.push(total);
  }
  return { ...candidate, drawable, cumulativeKm, distanceKm: total };
}

type ProgressBaseline = {
  startTime?: number;
  distanceKm: number;
  ascentM: number;
  movingSeconds: number;
};

function progressProfile(
  points: TrackPoint[],
  baseline: ProgressBaseline,
): RouteProgressProfile {
  const cumulativeKm = [baseline.distanceKm];
  const cumulativeAscentM = [baseline.ascentM];
  const cumulativeMovingSeconds = [baseline.movingSeconds];
  let distance = baseline.distanceKm;
  let ascent = baseline.ascentM;
  let movingSeconds = baseline.movingSeconds;
  let elevationAnchor = points[0]?.elevation;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const point = points[index];
    const stepKm = distanceKm(previous, point);
    distance += stepKm;
    const gapMs =
      point.time !== undefined && previous.time !== undefined
        ? point.time - previous.time
        : 0;
    if (gapMs > 0 && gapMs < 120_000 && stepKm > 0.001)
      movingSeconds += gapMs / 1000;
    if (point.elevation !== undefined) {
      if (elevationAnchor === undefined) elevationAnchor = point.elevation;
      else if (point.elevation - elevationAnchor >= ASCENT_THRESHOLD_M) {
        ascent += point.elevation - elevationAnchor;
        elevationAnchor = point.elevation;
      } else if (elevationAnchor - point.elevation >= ASCENT_THRESHOLD_M) {
        elevationAnchor = point.elevation;
      }
    }
    cumulativeKm.push(distance);
    cumulativeAscentM.push(ascent);
    cumulativeMovingSeconds.push(movingSeconds);
  }
  return {
    points,
    startTime: baseline.startTime,
    cumulativeKm,
    cumulativeAscentM,
    cumulativeMovingSeconds,
  };
}

function progressProfiles(segments: readonly SourceSegment[]) {
  const baselines = new Map<number, ProgressBaseline>();
  return segments.map(({ points, groupIndex }) => {
    const firstTime = points.find(
      (point) => point.time !== undefined && Number.isFinite(point.time),
    )?.time;
    const prior = baselines.get(groupIndex) ?? {
      startTime: firstTime,
      distanceKm: 0,
      ascentM: 0,
      movingSeconds: 0,
    };
    const baseline = { ...prior, startTime: prior.startTime ?? firstTime };
    const profile = progressProfile(points, baseline);
    const last = points.length - 1;
    baselines.set(groupIndex, {
      startTime: baseline.startTime ?? firstTime,
      distanceKm: profile.cumulativeKm[last],
      ascentM: profile.cumulativeAscentM[last],
      movingSeconds: profile.cumulativeMovingSeconds[last],
    });
    return profile;
  });
}

export function buildRouteStory(
  track: Track,
  placements: readonly Placement[] | undefined,
  structuralEligibility: readonly boolean[] | undefined,
): RouteStory {
  const segments = rawSegments(track);
  const samples = (placements ?? []).map((placement) =>
    exactPlacementSample(segments, placement),
  );
  const reachedBySegment = new Map<number, number>();
  const legs = samples.map((sample, index) => {
    if (!sample) return undefined;
    const previous = reachedBySegment.get(sample.segmentIndex) ?? -1;
    if (sample.pointIndex <= previous) return undefined;
    reachedBySegment.set(sample.segmentIndex, sample.pointIndex);
    if (!structuralEligibility?.[index] || sample.pointIndex === 0)
      return undefined;
    const candidate = {
      segmentIndex: sample.segmentIndex,
      startPointIndex: Math.max(0, previous),
      endPointIndex: sample.pointIndex,
      points: segments[sample.segmentIndex].points.slice(
        Math.max(0, previous),
        sample.pointIndex + 1,
      ),
    };
    const valid = candidate.points.every(
      (point, pointIndex) =>
        point.time !== undefined &&
        Number.isFinite(point.time) &&
        (pointIndex === 0 ||
          point.time! > candidate.points[pointIndex - 1].time!),
    );
    return valid && candidate.points.length > 1
      ? prepareLeg(candidate)
      : undefined;
  });
  return {
    context: trackSegments(track),
    legs,
    profiles: progressProfiles(segments),
  };
}

function normalizedLongitude(longitude: number) {
  const wrapped = ((((longitude + 180) % 360) + 360) % 360) - 180;
  return wrapped === -180 && longitude > 0 ? 180 : wrapped;
}

function interpolate(
  start: TrackPoint,
  end: TrackPoint,
  progress: number,
): TrackPoint {
  const longitudeDelta = ((end.longitude - start.longitude + 540) % 360) - 180;
  const elevation =
    start.elevation === undefined || end.elevation === undefined
      ? undefined
      : start.elevation + (end.elevation - start.elevation) * progress;
  const time =
    start.time === undefined || end.time === undefined
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
export function routePrefix(
  points: readonly TrackPoint[],
  progress: number,
): TrackPoint[] {
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
    output.push(
      interpolate(
        points[index - 1],
        points[index],
        (target - before) / (after - before),
      ),
    );
    break;
  }
  return output;
}

/** Uses precomputed distances so each animation frame only locates and copies its visible prefix. */
export function recordedLegPrefix(
  leg: RecordedLeg,
  progress: number,
): TrackPoint[] {
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
    interpolate(
      leg.drawable[low - 1],
      leg.drawable[low],
      (target - before) / (after - before),
    ),
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
  return interpolate(
    leg.drawable[low - 1],
    leg.drawable[low],
    (target - before) / Math.max(Number.EPSILON, after - before),
  );
}

function firstDistanceAtLeast(distances: readonly number[], target: number) {
  let low = 0;
  let high = distances.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (distances[middle] < target) low = middle + 1;
    else high = middle;
  }
  return low;
}

function firstDistanceGreaterThan(
  distances: readonly number[],
  target: number,
) {
  let low = 0;
  let high = distances.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (distances[middle] <= target) low = middle + 1;
    else high = middle;
  }
  return low;
}

/** Samples the moving camera without copying the increasingly long revealed route. */
export function recordedLegCameraFrame(
  leg: RecordedLeg,
  progress: number,
  behindKm = 0.25,
  aheadKm = 0.75,
) {
  const travelledKm = Math.min(
    leg.distanceKm,
    Math.max(0, leg.distanceKm * progress),
  );
  const startKm = Math.max(0, travelledKm - behindKm);
  const endKm = Math.min(leg.distanceKm, travelledKm + aheadKm);
  const start = pointAtDistance(leg, startKm);
  const end = pointAtDistance(leg, endKm);
  const first = firstDistanceGreaterThan(leg.cumulativeKm, startKm);
  const last = firstDistanceAtLeast(leg.cumulativeKm, endKm);
  const window = [
    ...(start ? [start] : []),
    ...leg.drawable.slice(first, last),
    ...(end ? [end] : []),
  ];
  return { tip: pointAtDistance(leg, travelledKm), window, travelledKm };
}

/** One deterministic sample feeds the revealed line, moving marker, and route-window camera. */
export function recordedLegFrame(
  leg: RecordedLeg,
  progress: number,
  behindKm = 0.25,
  aheadKm = 0.75,
) {
  const camera = recordedLegCameraFrame(leg, progress, behindKm, aheadKm);
  const revealed = recordedLegPrefix(leg, progress);
  return { ...camera, revealed };
}

const interpolateValue = (start: number, end: number, progress: number) =>
  start + (end - start) * progress;

/** Returns real GPX progress for the map-only part of playback. */
export function recordedProgressStats(
  story: RouteStory | undefined,
  activePhotoIndex: number,
  progress: number,
): RecordedProgressStats | undefined {
  const leg = story?.legs[activePhotoIndex];
  if (
    !leg ||
    leg.startPointIndex === undefined ||
    leg.endPointIndex === undefined
  )
    return undefined;
  const profile = story.profiles[leg.segmentIndex];
  if (!profile?.points.length) return undefined;
  const startDistance = profile.cumulativeKm[leg.startPointIndex];
  const endDistance = profile.cumulativeKm[leg.endPointIndex];
  if (startDistance === undefined || endDistance === undefined)
    return undefined;
  const safeProgress = Math.min(1, Math.max(0, progress));
  const targetDistance = interpolateValue(
    startDistance,
    endDistance,
    safeProgress,
  );
  let beforeIndex: number;
  let afterIndex: number;
  let fraction: number;
  if (safeProgress <= 0) {
    beforeIndex = leg.startPointIndex;
    afterIndex = leg.startPointIndex;
    fraction = 0;
  } else if (safeProgress >= 1) {
    beforeIndex = leg.endPointIndex;
    afterIndex = leg.endPointIndex;
    fraction = 0;
  } else if (endDistance === startDistance) {
    const pointProgress = interpolateValue(
      leg.startPointIndex,
      leg.endPointIndex,
      safeProgress,
    );
    beforeIndex = Math.floor(pointProgress);
    afterIndex = Math.ceil(pointProgress);
    fraction = pointProgress - beforeIndex;
  } else {
    // Use an upper bound so an exact stationary run resolves to its latest sample.
    let low = Math.max(1, leg.startPointIndex + 1);
    let high = leg.endPointIndex;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (profile.cumulativeKm[middle] <= targetDistance) low = middle + 1;
      else high = middle;
    }
    if (profile.cumulativeKm[low] <= targetDistance) {
      beforeIndex = low;
      afterIndex = low;
      fraction = 0;
    } else {
      afterIndex = low;
      beforeIndex = Math.max(leg.startPointIndex, afterIndex - 1);
      const beforeDistance = profile.cumulativeKm[beforeIndex];
      const afterDistance = profile.cumulativeKm[afterIndex];
      fraction =
        afterDistance > beforeDistance
          ? (targetDistance - beforeDistance) / (afterDistance - beforeDistance)
          : 0;
    }
  }
  const before = profile.points[beforeIndex];
  const after = profile.points[afterIndex];
  const optionalValue = (
    first: number | undefined,
    second: number | undefined,
  ) =>
    first === undefined || second === undefined
      ? (first ?? second)
      : interpolateValue(first, second, fraction);
  const time = optionalValue(before.time, after.time);
  const segmentStartTime = profile.startTime;
  return {
    time,
    elapsedSeconds:
      time === undefined || segmentStartTime === undefined
        ? undefined
        : Math.max(0, (time - segmentStartTime) / 1000),
    movingSeconds: interpolateValue(
      profile.cumulativeMovingSeconds[beforeIndex],
      profile.cumulativeMovingSeconds[afterIndex],
      fraction,
    ),
    distanceKm: targetDistance,
    elevationM: optionalValue(before.elevation, after.elevation),
    ascentM: interpolateValue(
      profile.cumulativeAscentM[beforeIndex],
      profile.cumulativeAscentM[afterIndex],
      fraction,
    ),
  };
}
