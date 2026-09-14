import { describe, expect, test } from "vitest";
import type { Map as MapLibreMap } from "maplibre-gl";
import {
  fetchVideoMapTile,
  projectVideoPoint,
  terrainCameraPhotoIndex,
  videoBounds,
  VIDEO_HEIGHT,
  VIDEO_OUTPUT_RESOLUTIONS,
  VIDEO_WIDTH,
  videoResolutionAttempts,
  videoMapTileUrl,
} from "../src/components/tools/PhotoJourney/video-export";
import type { Track } from "../src/components/tools/PhotoJourney/gpx";
import {
  VideoTerrainRenderer,
  videoMarkerLongitude,
  videoTerrainJumpOptions,
  videoRouteData,
  waitForReadyVideoMapIdle,
  waitForVideoMapPaint,
} from "../src/components/tools/PhotoJourney/video-terrain-renderer";

describe("Photo Journey MP4 layout", () => {
  test("keeps burst photos on their checkpoint camera", () => {
    expect(
      terrainCameraPhotoIndex({
        checkpointPhotoIndex: 7,
      }),
    ).toBe(7);
  });

  test("projects markers in the camera's antimeridian world copy", () => {
    expect(videoMarkerLongitude(-179, 181)).toBe(181);
    expect(videoMarkerLongitude(179, -181)).toBe(-181);
  });

  test("applies photo-panel padding to the terrain camera", () => {
    expect(
      videoTerrainJumpOptions({ center: [11, 46], zoom: 15 }, 45, 20, {
        top: 0,
        right: 0,
        bottom: 0,
        left: 640,
      }),
    ).toMatchObject({ padding: { left: 640 } });
    expect(
      videoTerrainJumpOptions({ center: [11, 46], zoom: 15 }, 45, 20),
    ).toMatchObject({
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
    });
  });

  test("waits for a paint after map sources become ready", async () => {
    let paint: (() => void) | undefined;
    const fakeMap = {
      once: (_event: string, listener: () => void) => {
        paint = listener;
        return fakeMap;
      },
      off: () => fakeMap,
      triggerRepaint: () => undefined,
    } as unknown as MapLibreMap;
    let settled = false;
    const waiting = waitForVideoMapPaint(fakeMap).then(() => {
      settled = true;
    });

    await Promise.resolve();
    expect(settled).toBe(false);
    paint?.();
    await waiting;
    expect(settled).toBe(true);
  });

  test("waits through terrain changes until the painted map is idle", async () => {
    let idle: (() => void) | undefined;
    const fakeMap = {
      on: (_event: string, listener: () => void) => {
        idle = listener;
        return fakeMap;
      },
      off: () => fakeMap,
      triggerRepaint: () => undefined,
    } as unknown as MapLibreMap;
    let ready = false;
    let settled = false;
    const waiting = waitForReadyVideoMapIdle(fakeMap, () => ready).then(() => {
      settled = true;
    });

    idle?.();
    await Promise.resolve();
    expect(settled).toBe(false);
    ready = true;
    idle?.();
    await waiting;
    expect(settled).toBe(true);
  });

  test("rejects an already canceled terrain renderer before allocating WebGL", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      VideoTerrainRenderer.create(1920, 1080, controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  test("keeps singleton fixes and unwraps antimeridian route geometry", () => {
    const data = videoRouteData([
      [{ latitude: 10, longitude: 179 }],
      [
        { latitude: 10, longitude: 179 },
        { latitude: 11, longitude: -179 },
      ],
    ]);

    expect(data.features[0]?.geometry.type).toBe("Point");
    const line = data.features[1]?.geometry;
    expect(line?.type).toBe("LineString");
    if (line?.type !== "LineString") throw new Error("Expected route line");
    expect(Math.abs(line.coordinates[1][0] - line.coordinates[0][0])).toBe(2);
  });

  test("keeps topographic raster URLs for the WebGL fallback", () => {
    expect(videoMapTileUrl("terrain", 15, 17430, 11591)).toBe(
      "https://a.tile.opentopomap.org/15/17430/11591.png",
    );
    expect(videoMapTileUrl("online", 15, 17430, 11591)).toBe(
      "https://tile.openstreetmap.org/15/17430/11591.png",
    );
  });

  test("keeps a bounded fallback when a terrain tile fails", async () => {
    const fallback = { close() {} } as ImageBitmap;
    const requests: string[] = [];
    const result = await fetchVideoMapTile(
      "terrain",
      15,
      17430,
      11591,
      undefined,
      async (url) => {
        requests.push(url);
        if (url.includes("opentopomap")) throw new Error("tile unavailable");
        return fallback;
      },
    );

    expect(result).toBe(fallback);
    expect(requests).toEqual([
      "https://a.tile.opentopomap.org/15/17430/11591.png",
      "https://tile.openstreetmap.org/15/17430/11591.png",
    ]);
  });

  test("settles a missing tile without an unbounded retry", async () => {
    let requests = 0;
    const result = await fetchVideoMapTile(
      "terrain",
      15,
      17430,
      11591,
      undefined,
      async () => {
        requests += 1;
        throw new Error("offline");
      },
    );

    expect(result).toBeUndefined();
    expect(requests).toBe(2);
  });

  test("defaults to portable 1080p and keeps 4K optional", () => {
    expect(VIDEO_OUTPUT_RESOLUTIONS).toEqual([
      { width: 1920, height: 1080, label: "1080p" },
      { width: 3840, height: 2160, label: "4K" },
    ]);
    expect(videoResolutionAttempts().map((entry) => entry.label)).toEqual([
      "1080p",
    ]);
    expect(videoResolutionAttempts("4K").map((entry) => entry.label)).toEqual([
      "4K",
      "1080p",
    ]);
  });

  test("finds bounds for recording-sized tracks without argument spreading", () => {
    const points = Array.from({ length: 200_000 }, (_, index) => ({
      latitude: 40 + index / 1_000_000,
      longitude: 10 + index / 1_000_000,
    }));
    expect(videoBounds({ points, segmentStarts: [0] }, [])).toEqual({
      minLatitude: 40,
      maxLatitude: 40.199999,
      minLongitude: 10,
      maxLongitude: 10.199999,
    });
  });

  test("keeps an antimeridian route compact", () => {
    const track: Track = {
      points: [
        { latitude: 10, longitude: 179 },
        { latitude: 11, longitude: -179 },
      ],
      segmentStarts: [0],
    };
    const bounds = videoBounds(track, [])!;

    expect(bounds.maxLongitude - bounds.minLongitude).toBe(2);
    for (const point of track.points) {
      const projected = projectVideoPoint(point, bounds);
      expect(projected.x).toBeGreaterThan(VIDEO_WIDTH * 0.5);
      expect(projected.x).toBeLessThan(VIDEO_WIDTH);
      expect(projected.y).toBeGreaterThan(0);
      expect(projected.y).toBeLessThan(VIDEO_HEIGHT);
    }
  });

  test("can project the active trail across the full route-only frame", () => {
    const bounds = {
      minLatitude: 10,
      maxLatitude: 11,
      minLongitude: 20,
      maxLongitude: 21,
    };
    const projected = projectVideoPoint(
      { latitude: 10.5, longitude: 20.5 },
      bounds,
      { left: 0, top: 0, width: VIDEO_WIDTH, height: VIDEO_HEIGHT },
    );

    expect(projected).toEqual({ x: VIDEO_WIDTH / 2, y: VIDEO_HEIGHT / 2 });
  });

  test("uses GPX bounds instead of off-route camera coordinates", () => {
    const track: Track = {
      points: [
        { latitude: 46, longitude: 11 },
        { latitude: 46.1, longitude: 11.1 },
      ],
      segmentStarts: [0],
    };
    const bounds = videoBounds(track, [
      {
        photoId: "photo",
        source: "track",
        coordinates: { latitude: 46, longitude: 11 },
        trackCoordinates: { latitude: 46, longitude: 11 },
        discrepancyM: 50_000,
      },
    ])!;

    expect(bounds).toMatchObject({
      minLatitude: 46,
      maxLatitude: 46.1,
      minLongitude: 11,
      maxLongitude: 11.1,
    });
  });
});
