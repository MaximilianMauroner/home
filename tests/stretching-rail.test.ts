import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import {
  buildRailSegments,
  describeRepetition,
} from "@/components/tools/Stretching/rail";
import type { Stretch } from "@/components/tools/Stretching/types";
import { DurationRail } from "@/components/tools/Stretching/components/DurationRail";

function stretch(id: string, duration: number, repetitions = 1): Stretch {
  return {
    id,
    name: `Stretch ${id}`,
    description: "Description",
    duration,
    repetitions,
    how: "How",
    lookFor: "Feel",
  };
}

const routine = [
  stretch("1", 30, 2), // 60s
  stretch("2", 45), // 45s
  stretch("3", 60), // 60s
];

const idle = {
  index: 0,
  repetition: 1,
  timeRemaining: 30,
  isResting: false,
  isCompleted: false,
};

describe("buildRailSegments", () => {
  test("weights each segment by duration across every repetition", () => {
    expect(buildRailSegments(routine, idle).map((seg) => seg.weight)).toEqual([
      60, 45, 60,
    ]);
  });

  test("marks earlier stretches done and later stretches upcoming", () => {
    const segments = buildRailSegments(routine, { ...idle, index: 1 });
    expect(segments.map((seg) => seg.state)).toEqual([
      "done",
      "current",
      "upcoming",
    ]);
    expect(segments[0]?.fill).toBe(1);
    expect(segments[2]?.fill).toBe(0);
  });

  test("counts finished repetitions plus elapsed time in the current fill", () => {
    // Second repetition of a 30s x2 stretch, 15s left: 30 + 15 of 60.
    const [first] = buildRailSegments(routine, {
      ...idle,
      repetition: 2,
      timeRemaining: 15,
    });
    expect(first?.fill).toBeCloseTo(0.75);
  });

  test("points at the upcoming stretch while resting", () => {
    const segments = buildRailSegments(routine, {
      ...idle,
      index: 0,
      repetition: 2,
      isResting: true,
      timeRemaining: 7,
      nextPosition: { index: 1, repetition: 1 },
    });
    expect(segments.map((seg) => seg.state)).toEqual([
      "done",
      "current",
      "upcoming",
    ]);
    // Rest sits before the next hold starts, so nothing has elapsed yet.
    expect(segments[1]?.fill).toBe(0);
  });

  test("fills every segment once the routine is complete", () => {
    const segments = buildRailSegments(routine, {
      ...idle,
      isCompleted: true,
    });
    expect(
      segments.every((seg) => seg.state === "done" && seg.fill === 1),
    ).toBe(true);
  });

  test("keeps zero duration stretches from producing a broken fill", () => {
    const [only] = buildRailSegments([stretch("1", 0)], idle);
    expect(only?.weight).toBe(0);
    expect(only?.fill).toBe(0);
  });
});

describe("describeRepetition", () => {
  test("says nothing for a single hold", () => {
    expect(describeRepetition(1, 1)).toBeNull();
  });

  test("names the sides for a two repetition stretch", () => {
    expect(describeRepetition(1, 2)).toBe("Left side, 1 of 2");
    expect(describeRepetition(2, 2)).toBe("Right side, 2 of 2");
  });

  test("counts rounds beyond two repetitions", () => {
    expect(describeRepetition(2, 3)).toBe("Round 2 of 3");
  });
});

describe("DurationRail interactions", () => {
  test("renders selectable preview targets with the selected segment marked", () => {
    const markup = renderToStaticMarkup(
      createElement(DurationRail, {
        actionLabel: "Preview",
        onJumpTo: () => undefined,
        selectedIndex: 1,
        segments: buildRailSegments(routine, idle),
        size: "preview",
      }),
    );

    expect(markup).toContain('aria-label="Preview 2. Stretch 2, 0:45"');
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain("stretching-rail-seg--selected");
  });
});
