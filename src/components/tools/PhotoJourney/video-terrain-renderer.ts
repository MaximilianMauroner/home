import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";

import {
  applyMode,
  baseStyle,
  cameraFrameForPoints,
  FOLLOW_ZOOM,
  interpolateJourneyBearing,
  interpolateJourneyCamera,
  journeyCameraBearing,
  journeyCameraPitch,
  legSpansGlobe,
  TERRAIN_EXAGGERATION,
  TERRAIN_PITCH,
  unwrapJourneyPoints,
} from "./JourneyMap";
import type { TrackPoint } from "./gpx";
import type { Coordinates } from "./types";

export type VideoTerrainFrame = {
  renderKey: string;
  contextKey: string;
  completedKey: string;
  currentKey: string;
  segments: readonly (readonly TrackPoint[])[];
  completed: readonly (readonly Coordinates[])[];
  current?: readonly Coordinates[];
  marker?: Coordinates;
  cameraPoints: readonly Coordinates[];
  bearingPoints?: readonly Coordinates[];
  previousCameraPoints?: readonly Coordinates[];
  previousBearingPoints?: readonly Coordinates[];
  cameraBlend?: number;
  edgePadding?: { top: number; right: number; bottom: number; left: number };
  maxZoom?: number;
};

export type RenderedTerrainFrame = {
  canvas: HTMLCanvasElement;
  marker?: { x: number; y: number };
};

/** Returns the marker longitude in the world copy nearest the camera. */
export function videoMarkerLongitude(
  longitude: number,
  cameraLongitude: number,
) {
  return longitude + Math.round((cameraLongitude - longitude) / 360) * 360;
}

export function videoRouteData(
  segments: readonly (readonly Coordinates[])[],
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const segment of segments) {
    if (segment.length === 1) {
      features.push({
        type: "Feature",
        properties: { singleton: true },
        geometry: {
          type: "Point",
          coordinates: [segment[0].longitude, segment[0].latitude],
        },
      });
      continue;
    }
    if (segment.length > 1)
      features.push({
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: unwrapJourneyPoints([...segment]).map(
            ({ longitude, latitude }) => [longitude, latitude],
          ),
        },
      });
  }
  return {
    type: "FeatureCollection",
    features,
  };
}

function pointData(point?: Coordinates): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: point
      ? [
          {
            type: "Feature",
            properties: { carried: false },
            geometry: {
              type: "Point",
              coordinates: [point.longitude, point.latitude],
            },
          },
        ]
      : [],
  };
}

function source(map: MapLibreMap, id: string) {
  return map.getSource(id) as GeoJSONSource | undefined;
}

function abortError() {
  return new DOMException("MP4 export canceled", "AbortError");
}

function waitForMap(
  map: MapLibreMap,
  ready: () => boolean,
  signal?: AbortSignal,
  timeoutMs = 4_000,
) {
  if (signal?.aborted) return Promise.reject(abortError());
  if (ready()) return Promise.resolve(true);
  return new Promise<boolean>((resolve, reject) => {
    const finish = (result: boolean) => {
      globalThis.clearTimeout(timeout);
      map.off("render", check);
      map.off("sourcedata", check);
      signal?.removeEventListener("abort", abort);
      resolve(result);
    };
    const check = () => {
      if (ready()) finish(true);
    };
    const abort = () => {
      globalThis.clearTimeout(timeout);
      map.off("render", check);
      map.off("sourcedata", check);
      reject(abortError());
    };
    const timeout = globalThis.setTimeout(() => finish(false), timeoutMs);
    map.on("render", check);
    map.on("sourcedata", check);
    signal?.addEventListener("abort", abort, { once: true });
    map.triggerRepaint();
  });
}

export function waitForVideoMapPaint(
  map: MapLibreMap,
  signal?: AbortSignal,
  timeoutMs = 4_000,
) {
  if (signal?.aborted) return Promise.reject(abortError());
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      globalThis.clearTimeout(timeout);
      map.off("render", painted);
      signal?.removeEventListener("abort", abort);
    };
    const painted = () => {
      cleanup();
      resolve();
    };
    const fail = (error: Error) => {
      cleanup();
      reject(error);
    };
    const abort = () => fail(abortError());
    const timeout = globalThis.setTimeout(
      () => fail(new Error("The 3D map did not paint the requested frame.")),
      timeoutMs,
    );
    map.once("render", painted);
    signal?.addEventListener("abort", abort, { once: true });
    map.triggerRepaint();
  });
}

