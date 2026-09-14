import type { Placement } from "./track";
import type { Coordinates, JourneyPhoto } from "./types";

export const INTRO_DURATION = 900;
export const DAY_DURATION = 900;
export const OUTRO_DURATION = 3000;
export const REVEAL_DURATION = 520;
export const HOLD_DURATION = 3500;
export const DEPARTURE_DURATION = 420;
export const BURST_HOLD_DURATION = 1800;
export const BURST_TRANSITION_DURATION = 220;

export type JourneyPhase =
  | "overview"
  | "intro"
  | "day"
  | "approach"
  | "reveal"
  | "hold"
  | "departure"
  | "outro"
  | "complete";
export type TimelineState = {
  photoIndex: number;
  phase: JourneyPhase;
  /** Progress within the current phase, always clamped to 0...1. */
  phaseProgress: number;
  /** Absolute phase boundaries on the authoritative playback timeline. */
  phaseStart: number;
  phaseEnd: number;
  phaseDuration: number;
  phaseRemaining: number;
  panelVisible: boolean;
  dayLabel?: string;
  dayChange: boolean;
  approachDuration: number;
  /** Progress toward the active stop; stable at one after arrival. */
  currentLegProgress: number;
  /** Structural eligibility. The map also verifies one unique recorded segment before revealing it. */
  currentLegEligible: boolean;
  /** Route destination for this checkpoint; unlike photoIndex it does not advance within a burst. */
  checkpointPhotoIndex: number;
  checkpointIndex: number;
  checkpointProgress: number;
  drawerProgress: number;
  imageProgress: number;
};
export type TimelineStop = {
  id: string;
  checkpointIndex: number;
  photoIndex: number;
  photoIndices: number[];
  start: number;
  duration: number;
  approachDuration: number;
  revealStart: number;
  revealEnd: number;
  departureStart: number;
  end: number;
  dayStart: number;
  dayLabel?: string;
  dayChange: boolean;
  legEligible: boolean;
  burst: boolean;
};
export type JourneyTimeline = {
  stops: TimelineStop[];
  totalDuration: number;
  /** Photo-indexed because recorded route legs are bounded by consecutive photos. */
  legEligibility: boolean[];
  dayChanges: boolean[];
};

const clamp = (value: number) => Math.min(1, Math.max(0, value));

export function distanceKm(a: Coordinates, b: Coordinates) {
  const radians = Math.PI / 180;
  const value =
    Math.sin(((b.latitude - a.latitude) * radians) / 2) ** 2 +
    Math.cos(a.latitude * radians) *
      Math.cos(b.latitude * radians) *
      Math.sin(((b.longitude - a.longitude) * radians) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, value)));
}

/** A moving route is shown only when two stops explicitly use one recording and advance in time. */
export function placementLegEligibility(
  placements: readonly Placement[] | undefined,
  dayKeys: ReadonlyArray<string | undefined> | undefined,
) {
  return placements?.map((placement, index) => {
    const previous = placements[index - 1];
    const hasRecordedSample = (entry: Placement) =>
      entry.source === "track"
        ? Boolean(entry.coordinates)
        : Boolean(entry.trackCoordinates);
    if (
      !hasRecordedSample(placement) ||
      !placement.recordingId ||
      !placement.recordingSegmentId
    )
      return false;
    if (placement.ambiguous || placement.choiceUnavailable) return false;
    const day = dayKeys?.[index];
    const previousDay = dayKeys?.[index - 1];
    if (previous && day && previousDay && day !== previousDay) return false;
    const entry =
      !previous ||
      placement.recordingId !== previous.recordingId ||
      placement.recordingSegmentId !== previous.recordingSegmentId;
    if (entry) return (placement.recordingDistanceKm ?? 0) > 0.001;
    if (!hasRecordedSample(previous)) return false;
    if (previous.ambiguous || previous.choiceUnavailable) return false;
    if (
      placement.instant === undefined ||
      previous.instant === undefined ||
      placement.instant <= previous.instant
    )
      return false;
    return !day || !previousDay || day === previousDay;
  });
}

export function recordedApproachDuration(distanceKm: number, entry: boolean) {
  if (distanceKm <= 0.001) return 0;
  return entry
    ? Math.min(8_000, Math.max(3_000, 3_000 + distanceKm * 700))
    : Math.min(6_000, Math.max(1_000, 1_000 + distanceKm * 450));
}

