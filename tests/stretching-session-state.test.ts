import { describe, expect, test } from "vitest";

import {
  calculateRoutineDuration,
  calculateSessionProgress,
  calculateSessionTimeRemaining,
  calculateStepsRemaining,
  getNextSessionPosition,
  getPreviousSessionPosition,
} from "../src/components/tools/Stretching/sessionState";
import type { Stretch } from "../src/components/tools/Stretching/types";

const stretches: Stretch[] = [
  {
    id: "one",
    name: "One",
    description: "First",
    duration: 10,
    repetitions: 2,
    how: "Hold",
    lookFor: "Ease",
  },
  {
    id: "two",
    name: "Two",
    description: "Second",
    duration: 20,
    repetitions: 1,
    how: "Hold",
    lookFor: "Ease",
  },
];

describe("stretching session positions", () => {
  test("moves through repetitions and stretches, then completes", () => {
    expect(
      getNextSessionPosition(stretches, { index: 0, repetition: 1 }),
    ).toEqual({
      index: 0,
      repetition: 2,
    });
    expect(
      getNextSessionPosition(stretches, { index: 0, repetition: 2 }),
    ).toEqual({
      index: 1,
      repetition: 1,
    });
    expect(
      getNextSessionPosition(stretches, { index: 1, repetition: 1 }),
    ).toBeNull();
    expect(
      getNextSessionPosition(stretches, { index: 8, repetition: 1 }),
    ).toBeNull();
  });

  test("moves backward across repetition boundaries", () => {
    expect(
      getPreviousSessionPosition(stretches, { index: 1, repetition: 1 }),
    ).toEqual({
      index: 0,
      repetition: 2,
    });
    expect(
      getPreviousSessionPosition(stretches, { index: 0, repetition: 2 }),
    ).toEqual({
      index: 0,
      repetition: 1,
    });
    expect(
      getPreviousSessionPosition(stretches, { index: 0, repetition: 1 }),
    ).toBeNull();
  });
});

describe("stretching session timing", () => {
  test("calculates routine duration and clamps progress boundaries", () => {
    expect(calculateRoutineDuration(stretches)).toBe(40);
    expect(
      calculateSessionProgress(stretches, {
        index: 0,
        repetition: 1,
        timeRemaining: 12,
        isResting: false,
        isCompleted: false,
      }),
    ).toBe(0);
    expect(
      calculateSessionProgress(stretches, {
        index: 0,
        repetition: 2,
        timeRemaining: 5,
        isResting: false,
        isCompleted: false,
      }),
    ).toBe(37.5);
    expect(
      calculateSessionProgress(stretches, {
        index: 1,
        repetition: 1,
        timeRemaining: 0,
        isResting: false,
        isCompleted: true,
      }),
    ).toBe(100);
    expect(
      calculateSessionProgress([], {
        index: 0,
        repetition: 1,
        timeRemaining: 0,
        isResting: false,
        isCompleted: true,
      }),
    ).toBe(0);
  });

  test("holds progress at the completed step during rest", () => {
    expect(
      calculateSessionProgress(stretches, {
        index: 0,
        repetition: 1,
        timeRemaining: 3,
        isResting: true,
        isCompleted: false,
        nextPosition: { index: 0, repetition: 2 },
      }),
    ).toBe(25);
  });

  test("includes future exercise and rest time from active and rest phases", () => {
    expect(
      calculateSessionTimeRemaining(
        stretches,
        {
          index: 0,
          repetition: 1,
          timeRemaining: 6,
          isResting: false,
          isCompleted: false,
        },
        5,
      ),
    ).toBe(46);
    expect(
      calculateSessionTimeRemaining(
        stretches,
        {
          index: 0,
          repetition: 1,
          timeRemaining: 3,
          isResting: true,
          isCompleted: false,
          nextPosition: { index: 0, repetition: 2 },
        },
        5,
      ),
    ).toBe(38);
    expect(
      calculateSessionTimeRemaining(
        stretches,
        {
          index: 1,
          repetition: 1,
          timeRemaining: 0,
          isResting: false,
          isCompleted: true,
        },
        5,
      ),
    ).toBe(0);
  });

  test("reports future steps across active, rest, and completed states", () => {
    expect(
      calculateStepsRemaining(stretches, {
        index: 0,
        repetition: 1,
        isResting: false,
        isCompleted: false,
      }),
    ).toBe(2);
    expect(
      calculateStepsRemaining(stretches, {
        index: 0,
        repetition: 1,
        isResting: true,
        isCompleted: false,
        nextPosition: { index: 0, repetition: 2 },
      }),
    ).toBe(2);
    expect(
      calculateStepsRemaining(stretches, {
        index: 1,
        repetition: 1,
        isResting: false,
        isCompleted: true,
      }),
    ).toBe(0);
  });
});
