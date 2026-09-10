import { describe, expect, test } from "vitest";
import { validateStyleMin } from "@maplibre/maplibre-gl-style-spec";

import { baseStyle, TERRAIN_DEM_TILES } from "../src/components/tools/PhotoJourney/JourneyMap";

describe("Photo Journey map style", () => {
  test("the bundled style validates against the MapLibre spec", () => {
    const errors = validateStyleMin(baseStyle());
    expect(errors).toEqual([]);
  });

  test("terrain reads free Terrarium tiles with no key", () => {
    const style = baseStyle();
    const dem = style.sources.dem;
    expect(dem?.type).toBe("raster-dem");
    if (dem?.type === "raster-dem") {
      expect(dem.encoding).toBe("terrarium");
      expect(dem.tiles).toEqual(TERRAIN_DEM_TILES);
      for (const tile of dem.tiles ?? []) {
        expect(tile).not.toMatch(/key|token|api_key/i);
      }
    }
    const hillshade = style.layers.find((layer) => layer.id === "hillshade");
    expect(hillshade?.type).toBe("hillshade");
  });

  test("the offline outline needs no network source", () => {
    const style = baseStyle();
    for (const source of Object.values(style.sources)) {
      if (source.type === "geojson") {
        expect(typeof source.data === "object" ? source.data : null).toBeTruthy();
      }
    }
    expect(style.layers.some((layer) => layer.id === "osm")).toBe(true);
  });
});