/** Geometry order is never changed to enable timed playback. */
export function buildTimeline(
  photos: JourneyPhoto[],
  positions?: ReadonlyArray<Coordinates | undefined>,
  instants?: ReadonlyArray<number | undefined>,
  options?: {
    /** Calendar keys and labels derived from the selected trip timezone. */
    dayKeys?: ReadonlyArray<string | undefined>;
    dayLabels?: ReadonlyArray<string | undefined>;
    /** Per-destination structural eligibility for a recorded leg. */
    legEligibility?: ReadonlyArray<boolean | undefined>;
    recordingIds?: ReadonlyArray<string | undefined>;
    recordingSegmentIds?: ReadonlyArray<string | undefined>;
    recordingDistancesKm?: ReadonlyArray<number | undefined>;
    /** Exact validated distance of each destination-indexed recorded leg. */
    recordedLegDistancesKm?: ReadonlyArray<number | undefined>;
    located?: ReadonlyArray<boolean | undefined>;
  },
): JourneyTimeline {
  const positionOf = (index: number) =>
    positions ? positions[index] : photos[index]?.metadata.coordinates;
  const recordedLegDistances: Array<number | undefined> =
    options?.recordedLegDistancesKm ? [...options.recordedLegDistancesKm] : [];
  const reachedBySegment = new Map<string, number>();
  if (!options?.recordedLegDistancesKm)
    photos.forEach((_, index) => {
      const segment = options?.recordingSegmentIds?.[index];
      const distance = options?.recordingDistancesKm?.[index];
      if (!segment || distance === undefined) return;
      const reached = reachedBySegment.get(segment) ?? 0;
      if (options?.legEligibility?.[index] && distance > reached)
        recordedLegDistances[index] = distance - reached;
      reachedBySegment.set(segment, Math.max(reached, distance));
    });
  let offset = photos.length ? INTRO_DURATION : 0;
  let day = 0;
  let lastDay: string | undefined;
  let lastPosition: Coordinates | undefined;
  const groups: number[][] = [];
  photos.forEach((photo, photoIndex) => {
    const previousIndex = photoIndex - 1;
    const own = positionOf(photoIndex);
    const previous = photos[previousIndex];
    const previousPosition = positionOf(previousIndex);
    const instant =
      instants?.[photoIndex] ?? photo.metadata.capturedAt?.getTime();
    const previousInstant =
      instants?.[previousIndex] ?? previous?.metadata.capturedAt?.getTime();
    const day = options?.dayKeys?.[photoIndex];
    const previousDay = options?.dayKeys?.[previousIndex];
    const recording = options?.recordingIds?.[photoIndex];
    const previousRecording = options?.recordingIds?.[previousIndex];
    const segment = options?.recordingSegmentIds?.[photoIndex];
    const previousSegment = options?.recordingSegmentIds?.[previousIndex];
    const recordingDistance = options?.recordingDistancesKm?.[photoIndex];
    const previousRecordingDistance =
      options?.recordingDistancesKm?.[previousIndex];
    const groupStartIndex = groups.at(-1)?.[0];
    const groupStartRecordingDistance =
      groupStartIndex === undefined
        ? undefined
        : options?.recordingDistancesKm?.[groupStartIndex];
    const recordedPathStaysAtStop =
      recordingDistance === undefined ||
      previousRecordingDistance === undefined ||
      Math.abs(recordingDistance - previousRecordingDistance) < 0.05;
    const recordedBurstStaysAtStop =
      recordingDistance === undefined ||
      groupStartRecordingDistance === undefined ||
      Math.abs(recordingDistance - groupStartRecordingDistance) < 0.05;
    const canGroup =
      previousIndex >= 0 &&
      own &&
      previousPosition &&
      options?.located?.[photoIndex] !== false &&
      options?.located?.[previousIndex] !== false &&
      instant !== undefined &&
      previousInstant !== undefined &&
      instant >= previousInstant &&
      Math.floor(instant / 60000) === Math.floor(previousInstant / 60000) &&
      distanceKm(own, previousPosition) < 0.05 &&
      (!day || !previousDay || day === previousDay) &&
      recording === previousRecording &&
      segment === previousSegment &&
      recordedPathStaysAtStop &&
      recordedBurstStaysAtStop;
    if (canGroup) groups.at(-1)!.push(photoIndex);
    else groups.push([photoIndex]);
  });
  const stops = groups.map((photoIndices, checkpointIndex) => {
    const photoIndex = photoIndices[0];
    const photo = photos[photoIndex];
    const date = photo.metadata.capturedAt;
    const instant = instants?.[photoIndex] ?? date?.getTime();
    const key =
      options?.dayKeys?.[photoIndex] ??
      (instant === undefined
        ? undefined
        : new Date(instant).toISOString().slice(0, 10));
    let dayLabel: string | undefined;
    if (key && key !== lastDay) {
      day += 1;
      dayLabel = options?.dayLabels?.[photoIndex]
        ? `Day ${day} · ${options.dayLabels[photoIndex]}`
        : instant !== undefined
          ? `Day ${day} · ${new Date(instant).toLocaleDateString("en", { day: "numeric", month: "long", timeZone: "UTC" })}`
          : `Day ${day}`;
      lastDay = key;
    }
    const dayStart = offset;
    // The opening card already introduces day one. A second card before the first route makes
    // playback feel unresponsive; day cards are reserved for real day boundaries after it.
    if (dayLabel && photoIndex > 0) offset += DAY_DURATION;
    const own = positionOf(photoIndex);
    const burst = photoIndices.length > 1;
    const distance = own && lastPosition ? distanceKm(lastPosition, own) : 0;
    const recordedDistance = recordedLegDistances[photoIndex];
    const hasRecordedContract = options?.legEligibility !== undefined;
    const entry =
      Boolean(options?.legEligibility?.[photoIndex]) &&
      (photoIndex === 0 ||
        options?.recordingSegmentIds?.[photoIndex] !==
          options?.recordingSegmentIds?.[photoIndex - 1]);
    const distanceBased =
      recordedDistance !== undefined
        ? recordedApproachDuration(recordedDistance, entry)
        : hasRecordedContract
          ? 0
          : !own || distance < 0.001
            ? 0
            : Math.min(
                3000,
                Math.max(600, 600 + Math.log10(1 + distance) * 650),
              );
    const gapSeconds =
      instants?.[photoIndex] !== undefined &&
      instants?.[photoIndex - 1] !== undefined
        ? (instants[photoIndex]! - instants[photoIndex - 1]!) / 1000
        : undefined;
    const approachDuration =
      recordedDistance === undefined &&
      distanceBased > 0 &&
      gapSeconds !== undefined &&
      gapSeconds > 0
        ? Math.min(
            6000,
            Math.max(
              distanceBased,
              600 + Math.log10(1 + gapSeconds / 60) * 1500,
            ),
          )
        : distanceBased;
    if (own) lastPosition = own;
    const start = offset;
    const revealStart = start + approachDuration;
    const revealEnd = revealStart + REVEAL_DURATION;
    const departureStart =
      revealEnd +
      HOLD_DURATION +
      (photoIndices.length - 1) * BURST_HOLD_DURATION;
    const end = departureStart + DEPARTURE_DURATION;
    offset = end;
    return {
      id: photoIndices.map((index) => photos[index].id).join("\u0000"),
      checkpointIndex,
      photoIndex,
      photoIndices,
      start,
      duration: end - start,
      approachDuration,
      revealStart,
      revealEnd,
      departureStart,
      end,
      dayStart,
      dayLabel,
      dayChange: Boolean(photoIndex > 0 && dayLabel),
      legEligible: Boolean(options?.legEligibility?.[photoIndex]),
      burst,
    };
  });
  return {
    stops,
    totalDuration: photos.length ? offset + OUTRO_DURATION : 0,
    legEligibility: photos.map((_, index) =>
      Boolean(options?.legEligibility?.[index]),
    ),
    dayChanges: photos.map(
      (_, index) =>
        index > 0 &&
        Boolean(options?.dayKeys?.[index]) &&
        options?.dayKeys?.[index] !== options?.dayKeys?.[index - 1],
    ),
  };
}

