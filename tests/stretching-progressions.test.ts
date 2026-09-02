import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DEFAULT_ROUTINES } from "@/components/tools/Stretching/constants";
import { StretchDetails } from "@/components/tools/Stretching/components/StretchDetails";
import { parseStoredStretches } from "@/components/tools/Stretching/persistence";
import { cloneStretch } from "@/components/tools/Stretching/studioHelpers";
import type { Stretch } from "@/components/tools/Stretching/types";

const TIER_ORDER = ["easier", "standard", "harder", "hardest"] as const;

const fiveStretchMinimum = DEFAULT_ROUTINES.find(
  (routine) => routine.id === "routine_10",
);

describe("five stretch minimum routine", () => {
  it("ships the five stretches with a total duration matching its steps", () => {
    expect(fiveStretchMinimum).toBeDefined();
    expect(fiveStretchMinimum?.stretches.map((stretch) => stretch.name)).toEqual(
      [
        "Pancake Stretch",
        "Figure Four Stretch",
        "Half-Kneeling Hip Flexor Reach",
        "Jack Stretch",
        "Counter Lat Stretch",
      ],
    );

    const totalDuration = fiveStretchMinimum?.stretches.reduce(
      (total, stretch) => total + stretch.duration * stretch.repetitions,
      0,
    );
    expect(totalDuration).toBe(fiveStretchMinimum?.totalDuration);
  });

  it("gives every stretch a difficulty ladder ordered easiest first", () => {
    for (const stretch of fiveStretchMinimum?.stretches ?? []) {
      const tiers = stretch.progressions?.map(
        (progression) => progression.tier,
      );
      expect(tiers?.length).toBeGreaterThan(1);

      const ranks = tiers?.map((tier) => TIER_ORDER.indexOf(tier)) ?? [];
      expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
      expect(new Set(ranks).size).toBe(ranks.length);
    }
  });
});

describe("progression handling", () => {
  const stretch: Stretch = {
    id: "1",
    name: "Pancake",
    description: "Description",
    duration: 30,
    repetitions: 1,
    how: "How",
    lookFor: "Feel",
    progressions: [
      { tier: "easier", name: "Elevated pelvis", detail: "Sit on a cushion." },
      { tier: "standard", name: "On the floor", detail: "Sit on the floor." },
    ],
  };

  it("clones progressions instead of sharing them with the source stretch", () => {
    const copy = cloneStretch(stretch);

    expect(copy.progressions).toEqual(stretch.progressions);
    expect(copy.progressions).not.toBe(stretch.progressions);
    expect(copy.progressions?.[0]).not.toBe(stretch.progressions?.[0]);
  });

  it("accepts stored stretches with progressions and rejects unknown tiers", () => {
    expect(parseStoredStretches(JSON.stringify([stretch]))).toEqual([stretch]);

    const unknownTier = {
      ...stretch,
      progressions: [{ tier: "impossible", name: "Nope", detail: "Nope." }],
    };
    expect(parseStoredStretches(JSON.stringify([unknownTier]))).toBeNull();
  });
});

describe("StretchDetails guidance", () => {
  const [pancake] = fiveStretchMinimum?.stretches ?? [];

  it("lists every progression with its tier label", () => {
    const markup = renderToStaticMarkup(
      createElement(StretchDetails, { stretch: pancake, section: "guidance" }),
    );

    expect(markup).toContain("Pick your level");
    for (const progression of pancake?.progressions ?? []) {
      expect(markup).toContain(progression.name);
      expect(markup).toContain(progression.detail);
    }
    expect(markup).toContain("Easier");
    expect(markup).toContain("Hardest");
  });

  it("omits the level list for a stretch without progressions", () => {
    const markup = renderToStaticMarkup(
      createElement(StretchDetails, {
        stretch: { ...pancake, progressions: undefined },
        section: "guidance",
      }),
    );

    expect(markup).not.toContain("Pick your level");
  });
});