/** Waits until MapLibre has painted all follow-up terrain work for the frame. */
export function waitForReadyVideoMapIdle(
  map: MapLibreMap,
  ready: () => boolean,
  signal?: AbortSignal,
  timeoutMs = 8_000,
) {
  if (signal?.aborted) return Promise.reject(abortError());
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      globalThis.clearTimeout(timeout);
      map.off("idle", settled);
      signal?.removeEventListener("abort", abort);
    };
    const settled = () => {
      if (!ready()) return;
      cleanup();
      resolve();
    };
    const fail = (error: Error) => {
      cleanup();
      reject(error);
    };
    const abort = () => fail(abortError());
    const timeout = globalThis.setTimeout(
      () => fail(new Error("The 3D terrain tiles did not finish rendering.")),
      timeoutMs,
    );
    map.on("idle", settled);
    signal?.addEventListener("abort", abort, { once: true });
    map.triggerRepaint();
  });
}

export function videoTerrainJumpOptions(
  view: { center: [number, number]; zoom: number },
  pitch: number,
  bearing: number,
  padding?: { top: number; right: number; bottom: number; left: number },
) {
  return {
    center: view.center,
    zoom: view.zoom,
    pitch,
    bearing,
    padding: padding ?? { top: 0, right: 0, bottom: 0, left: 0 },
  };
}

/** Hidden MapLibre surface for MP4 frames, with the live style, DEM, and camera math. */
export class VideoTerrainRenderer {
  private failed: Error | undefined;
  private contextKey = "";
  private completedKey = "";
  private currentKey = "";
  private projection = "mercator";
  private lastRender:
    | { key: string; marker?: { x: number; y: number } }
    | undefined;

  private constructor(
    private readonly map: MapLibreMap,
    private readonly container: HTMLDivElement,
  ) {}

  static async create(width: number, height: number, signal?: AbortSignal) {
    if (signal?.aborted) throw abortError();
    const [module, worker] = await Promise.all([
      import("maplibre-gl"),
      import("maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url"),
    ]);
    if (signal?.aborted) throw abortError();
    module.config.WORKER_URL = worker.default;
    const pixelRatio = Math.max(1, width / 1280);
    const container = document.createElement("div");
    container.setAttribute("aria-hidden", "true");
    container.inert = true;
    Object.assign(container.style, {
      position: "fixed",
      left: "-10000px",
      top: "0",
      width: `${width / pixelRatio}px`,
      height: `${height / pixelRatio}px`,
      pointerEvents: "none",
    });
    document.body.append(container);
    let map: MapLibreMap | undefined;
    try {
      map = new module.Map({
        container,
        style: baseStyle(),
        interactive: false,
        attributionControl: false,
        fadeDuration: 0,
        pixelRatio,
        maxPitch: TERRAIN_PITCH,
        canvasContextAttributes: { preserveDrawingBuffer: true },
      });
      const renderer = new VideoTerrainRenderer(map, container);
      map.on("error", (event) => {
        renderer.failed = new Error(
          `The 3D map could not load its terrain or map data. ${event.error.message}`,
        );
      });
      map.getCanvas().addEventListener("webglcontextlost", (event) => {
        event.preventDefault();
        renderer.failed = new Error(
          "The GPU stopped the 3D terrain renderer during export.",
        );
      });
      const loaded = await waitForMap(
        map,
        () => map?.isStyleLoaded() ?? false,
        signal,
        10_000,
      );
      if (!loaded) throw new Error("The 3D map style did not finish loading.");
      if (renderer.failed) throw renderer.failed;
      applyMode(map, "terrain");
      map.setTerrain({ source: "dem", exaggeration: TERRAIN_EXAGGERATION });
      return renderer;
    } catch (error) {
      try {
        map?.remove();
      } finally {
        container.remove();
      }
      throw error;
    }
  }

