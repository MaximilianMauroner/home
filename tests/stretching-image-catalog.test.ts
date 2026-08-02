import { describe, expect, it } from "vitest";
import {
  buildImageCatalog,
  filterImageCatalog,
  getDraftSelection,
} from "@/components/tools/Stretching/imageCatalog";

describe("image catalog", () => {
  const catalog = buildImageCatalog({
    "morning-flow": {
      "chest-opener": "/shared.png",
      "side-reach": "/side.png",
    },
    recovery: { "different-label": "/shared.png" },
  });

  it("deduplicates URLs while retaining every routine", () => {
    expect(catalog).toHaveLength(2);
    expect(catalog[0]).toEqual({
      name: "Chest Opener",
      routines: ["Morning Flow", "Recovery"],
      url: "/shared.png",
    });
  });

  it("searches names and routines and filters by routine", () => {
    expect(filterImageCatalog(catalog, "recovery", "")).toHaveLength(1);
    expect(filterImageCatalog(catalog, "reach", "Morning Flow")).toEqual([
      { name: "Side Reach", routines: ["Morning Flow"], url: "/side.png" },
    ]);
    expect(filterImageCatalog(catalog, "reach", "Recovery")).toEqual([]);
  });

  it("keeps a selection as a draft until explicitly confirmed", () => {
    expect(getDraftSelection("/current.png", null)).toBe("/current.png");
    expect(getDraftSelection("/current.png", "/draft.png")).toBe("/draft.png");
  });
});