function stateFor(
  elapsed: number,
  stop: TimelineStop | undefined,
  phase: JourneyPhase,
  phaseStart: number,
  phaseEnd: number,
  overrides: Partial<TimelineState> = {},
): TimelineState {
  const duration = Math.max(0, phaseEnd - phaseStart);
  const safe = Math.min(phaseEnd, Math.max(phaseStart, elapsed));
  const progress = duration
    ? clamp((safe - phaseStart) / duration)
    : phase === "complete"
      ? 1
      : 0;
  const arrived =
    phase === "reveal" ||
    phase === "hold" ||
    phase === "departure" ||
    phase === "outro" ||
    phase === "complete";
  const revealElapsed = Math.max(0, safe - (stop?.revealStart ?? safe));
  const substage = (from: number, to: number) =>
    clamp((revealElapsed - from) / (to - from));
  return {
    photoIndex: stop?.photoIndex ?? 0,
    phase,
    phaseProgress: progress,
    phaseStart,
    phaseEnd,
    phaseDuration: duration,
    phaseRemaining: Math.max(0, phaseEnd - safe),
    panelVisible:
      phase === "reveal" || phase === "hold" || phase === "departure",
    dayLabel: stop?.dayLabel,
    dayChange: stop?.dayChange ?? false,
    approachDuration: stop?.approachDuration ?? 0,
    currentLegProgress: phase === "approach" ? progress : arrived ? 1 : 0,
    currentLegEligible: stop?.legEligible ?? false,
    checkpointPhotoIndex: stop?.photoIndex ?? 0,
    checkpointIndex: stop?.checkpointIndex ?? 0,
    checkpointProgress: substage(REVEAL_DURATION * 0.1, REVEAL_DURATION * 0.4),
    drawerProgress: substage(0, REVEAL_DURATION * 0.65),
    imageProgress: substage(REVEAL_DURATION * 0.12, REVEAL_DURATION),
    ...overrides,
  };
}