  private setLine(
    id: "route-context" | "route-completed" | "route-current",
    keyName: "contextKey" | "completedKey" | "currentKey",
    key: string,
    segments: readonly (readonly Coordinates[])[],
  ) {
    if (this[keyName] === key) return false;
    this[keyName] = key;
    source(this.map, id)?.setData(videoRouteData(segments));
    return true;
  }

  async render(
    frame: VideoTerrainFrame,
    signal?: AbortSignal,
  ): Promise<RenderedTerrainFrame> {
    if (signal?.aborted) throw abortError();
    if (this.failed) throw this.failed;
    if (this.lastRender?.key === frame.renderKey)
      return { canvas: this.map.getCanvas(), marker: this.lastRender.marker };
    const changedSources = [
      this.setLine(
        "route-context",
        "contextKey",
        frame.contextKey,
        frame.segments,
      ),
      this.setLine(
        "route-completed",
        "completedKey",
        frame.completedKey,
        frame.completed,
      ),
      this.setLine(
        "route-current",
        "currentKey",
        frame.currentKey,
        frame.current ? [frame.current] : [],
      ),
    ].some(Boolean);
    source(this.map, "route-tip")?.setData(pointData(frame.marker));

    const projectionPoints = frame.bearingPoints?.length
      ? [...frame.bearingPoints]
      : [...frame.cameraPoints];
    const globe = legSpansGlobe(projectionPoints);
    const projection = globe ? "globe" : "mercator";
    if (this.projection !== projection) {
      this.projection = projection;
      this.map.setProjection({ type: projection });
    }
    const pitch = journeyCameraPitch("terrain", globe, false);
    const frameSize = {
      width: this.map.getContainer().clientWidth,
      height: this.map.getContainer().clientHeight,
    };
    let view = cameraFrameForPoints(
      unwrapJourneyPoints([...frame.cameraPoints]),
      frameSize,
      70,
      frame.maxZoom ?? FOLLOW_ZOOM,
      frame.edgePadding,
      pitch,
      this.map.getVerticalFieldOfView(),
    );
    let bearing = frame.bearingPoints?.length
      ? journeyCameraBearing(frame.bearingPoints, "terrain", false)
      : 0;
    if (frame.previousCameraPoints?.length && frame.cameraBlend !== undefined) {
      const previousView = cameraFrameForPoints(
        unwrapJourneyPoints([...frame.previousCameraPoints]),
        frameSize,
        70,
        frame.maxZoom ?? FOLLOW_ZOOM,
        frame.edgePadding,
        pitch,
        this.map.getVerticalFieldOfView(),
      );
      view = interpolateJourneyCamera(previousView, view, frame.cameraBlend);
      bearing = interpolateJourneyBearing(
        journeyCameraBearing(
          frame.previousBearingPoints ?? frame.previousCameraPoints,
          "terrain",
          false,
        ),
        bearing,
        frame.cameraBlend,
      );
    }
    this.map.jumpTo(
      videoTerrainJumpOptions(view, pitch, bearing, frame.edgePadding),
    );
    const ready = () => {
      if (this.failed) return true;
      return (
        [
          "route-context",
          "route-completed",
          "route-current",
          "route-tip",
        ].every((id) => this.map.isSourceLoaded(id)) &&
        this.map.areTilesLoaded()
      );
    };
    await waitForReadyVideoMapIdle(
      this.map,
      ready,
      signal,
      changedSources ? 8_000 : 3_000,
    );
    if (this.failed) throw this.failed;
    const projected = frame.marker
      ? this.map.project([
          videoMarkerLongitude(
            frame.marker.longitude,
            this.map.getCenter().lng,
          ),
          frame.marker.latitude,
        ])
      : undefined;
    const result = {
      canvas: this.map.getCanvas(),
      marker: projected ? { x: projected.x, y: projected.y } : undefined,
    };
    this.lastRender = { key: frame.renderKey, marker: result.marker };
    return result;
  }

  destroy() {
    try {
      this.map.remove();
    } finally {
      this.container.remove();
    }
  }
}
