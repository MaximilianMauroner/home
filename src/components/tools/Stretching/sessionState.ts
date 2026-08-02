import type { Stretch } from "./types";

export interface SessionPosition {
  index: number;
  repetition: number;
}

export interface SessionTimingState extends SessionPosition {
  isCompleted: boolean;
  isResting: boolean;
  nextPosition?: SessionPosition | null;
  timeRemaining: number;
}

export function shouldAdvanceSession(
  isActiveView: boolean,
  isRunning: boolean,
  isPaused: boolean,
): boolean {
  return isActiveView && isRunning && !isPaused;
}

function repetitionsFor(stretch: Stretch | undefined): number {
  return Math.max(1, stretch?.repetitions ?? 1);
}

function durationFor(stretch: Stretch | undefined): number {
  return Math.max(0, stretch?.duration ?? 0);
}

export function getNextSessionPosition(
  stretches: readonly Stretch[],
  position: SessionPosition,
): SessionPosition | null {
  const current = stretches[position.index];
  if (!current) return null;

  if (position.repetition < repetitionsFor(current)) {
    return { index: position.index, repetition: position.repetition + 1 };
  }

  return position.index < stretches.length - 1
    ? { index: position.index + 1, repetition: 1 }
    : null;
}

export function getPreviousSessionPosition(
  stretches: readonly Stretch[],
  position: SessionPosition,
): SessionPosition | null {
  if (!stretches[position.index]) return null;

  if (position.repetition > 1) {
    return { index: position.index, repetition: position.repetition - 1 };
  }

  if (position.index === 0) return null;

  return {
    index: position.index - 1,
    repetition: repetitionsFor(stretches[position.index - 1]),
  };
}

export function calculateRoutineDuration(
  stretches: readonly Stretch[],
): number {
  return stretches.reduce(
    (total, stretch) => total + durationFor(stretch) * repetitionsFor(stretch),
    0,
  );
}

function durationBeforePosition(
  stretches: readonly Stretch[],
  position: SessionPosition,
): number {
  let elapsed = 0;

  for (let index = 0; index < position.index; index += 1) {
    const stretch = stretches[index];
    elapsed += durationFor(stretch) * repetitionsFor(stretch);
  }

  elapsed +=
    durationFor(stretches[position.index]) *
    Math.max(0, position.repetition - 1);
  return elapsed;
}

export function calculateSessionProgress(
  stretches: readonly Stretch[],
  state: SessionTimingState,
): number {
  const total = calculateRoutineDuration(stretches);
  if (total === 0) return 0;
  if (state.isCompleted) return 100;

  if (state.isResting) {
    const nextPosition = state.nextPosition;
    if (!nextPosition) return 100;
    return Math.min(
      100,
      Math.max(
        0,
        (durationBeforePosition(stretches, nextPosition) / total) * 100,
      ),
    );
  }

  const currentDuration = durationFor(stretches[state.index]);
  const elapsed =
    durationBeforePosition(stretches, state) +
    Math.max(0, currentDuration - state.timeRemaining);
  return Math.min(100, Math.max(0, (elapsed / total) * 100));
}

function durationFromPosition(
  stretches: readonly Stretch[],
  position: SessionPosition,
): number {
  const current = stretches[position.index];
  if (!current) return 0;

  let remaining =
    durationFor(current) * (repetitionsFor(current) - position.repetition + 1);
  for (let index = position.index + 1; index < stretches.length; index += 1) {
    const stretch = stretches[index];
    remaining += durationFor(stretch) * repetitionsFor(stretch);
  }
  return remaining;
}

function transitionsFromPosition(
  stretches: readonly Stretch[],
  position: SessionPosition,
): number {
  let steps = repetitionsFor(stretches[position.index]) - position.repetition;
  for (let index = position.index + 1; index < stretches.length; index += 1) {
    steps += repetitionsFor(stretches[index]);
  }
  return Math.max(0, steps);
}

export function calculateSessionTimeRemaining(
  stretches: readonly Stretch[],
  state: SessionTimingState,
  restDuration: number,
): number {
  if (state.isCompleted || stretches.length === 0) return 0;
  const safeRestDuration = Math.max(0, restDuration);

  if (state.isResting) {
    const nextPosition = state.nextPosition;
    if (!nextPosition) return Math.max(0, state.timeRemaining);
    return (
      Math.max(0, state.timeRemaining) +
      durationFromPosition(stretches, nextPosition) +
      transitionsFromPosition(stretches, nextPosition) * safeRestDuration
    );
  }

  const current = stretches[state.index];
  if (!current) return 0;
  const afterCurrent = getNextSessionPosition(stretches, state);
  return (
    Math.max(0, state.timeRemaining) +
    (afterCurrent ? durationFromPosition(stretches, afterCurrent) : 0) +
    transitionsFromPosition(stretches, state) * safeRestDuration
  );
}

export function calculateStepsRemaining(
  stretches: readonly Stretch[],
  state: Pick<
    SessionTimingState,
    "index" | "repetition" | "isCompleted" | "isResting" | "nextPosition"
  >,
): number {
  if (state.isCompleted) return 0;
  if (state.isResting) {
    return state.nextPosition
      ? transitionsFromPosition(stretches, state.nextPosition) + 1
      : 0;
  }
  return transitionsFromPosition(stretches, state);
}