export function timelineAt(
  elapsed: number,
  timeline: JourneyTimeline,
): TimelineState {
  if (!timeline.stops.length) return stateFor(0, undefined, "overview", 0, 0);
  const safe = Math.max(0, elapsed);
  if (safe < INTRO_DURATION)
    return stateFor(safe, timeline.stops[0], "intro", 0, INTRO_DURATION, {
      dayLabel: undefined,
      dayChange: false,
    });
  let low = 0;
  let high = timeline.stops.length - 1;
  let stop: TimelineStop | undefined;
  while (low <= high) {
    const middle = (low + high) >> 1;
    const candidate = timeline.stops[middle];
    if (safe < candidate.end) {
      stop = candidate;
      high = middle - 1;
    } else {
      low = middle + 1;
    }
  }
  if (!stop) {
    const last = timeline.stops.at(-1)!;
    if (safe >= timeline.totalDuration)
      return stateFor(
        timeline.totalDuration,
        last,
        "complete",
        timeline.totalDuration,
        timeline.totalDuration,
        { panelVisible: false },
      );
    return stateFor(safe, last, "outro", last.end, timeline.totalDuration, {
      panelVisible: false,
    });
  }
  if (safe < stop.start)
    return stateFor(safe, stop, "day", stop.dayStart, stop.start, {
      currentLegProgress: 0,
    });
  if (safe < stop.revealStart)
    return stateFor(safe, stop, "approach", stop.start, stop.revealStart);
  if (safe < stop.revealEnd)
    return stateFor(safe, stop, "reveal", stop.revealStart, stop.revealEnd);
  if (safe < stop.departureStart) {
    const holdElapsed = safe - stop.revealEnd;
    const offset = Math.min(
      stop.photoIndices.length - 1,
      Math.max(0, Math.floor(holdElapsed / BURST_HOLD_DURATION)),
    );
    return stateFor(safe, stop, "hold", stop.revealEnd, stop.departureStart, {
      photoIndex: stop.photoIndices[offset],
      checkpointProgress: 1,
      drawerProgress: 1,
      imageProgress: 1,
    });
  }
  return stateFor(safe, stop, "departure", stop.departureStart, stop.end, {
    photoIndex: stop.photoIndices.at(-1) ?? stop.photoIndex,
  });
}

export function photoHoldTime(stop: TimelineStop, photoIndex: number) {
  const offset = Math.max(0, stop.photoIndices.indexOf(photoIndex));
  // Direct selection lands after the dissolve so a paused selection shows the chosen photo.
  return Math.min(
    stop.departureStart - 1,
    stop.revealEnd +
      offset * BURST_HOLD_DURATION +
      (offset > 0 ? BURST_TRANSITION_DURATION : 0),
  );
}

export type JourneyStop = {
  photoId: string;
  coordinates?: Coordinates;
  located: boolean;
};
export type CameraMove = { center: Coordinates; from?: Coordinates };

function samePlace(a: Coordinates, b: Coordinates) {
  return (
    Math.abs(a.latitude - b.latitude) < 1e-6 &&
    Math.abs(a.longitude - b.longitude) < 1e-6
  );
}

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

export function locatedPoints(stops: readonly JourneyStop[]): Coordinates[] {
  return stops.flatMap((stop) =>
    stop.located && stop.coordinates ? [stop.coordinates] : [],
  );
}

/** Dashed photo-only connections stop at unknown locations and selected-trip day boundaries. */
export function inferredRouteSegments(
  stops: readonly JourneyStop[],
  dayChanges?: readonly boolean[],
) {
  const segments: Coordinates[][] = [];
  let current: Coordinates[] = [];
  const close = () => {
    if (current.length > 1) segments.push(current);
    current = [];
  };
  stops.forEach((stop, index) => {
    if (dayChanges?.[index]) close();
    if (!stop.located || !stop.coordinates) {
      close();
      return;
    }
    current.push(stop.coordinates);
  });
  close();
  return segments;
}
