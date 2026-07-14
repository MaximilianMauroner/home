import { describe, expect, test } from "vitest";

import {
  clampLetterCardPosition,
  getLetterCardWidth,
} from "../src/components/home/letterCardPosition";

describe("homepage letter card positioning", () => {
  test("fits inside a 320px viewport", () => {
    const cardWidth = getLetterCardWidth(320);
    const position = clampLetterCardPosition({
      cardHeight: 260,
      cardWidth,
      left: 250,
      top: 80,
      viewportHeight: 568,
      viewportWidth: 320,
    });

    expect(cardWidth).toBe(288);
    expect(position.x).toBe(16);
    expect(position.x + cardWidth).toBe(304);
  });

  test("keeps dragged cards fully inside a desktop viewport", () => {
    expect(
      clampLetterCardPosition({
        cardHeight: 300,
        cardWidth: 384,
        left: -200,
        top: 900,
        viewportHeight: 800,
        viewportWidth: 1200,
      }),
    ).toEqual({ x: 16, y: 484 });
  });
});
