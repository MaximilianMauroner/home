import type { Placement } from "./track";
import type { Coordinates, JourneyPhoto } from "./types";

export const INTRO_DURATION = 2500;
export const DAY_DURATION = 1500;
export const OUTRO_DURATION = 3000;
export const REVEAL_DURATION = 500;
export const HOLD_DURATION = 3300;
export const DEPARTURE_DURATION = 700;
export const BURST_REVEAL_DURATION = 350;
export const BURST_HOLD_DURATION = 1250;
export const BURST_DEPARTURE_DURATION = 400;

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
};
export type TimelineStop = {
  photoIndex: number;
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
export type JourneyTimeline = { stops: TimelineStop[]; totalDuration: number };

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
    if (!previous) return false;
    const hasRecordedSample = (entry: Placement) =>
      entry.source === "track" ? Boolean(entry.coordinates) : Boolean(entry.trackCoordinates);
    if (!hasRecordedSample(placement) || !hasRecordedSample(previous)) return false;
    if (!placement.recordingId || placement.recordingId !== previous.recordingId) return false;
    if (placement.ambiguous || previous.ambiguous || placement.choiceUnavailable || previous.choiceUnavailable) return false;
    if (placement.instant === undefined || previous.instant === undefined || placement.instant <= previous.instant) return false;
    const day = dayKeys?.[index];
    const previousDay = dayKeys?.[index - 1];
    return !day || !previousDay || day === previousDay;
  });
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
  },
): JourneyTimeline {
  const positionOf = (index: number) => positions ? positions[index] : photos[index]?.metadata.coordinates;
  let offset = photos.length ? INTRO_DURATION : 0;
  let day = 0;
  let lastDay: string | undefined;
  let lastPosition: Coordinates | undefined;
  const stops = photos.map((photo, photoIndex) => {
    const date = photo.metadata.capturedAt;
    const instant = instants?.[photoIndex] ?? date?.getTime();
    const key = options?.dayKeys?.[photoIndex] ?? (instant === undefined ? undefined : new Date(instant).toISOString().slice(0, 10));
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
    if (dayLabel) offset += DAY_DURATION;
    const own = positionOf(photoIndex);
    const previous = photos[photoIndex - 1];
    const previousPosition = positionOf(photoIndex - 1);
    const previousDate = previous?.metadata.capturedAt;
    const previousInstant = instants?.[photoIndex - 1] ?? previousDate?.getTime();
    const burst = Boolean(
      own && previousPosition && instant !== undefined && previousInstant !== undefined &&
      Math.floor(instant / 60000) === Math.floor(previousInstant / 60000) &&
      distanceKm(own, previousPosition) < 0.05,
    );
    const distance = own && lastPosition ? distanceKm(lastPosition, own) : 0;
    const distanceBased = !own || burst || distance < 0.001
      ? 0
      : Math.min(3000, Math.max(600, 600 + Math.log10(1 + distance) * 650));
    const gapSeconds = instants?.[photoIndex] !== undefined && instants?.[photoIndex - 1] !== undefined
      ? (instants[photoIndex]! - instants[photoIndex - 1]!) / 1000
      : undefined;
    const approachDuration = distanceBased > 0 && gapSeconds !== undefined && gapSeconds > 0
      ? Math.min(6000, Math.max(distanceBased, 600 + Math.log10(1 + gapSeconds / 60) * 1500))
      : distanceBased;
    if (own) lastPosition = own;
    const start = offset;
    const revealStart = start + approachDuration;
    const revealEnd = revealStart + (burst ? BURST_REVEAL_DURATION : REVEAL_DURATION);
    const departureStart = revealEnd + (burst ? BURST_HOLD_DURATION : HOLD_DURATION);
    const end = departureStart + (burst ? BURST_DEPARTURE_DURATION : DEPARTURE_DURATION);
    offset = end;
    return {
      photoIndex, start, duration: end - start, approachDuration, revealStart, revealEnd,
      departureStart, end, dayStart, dayLabel, dayChange: Boolean(photoIndex > 0 && dayLabel),
      legEligible: Boolean(options?.legEligibility?.[photoIndex]), burst,
    };
  });
  return { stops, totalDuration: photos.length ? offset + OUTRO_DURATION : 0 };
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
  const progress = duration ? clamp((safe - phaseStart) / duration) : phase === "complete" ? 1 : 0;
  const arrived = phase === "reveal" || phase === "hold" || phase === "departure" || phase === "outro" || phase === "complete";
  return {
    photoIndex: stop?.photoIndex ?? 0,
    phase, phaseProgress: progress, phaseStart, phaseEnd, phaseDuration: duration,
    phaseRemaining: Math.max(0, phaseEnd - safe),
    panelVisible: phase === "reveal" || phase === "hold" || phase === "departure",
    dayLabel: stop?.dayLabel, dayChange: stop?.dayChange ?? false,
    approachDuration: stop?.approachDuration ?? 0,
    currentLegProgress: phase === "approach" ? progress : arrived ? 1 : 0,
    currentLegEligible: stop?.legEligible ?? false,
    ...overrides,
  };
}

export function timelineAt(elapsed: number, timeline: JourneyTimeline): TimelineState {
  if (!timeline.stops.length) return stateFor(0, undefined, "overview", 0, 0);
  const safe = Math.max(0, elapsed);
  if (safe < INTRO_DURATION)
    return stateFor(safe, timeline.stops[0], "intro", 0, INTRO_DURATION, { dayLabel: undefined, dayChange: false });
  const stop = timeline.stops.find((entry) => safe < entry.end);
  if (!stop) {
    const last = timeline.stops.at(-1)!;
    if (safe >= timeline.totalDuration)
      return stateFor(timeline.totalDuration, last, "complete", timeline.totalDuration, timeline.totalDuration, { panelVisible: false });
    return stateFor(safe, last, "outro", last.end, timeline.totalDuration, { panelVisible: false });
  }
  if (safe < stop.start)
    return stateFor(safe, stop, "day", stop.dayStart, stop.start, { currentLegProgress: 0 });
  if (safe < stop.revealStart)
    return stateFor(safe, stop, "approach", stop.start, stop.revealStart);
  if (safe < stop.revealEnd)
    return stateFor(safe, stop, "reveal", stop.revealStart, stop.revealEnd);
  if (safe < stop.departureStart)
    return stateFor(safe, stop, "hold", stop.revealEnd, stop.departureStart);
  return stateFor(safe, stop, "departure", stop.departureStart, stop.end);
}

export type JourneyStop = {
  photoId: string;
  coordinates?: Coordinates;
  located: boolean;
};
export type CameraMove = { center: Coordinates; from?: Coordinates };

function samePlace(a: Coordinates, b: Coordinates) {
  return Math.abs(a.latitude - b.latitude) < 1e-6 && Math.abs(a.longitude - b.longitude) < 1e-6;
}

export function cameraFor(stops: JourneyStop[], photoIndex: number): CameraMove | undefined {
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
      const adjusted = point.longitude + (point.longitude < previous.longitude ? 360 : -360);
      const edge = adjusted > previous.longitude ? 180 : -180;
      const fraction = (edge - previous.longitude) / (adjusted - previous.longitude);
      const latitude = previous.latitude + fraction * (point.latitude - previous.latitude);
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
  return stops.flatMap((stop) => (stop.located && stop.coordinates ? [stop.coordinates] : []));
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
