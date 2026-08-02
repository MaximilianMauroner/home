import { describe, expect, it } from "vitest";
import {
  buildImageCatalog,
  filterImageCatalog,
  getDraftSelection,
  isValidStretchImageSource,
} from "@/components/tools/Stretching/imageCatalog";
import { getResponsiveStretchImageSources } from "@/components/tools/Stretching/images";

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

  it("describes local artwork with its native aspect ratio", () => {
    expect(
      getResponsiveStretchImageSources("/stretches/cat-pose.png"),
    ).toMatchObject({ width: 1349, height: 1536 });
  });

  it("accepts catalog paths and complete web URLs without accepting arbitrary text", () => {
    expect(isValidStretchImageSource("/stretches/cat-pose.png")).toBe(true);
    expect(isValidStretchImageSource("https://example.com/stretch.png")).toBe(
      true,
    );
    expect(isValidStretchImageSource("http://example.com/stretch.png")).toBe(
      true,
    );
    expect(isValidStretchImageSource("")).toBe(true);
    expect(isValidStretchImageSource("cat-pose.png")).toBe(false);
    expect(isValidStretchImageSource("javascript:alert(1)")).toBe(false);
  });
});
