import type { SessionPosition } from "./sessionState";
import type { Stretch } from "./types";

export type RailSegmentState = "done" | "current" | "upcoming";

export interface RailSegment {
  /** Index into the stretch list, so a click can jump straight to it. */
  index: number;
  name: string;
  /** Seconds across every repetition. This is what sets the segment width. */
  weight: number;
  duration: number;
  repetitions: number;
  state: RailSegmentState;
  /** 0 to 1 through this segment. Only meaningful while state is "current". */
  fill: number;
}

export interface RailState {
  index: number;
  repetition: number;
  timeRemaining: number;
  isResting: boolean;
  isCompleted: boolean;
  nextPosition?: SessionPosition | null;
}

function repetitionsFor(stretch: Stretch): number {
  return Math.max(1, stretch.repetitions || 1);
}

function durationFor(stretch: Stretch): number {
  return Math.max(0, stretch.duration || 0);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * Fraction of one stretch that is already behind you, counting whole finished
 * repetitions plus the elapsed part of the repetition you are holding.
 */
function fillWithin(
  stretch: Stretch,
  repetition: number,
  timeRemaining: number,
): number {
  const duration = durationFor(stretch);
  const total = duration * repetitionsFor(stretch);
  if (total === 0) return 0;

  const finished = duration * Math.max(0, repetition - 1);
  const elapsedInRepetition = Math.max(
    0,
    duration - Math.max(0, timeRemaining),
  );
  return clamp01((finished + elapsedInRepetition) / total);
}

/**
 * Turns a routine into the segments the duration rail draws. Segment width is
 * proportional to time, so a routine's shape is readable before it starts, and
 * the same list drives progress, the current marker and jump targets.
 *
 * While resting, the rail points at the stretch you are about to start rather
 * than the one you just finished, which matches what the screen is showing.
 */
export function buildRailSegments(
  stretches: readonly Stretch[],
  state: RailState,
): RailSegment[] {
  const focus =
    state.isResting && state.nextPosition
      ? state.nextPosition
      : { index: state.index, repetition: state.repetition };

  return stretches.map((stretch, index) => {
    const base = {
      index,
      name: stretch.name,
      weight: durationFor(stretch) * repetitionsFor(stretch),
      duration: durationFor(stretch),
      repetitions: repetitionsFor(stretch),
    };

    if (state.isCompleted) {
      return { ...base, state: "done" as const, fill: 1 };
    }

    if (index < focus.index)
      return { ...base, state: "done" as const, fill: 1 };
    if (index > focus.index) {
      return { ...base, state: "upcoming" as const, fill: 0 };
    }

    return {
      ...base,
      state: "current" as const,
      // A rest period sits between repetitions, so nothing new has elapsed yet.
      fill: state.isResting
        ? fillWithin(stretch, focus.repetition, durationFor(stretch))
        : fillWithin(stretch, focus.repetition, state.timeRemaining),
    };
  });
}

/**
 * Label for a repetition of a stretch that is done on both sides. Routines use
 * 2 repetitions to mean left then right, which "Rep 2 / 2" never made clear.
 */
export function describeRepetition(
  repetition: number,
  repetitions: number,
): string | null {
  const total = Math.max(1, repetitions);
  if (total < 2) return null;
  if (total === 2) {
    return repetition === 1 ? "Left side, 1 of 2" : "Right side, 2 of 2";
  }
  return `Round ${Math.min(repetition, total)} of ${total}`;
}
