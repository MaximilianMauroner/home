import {
  BufferTarget,
  CanvasSource,
  getFirstEncodableVideoCodec,
  Mp4OutputFormat,
  Output,
  Quality,
} from "mediabunny";
import { trackSegments, trackStats, type Track, type TrackPoint } from "./gpx";
import { burstPhotoProgress, journeyMotion } from "./motion";
import {
  recordedElevationProfile,
  recordedDepartureProgressStats,
  recordedContextForPhoto,
  recordedLegFrame,
  recordedLegPrefix,
  recordedPhotoProgressStats,
  recordedProgressStats,
  type RecordedElevationProfile,
  type RecordedProgressStats,
  type RouteStory,
} from "./route-progress";
import {
  timelineAt,
  type JourneyTimeline,
  type TimelineState,
} from "./timeline";
import type { Placement } from "./track";
import { localDisplayMoment, photoDisplayMoment } from "./time-display";
import type { Coordinates, JourneyPhoto } from "./types";
import {
  previousRecordedLeg,
  routeCameraBlendFraction,
  STOP_ZOOM,
  type MapMode,
} from "./JourneyMap";
import { VideoTerrainRenderer } from "./video-terrain-renderer";

export const VIDEO_WIDTH = 1280;
export const VIDEO_HEIGHT = 720;
export const VIDEO_FRAME_RATE = 30;
export const VIDEO_OUTPUT_RESOLUTIONS = [
  { width: 1920, height: 1080, label: "1080p" },
  { width: 3840, height: 2160, label: "4K" },
] as const;
export type VideoResolutionLabel =
  (typeof VIDEO_OUTPUT_RESOLUTIONS)[number]["label"];
const PHOTO_WIDTH = VIDEO_WIDTH / 2;
const INFO_HEIGHT = 58;
const MAP_LEFT = PHOTO_WIDTH;
const TRAIL_PROGRESS_CAMERA_PADDING = 220;

export type JourneyVideoOptions = {
  title: string;
  timezone: string;
  photos: readonly JourneyPhoto[];
  placements: readonly Placement[];
  timeline: JourneyTimeline;
  track?: Track;
  routeStory?: RouteStory;
  mapMode?: MapMode;
  resolution?: VideoResolutionLabel;
  signal?: AbortSignal;
  onProgress?: (progress: number) => void;
};

type Bounds = {
  minLatitude: number;
  maxLatitude: number;
  minLongitude: number;
  maxLongitude: number;
};

type MapArea = {
  left: number;
  top: number;
  width: number;
  height: number;
};

const FULL_MAP: MapArea = {
  left: 0,
  top: 0,
  width: VIDEO_WIDTH,
  height: VIDEO_HEIGHT,
};
const SPLIT_MAP: MapArea = {
  left: MAP_LEFT,
  top: 0,
  width: VIDEO_WIDTH - MAP_LEFT,
  height: VIDEO_HEIGHT,
};

function abortError() {
  return new DOMException("MP4 export canceled", "AbortError");
}

class PhotoExportError extends Error {}

function checkAbort(signal?: AbortSignal) {
  if (signal?.aborted) throw abortError();
}

function canvasContext(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d", { alpha: false });
  if (!context)
    throw new Error("This browser could not create the video canvas.");
  return context;
}

/** Places longitudes near the route's first point so antimeridian trips stay compact. */
function unwrapLongitude(longitude: number, reference: number) {
  let value = longitude;
  while (value - reference > 180) value -= 360;
  while (value - reference < -180) value += 360;
  return value;
}

export function videoBounds(
  track: Track | undefined,
  placements: readonly Placement[],
): Bounds | undefined {
  const route = track?.points ?? [];
  const positioned = placements.flatMap((placement) =>
    placement.coordinates ? [placement.coordinates] : [],
  );
  const points = route.length ? route : positioned;
  if (!points.length) return undefined;
  const reference = points[0].longitude;
  let minLatitude = Number.POSITIVE_INFINITY;
  let maxLatitude = Number.NEGATIVE_INFINITY;
  let minLongitude = Number.POSITIVE_INFINITY;
  let maxLongitude = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    const longitude = unwrapLongitude(point.longitude, reference);
    minLatitude = Math.min(minLatitude, point.latitude);
    maxLatitude = Math.max(maxLatitude, point.latitude);
    minLongitude = Math.min(minLongitude, longitude);
    maxLongitude = Math.max(maxLongitude, longitude);
  }
  return {
    minLatitude,
    maxLatitude,
    minLongitude,
    maxLongitude,
  };
}

export function projectVideoPoint(
  point: Coordinates,
  bounds: Bounds,
  area: MapArea = SPLIT_MAP,
) {
  const latitudeRange = Math.max(
    0.0001,
    bounds.maxLatitude - bounds.minLatitude,
  );
  const longitudeRange = Math.max(
    0.0001,
    bounds.maxLongitude - bounds.minLongitude,
  );
  const reference = (bounds.minLongitude + bounds.maxLongitude) / 2;
  const x =
    area.left +
    52 +
    ((unwrapLongitude(point.longitude, reference) - bounds.minLongitude) /
      longitudeRange) *
      (area.width - 104);
  const y =
    area.top +
    70 +
    ((bounds.maxLatitude - point.latitude) / latitudeRange) *
      (area.height - 140);
  return { x, y };
}

function drawContainedImage(
  context: CanvasRenderingContext2D,
  image: ImageBitmap,
  width: number,
  height: number,
) {
  const scale = Math.min(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  context.drawImage(
    image,
    (width - drawWidth) / 2,
    (height - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
}

function drawCoveredImage(
  context: CanvasRenderingContext2D,
  image: ImageBitmap,
  width: number,
  height: number,
) {
  const scale = Math.max(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  context.drawImage(
    image,
    (width - drawWidth) / 2,
    (height - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
}

function drawRoute(
  context: CanvasRenderingContext2D,
  segments: readonly TrackPoint[][],
  bounds: Bounds | undefined,
  area: MapArea = SPLIT_MAP,
  surface: MapArea = area,
) {
  context.fillStyle = "#0b1519";
  context.fillRect(surface.left, surface.top, surface.width, surface.height);
  context.strokeStyle = "#20343c";
  context.lineWidth = 1;
  for (let x = surface.left + 52; x < surface.left + surface.width; x += 96) {
    context.beginPath();
    context.moveTo(x, surface.top);
    context.lineTo(x, surface.top + surface.height);
    context.stroke();
  }
  for (let y = surface.top + 70; y < surface.top + surface.height; y += 96) {
    context.beginPath();
    context.moveTo(surface.left, y);
    context.lineTo(surface.left + surface.width, y);
    context.stroke();
  }
  if (!bounds) return;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = "#f1cf67";
  context.lineWidth = 5;
  for (const segment of segments) {
    if (!segment.length) continue;
    context.beginPath();
    segment.forEach((point, index) => {
      const projected = projectVideoPoint(point, bounds, area);
      if (index) context.lineTo(projected.x, projected.y);
      else context.moveTo(projected.x, projected.y);
    });
    context.stroke();
  }
}

const TILE_SIZE = 256;
const OSM_TILE = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TERRAIN_TILE = "https://a.tile.opentopomap.org/{z}/{x}/{y}.png";

type MercatorView = {
  zoom: number;
  originX: number;
  originY: number;
  referenceLongitude: number;
};

function mercatorWorld(point: Coordinates, zoom: number, reference: number) {
  const longitude = unwrapLongitude(point.longitude, reference);
  const latitude = Math.max(-85.051129, Math.min(85.051129, point.latitude));
  const scale = 2 ** zoom * TILE_SIZE;
  const radians = (latitude * Math.PI) / 180;
  return {
    x: ((longitude + 180) / 360) * scale,
    y:
      ((1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) /
        2) *
      scale,
  };
}

function mercatorView(
  bounds: Bounds,
  area: MapArea,
  maxZoom = 16,
): MercatorView {
  const referenceLongitude = (bounds.minLongitude + bounds.maxLongitude) / 2;
  const padding = 54;
  let zoom = maxZoom;
  for (; zoom > 2; zoom -= 1) {
    const nw = mercatorWorld(
      { latitude: bounds.maxLatitude, longitude: bounds.minLongitude },
      zoom,
      referenceLongitude,
    );
    const se = mercatorWorld(
      { latitude: bounds.minLatitude, longitude: bounds.maxLongitude },
      zoom,
      referenceLongitude,
    );
    if (
      se.x - nw.x <= area.width - padding * 2 &&
      se.y - nw.y <= area.height - padding * 2
    )
      break;
  }
  const nw = mercatorWorld(
    { latitude: bounds.maxLatitude, longitude: bounds.minLongitude },
    zoom,
    referenceLongitude,
  );
  const se = mercatorWorld(
    { latitude: bounds.minLatitude, longitude: bounds.maxLongitude },
    zoom,
    referenceLongitude,
  );
  return {
    zoom,
    originX: (nw.x + se.x - area.width) / 2,
    originY: (nw.y + se.y - area.height) / 2,
    referenceLongitude,
  };
}

function projectMercatorPoint(
  point: Coordinates,
  view: MercatorView,
  area: MapArea,
) {
  const world = mercatorWorld(point, view.zoom, view.referenceLongitude);
  return {
    x: area.left + world.x - view.originX,
    y: area.top + world.y - view.originY,
  };
}

async function fetchTile(url: string, signal?: AbortSignal) {
  const response = await fetch(url, { signal });
  if (!response.ok)
    throw new Error(`Map tile request failed (${response.status}).`);
  return createImageBitmap(await response.blob());
}

function isAbort(error: unknown) {
  return (error as DOMException)?.name === "AbortError";
}

function tileUrl(template: string, zoom: number, x: number, y: number) {
  const count = 2 ** zoom;
  const wrappedX = ((x % count) + count) % count;
  return template
    .replace("{z}", String(zoom))
    .replace("{x}", String(wrappedX))
    .replace("{y}", String(y));
}

export function videoMapTileUrl(
  mode: Exclude<MapMode, "offline">,
  zoom: number,
  x: number,
  y: number,
) {
  return tileUrl(mode === "terrain" ? TERRAIN_TILE : OSM_TILE, zoom, x, y);
}

export async function fetchVideoMapTile(
  mode: Exclude<MapMode, "offline">,
  zoom: number,
  x: number,
  y: number,
  signal?: AbortSignal,
  load = fetchTile,
) {
  try {
    return await load(videoMapTileUrl(mode, zoom, x, y), signal);
  } catch (error) {
    if (isAbort(error)) throw error;
    if (mode !== "terrain") return undefined;
    try {
      return await load(videoMapTileUrl("online", zoom, x, y), signal);
    } catch (fallbackError) {
      if (isAbort(fallbackError)) throw fallbackError;
      return undefined;
    }
  }
}

async function prepareMapBackdrop(
  segments: readonly TrackPoint[][],
  bounds: Bounds,
  area: MapArea,
  mode: MapMode,
  signal?: AbortSignal,
) {
  const canvas = document.createElement("canvas");
  canvas.width = area.width;
  canvas.height = area.height;
  const context = canvasContext(canvas);
  context.fillStyle = "#132027";
  context.fillRect(0, 0, canvas.width, canvas.height);
  const localArea = { left: 0, top: 0, width: area.width, height: area.height };
  const view = mercatorView(bounds, localArea, mode === "terrain" ? 15 : 17);
  const pixelScale = area.height / VIDEO_HEIGHT;
  if (mode !== "offline") {
    const firstX = Math.floor(view.originX / TILE_SIZE);
    const lastX = Math.floor((view.originX + area.width) / TILE_SIZE);
    const firstY = Math.max(0, Math.floor(view.originY / TILE_SIZE));
    const lastY = Math.min(
      2 ** view.zoom - 1,
      Math.floor((view.originY + area.height) / TILE_SIZE),
    );
    const jobs: Promise<void>[] = [];
    for (let y = firstY; y <= lastY; y += 1) {
      for (let x = firstX; x <= lastX; x += 1) {
        const left = x * TILE_SIZE - view.originX;
        const top = y * TILE_SIZE - view.originY;
        jobs.push(
          (async () => {
            const base = await fetchVideoMapTile(
              mode === "terrain" ? "terrain" : "online",
              view.zoom,
              x,
              y,
              signal,
            );
            if (!base) return;
            context.drawImage(base, left, top, TILE_SIZE, TILE_SIZE);
            base.close();
          })(),
        );
      }
    }
    await Promise.all(jobs);
    context.fillStyle = "#0710142e";
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = "#071014";
  context.lineWidth = 7 * pixelScale;
  for (const segment of segments) {
    if (!segment.length) continue;
    context.beginPath();
    segment.forEach((point, index) => {
      const projected = projectMercatorPoint(point, view, localArea);
      if (index) context.lineTo(projected.x, projected.y);
      else context.moveTo(projected.x, projected.y);
    });
    context.stroke();
  }
  context.strokeStyle = "#38bdf8";
  context.globalAlpha = 0.78;
  context.lineWidth = 3 * pixelScale;
  for (const segment of segments) {
    if (!segment.length) continue;
    context.beginPath();
    segment.forEach((point, index) => {
      const projected = projectMercatorPoint(point, view, localArea);
      if (index) context.lineTo(projected.x, projected.y);
      else context.moveTo(projected.x, projected.y);
    });
    context.stroke();
  }
  context.globalAlpha = 1;
  context.font = `${10 * pixelScale}px system-ui, sans-serif`;
  const creditLines =
    mode === "terrain"
      ? [
          "Map data © OpenStreetMap contributors · openstreetmap.org/copyright · SRTM",
          "Map style © OpenTopoMap (CC-BY-SA 3.0)",
        ]
      : ["Map data © OpenStreetMap contributors · openstreetmap.org/copyright"];
  const creditWidth =
    Math.max(...creditLines.map((line) => context.measureText(line).width)) +
    12 * pixelScale;
  const creditHeight = (creditLines.length * 13 + 7) * pixelScale;
  context.fillStyle = "#071014cc";
  context.fillRect(
    8 * pixelScale,
    canvas.height - creditHeight - 4 * pixelScale,
    creditWidth,
    creditHeight,
  );
  context.fillStyle = "#d2dcde";
  creditLines.forEach((line, index) =>
    context.fillText(
      line,
      14 * pixelScale,
      canvas.height - (creditLines.length - index) * 13 * pixelScale,
    ),
  );
  return { canvas, view };
}

type PreparedMap = Awaited<ReturnType<typeof prepareMapBackdrop>>;

function drawPreparedMap(
  context: CanvasRenderingContext2D,
  prepared: PreparedMap,
  area: MapArea,
) {
  context.drawImage(
    prepared.canvas,
    area.left,
    area.top,
    area.width,
    area.height,
  );
}

function drawPreparedMarker(
  context: CanvasRenderingContext2D,
  prepared: PreparedMap,
  area: MapArea,
  marker: Coordinates | undefined,
) {
  if (!marker) return;
  const local = projectMercatorPoint(marker, prepared.view, {
    left: 0,
    top: 0,
    width: prepared.canvas.width,
    height: prepared.canvas.height,
  });
  const x = area.left + (local.x / prepared.canvas.width) * area.width;
  const y = area.top + (local.y / prepared.canvas.height) * area.height;
  context.fillStyle = "#071014";
  context.beginPath();
  context.arc(x, y, 12, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#f1cf67";
  context.beginPath();
  context.arc(x, y, 7, 0, Math.PI * 2);
  context.fill();
}

function drawTravelledRoute(
  context: CanvasRenderingContext2D,
  prepared: PreparedMap,
  area: MapArea,
  routeStory: RouteStory | undefined,
  photoIndex: number,
  currentProgress = 1,
  departure = false,
) {
  if (!routeStory) return;
  const activeSegments = new Set(
    recordedContextForPhoto(routeStory, photoIndex)?.map((segment) =>
      routeStory.context.indexOf(segment),
    ),
  );
  const lines = routeStory.legs
    .slice(0, photoIndex + 1)
    .flatMap((leg, index) => {
      const visible: TrackPoint[][] = [];
      if (leg && activeSegments.has(leg.segmentIndex))
        visible.push(
          index === photoIndex && !departure
            ? recordedLegPrefix(leg, currentProgress)
            : leg.drawable,
        );
      const tail = routeStory.departureLegs[index];
      if (tail && (index < photoIndex || departure))
        visible.push(
          index === photoIndex
            ? recordedLegPrefix(tail, currentProgress)
            : tail.drawable,
        );
      return visible;
    });
  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = "#071014";
  context.lineWidth = 7;
  for (const width of [7, 4]) {
    context.lineWidth = width;
    context.strokeStyle = width === 7 ? "#071014" : "#f1cf67";
    for (const line of lines) {
      if (!line.length) continue;
      context.beginPath();
      line.forEach((point, index) => {
        const local = projectMercatorPoint(point, prepared.view, {
          left: 0,
          top: 0,
          width: prepared.canvas.width,
          height: prepared.canvas.height,
        });
        const x = area.left + (local.x / prepared.canvas.width) * area.width;
        const y = area.top + (local.y / prepared.canvas.height) * area.height;
        if (index) context.lineTo(x, y);
        else context.moveTo(x, y);
      });
      context.stroke();
    }
  }
  context.restore();
}

export function travelledSegments(
  routeStory: RouteStory | undefined,
  photoIndex: number,
  currentProgress = 1,
  departure = false,
) {
  if (!routeStory) return [];
  const activeSegments = new Set(
    recordedContextForPhoto(routeStory, photoIndex)?.map((segment) =>
      routeStory.context.indexOf(segment),
    ),
  );
  return routeStory.legs.slice(0, photoIndex + 1).flatMap((leg, index) => {
    const visible: TrackPoint[][] = [];
    if (leg && activeSegments.has(leg.segmentIndex))
      visible.push(
        index === photoIndex && !departure
          ? recordedLegPrefix(leg, currentProgress)
          : leg.drawable,
      );
    const tail = routeStory.departureLegs[index];
    if (tail && (index < photoIndex || departure))
      visible.push(
        index === photoIndex
          ? recordedLegPrefix(tail, currentProgress)
          : tail.drawable,
      );
    return visible;
  });
}

function completedTerrainSegments(
  routeStory: RouteStory | undefined,
  photoIndex: number,
) {
  if (!routeStory) return [];
  const activeSegments = new Set(
    recordedContextForPhoto(routeStory, photoIndex)?.map((segment) =>
      routeStory.context.indexOf(segment),
    ),
  );
  return routeStory.legs.slice(0, photoIndex).flatMap((leg, index) => {
    const visible: TrackPoint[][] = [];
    if (leg && activeSegments.has(leg.segmentIndex)) visible.push(leg.drawable);
    const tail = routeStory.departureLegs[index];
    if (tail) visible.push(tail.drawable);
    return visible;
  });
}

function trimPreparedMapCache(cache: Map<string, PreparedMap>, keepId: string) {
  for (const [id, prepared] of cache) {
    if (id === keepId || cache.size <= 3) continue;
    prepared.canvas.width = 1;
    prepared.canvas.height = 1;
    cache.delete(id);
  }
}

function cameraPointsForBounds(bounds: Bounds | undefined) {
  if (!bounds) return [];
  return [
    { latitude: bounds.minLatitude, longitude: bounds.minLongitude },
    { latitude: bounds.maxLatitude, longitude: bounds.maxLongitude },
  ];
}

function boundsForSegments(segments: readonly TrackPoint[][]) {
  const points = segments.flat();
  return videoBounds(
    points.length ? { points, segmentStarts: [0] } : undefined,
    [],
  );
}

function boundsAround(point: Coordinates | undefined, fallback?: Bounds) {
  if (!point) return fallback;
  const latitudeRadius = 0.012;
  const longitudeRadius =
    latitudeRadius / Math.max(0.25, Math.cos((point.latitude * Math.PI) / 180));
  return {
    minLatitude: point.latitude - latitudeRadius,
    maxLatitude: point.latitude + latitudeRadius,
    minLongitude: point.longitude - longitudeRadius,
    maxLongitude: point.longitude + longitudeRadius,
  };
}

function drawPhotoMapMarker(
  context: CanvasRenderingContext2D,
  prepared: PreparedMap,
  area: MapArea,
  marker: Coordinates | undefined,
  bitmap: ImageBitmap,
) {
  if (!marker) return;
  const local = projectMercatorPoint(marker, prepared.view, {
    left: 0,
    top: 0,
    width: prepared.canvas.width,
    height: prepared.canvas.height,
  });
  const x = area.left + (local.x / prepared.canvas.width) * area.width;
  const y = area.top + (local.y / prepared.canvas.height) * area.height;
  const size = 46;
  context.save();
  context.fillStyle = "#071014";
  context.beginPath();
  context.roundRect(x - size / 2 - 4, y - size / 2 - 4, size + 8, size + 8, 12);
  context.fill();
  context.beginPath();
  context.roundRect(x - size / 2, y - size / 2, size, size, 9);
  context.clip();
  const scale = Math.max(size / bitmap.width, size / bitmap.height);
  const width = bitmap.width * scale;
  const height = bitmap.height * scale;
  context.drawImage(bitmap, x - width / 2, y - height / 2, width, height);
  context.restore();
  context.strokeStyle = "#f1cf67";
  context.lineWidth = 3;
  context.beginPath();
  context.roundRect(x - size / 2 - 2, y - size / 2 - 2, size + 4, size + 4, 11);
  context.stroke();
}

function drawPhotoMapMarkerAt(
  context: CanvasRenderingContext2D,
  point: { x: number; y: number } | undefined,
  bitmap: ImageBitmap,
) {
  if (!point) return;
  const size = 46;
  context.save();
  context.fillStyle = "#071014";
  context.beginPath();
  context.roundRect(
    point.x - size / 2 - 4,
    point.y - size / 2 - 4,
    size + 8,
    size + 8,
    12,
  );
  context.fill();
  context.beginPath();
  context.roundRect(point.x - size / 2, point.y - size / 2, size, size, 9);
  context.clip();
  const scale = Math.max(size / bitmap.width, size / bitmap.height);
  const width = bitmap.width * scale;
  const height = bitmap.height * scale;
  context.drawImage(
    bitmap,
    point.x - width / 2,
    point.y - height / 2,
    width,
    height,
  );
  context.restore();
  context.strokeStyle = "#f1cf67";
  context.lineWidth = 3;
  context.beginPath();
  context.roundRect(
    point.x - size / 2 - 2,
    point.y - size / 2 - 2,
    size + 4,
    size + 4,
    11,
  );
  context.stroke();
}

function drawMapAttribution(context: CanvasRenderingContext2D, area: MapArea) {
  const label = "© OpenStreetMap contributors · Terrain: AWS";
  context.font = "10px system-ui, sans-serif";
  const width = context.measureText(label).width + 14;
  context.fillStyle = "#071014cc";
  context.fillRect(
    area.left + area.width - width - 8,
    area.top + area.height - 24,
    width,
    18,
  );
  context.fillStyle = "#d2dcde";
  context.fillText(
    label,
    area.left + area.width - width,
    area.top + area.height - 11,
  );
}

function markerForState(
  state: TimelineState,
  placements: readonly Placement[],
  routeStory?: RouteStory,
) {
  const destination = placements[state.checkpointPhotoIndex]?.coordinates;
  if (state.phase !== "approach" && state.phase !== "trail") return destination;
  const leg =
    state.phase === "trail"
      ? routeStory?.departureLegs[state.checkpointPhotoIndex]
      : routeStory?.legs[state.checkpointPhotoIndex];
  return leg
    ? recordedLegFrame(leg, state.currentLegProgress).tip
    : destination;
}

/** Keeps every photo in a checkpoint burst on the checkpoint's route camera. */
export function terrainCameraPhotoIndex(
  state: Pick<TimelineState, "checkpointPhotoIndex">,
) {
  return state.checkpointPhotoIndex;
}

function drawMarker(
  context: CanvasRenderingContext2D,
  point: Coordinates | undefined,
  bounds: Bounds | undefined,
  area: MapArea = SPLIT_MAP,
) {
  if (!point || !bounds) return;
  const { x, y } = projectVideoPoint(point, bounds, area);
  context.fillStyle = "#071014";
  context.beginPath();
  context.arc(x, y, 12, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#f1cf67";
  context.beginPath();
  context.arc(x, y, 7, 0, Math.PI * 2);
  context.fill();
}

function photoIndexForState(state: TimelineState, timeline: JourneyTimeline) {
  if (state.phase !== "approach" || state.dayChange) return state.photoIndex;
  const previous = timeline.stops[state.checkpointIndex - 1];
  return previous?.photoIndices.at(-1) ?? state.photoIndex;
}

function formatCapture(
  placement: Placement | undefined,
  photo: JourneyPhoto,
  timezone: string,
) {
  const moment = photoDisplayMoment(
    photo.metadata,
    placement?.instant,
    placement?.offsetMinutes,
    timezone,
  );
  if (!moment) return photo.metadata.capturedAtLabel ?? "Time unknown";
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: moment.timeZone,
  }).format(moment.instant);
}

function drawInfo(
  context: CanvasRenderingContext2D,
  photo: JourneyPhoto,
  placement: Placement | undefined,
  index: number,
  total: number,
  timezone: string,
) {
  context.fillStyle = "#0b1114";
  context.fillRect(0, VIDEO_HEIGHT - INFO_HEIGHT, PHOTO_WIDTH, INFO_HEIGHT);
  context.fillStyle = "#f4f7f7";
  context.font = "600 24px system-ui, sans-serif";
  context.fillText(photo.name, 28, VIDEO_HEIGHT - 29, PHOTO_WIDTH - 150);
  context.fillStyle = "#9aabb0";
  context.font = "16px system-ui, sans-serif";
  const match =
    placement?.source === "track"
      ? placement.recordingGap
        ? "Recording gap · last GPX position"
        : "Matched to recording"
      : placement?.source === "photo"
        ? "Photo location"
        : placement?.source === "carried"
          ? "Nearby photo location · estimated"
          : "Location unknown";
  context.fillText(
    `${formatCapture(placement, photo, timezone)} · ${match}`,
    28,
    VIDEO_HEIGHT - 9,
  );
  context.fillStyle = "#071014d9";
  context.beginPath();
  context.roundRect(18, 18, 92, 36, 18);
  context.fill();
  context.fillStyle = "#f4f7f7";
  context.font = "600 17px ui-monospace, monospace";
  context.fillText(
    `${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`,
    31,
    42,
  );
}

function drawCard(
  context: CanvasRenderingContext2D,
  title: string,
  subtitle: string,
  values?: readonly (readonly [string, string])[],
  clear = true,
) {
  if (clear) {
    context.fillStyle = "#071014";
    context.fillRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
  } else {
    context.fillStyle = "#071014a8";
    context.fillRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
  }
  context.fillStyle = "#f1cf67";
  context.font = "600 18px system-ui, sans-serif";
  context.fillText("PHOTO JOURNEY", 96, 270);
  context.fillStyle = "#f4f7f7";
  context.font = "700 54px system-ui, sans-serif";
  context.fillText(title, 96, 348, VIDEO_WIDTH - 192);
  context.fillStyle = "#9aabb0";
  context.font = "22px system-ui, sans-serif";
  context.fillText(subtitle, 96, 395, VIDEO_WIDTH - 192);
  values?.forEach(([label, value], index) => {
    const left = 96 + index * 210;
    context.fillStyle = "#071014c7";
    context.beginPath();
    context.roundRect(left, 435, 188, 92, 14);
    context.fill();
    context.fillStyle = "#9aabb0";
    context.font = "12px system-ui, sans-serif";
    context.fillText(label.toUpperCase(), left + 16, 462);
    context.fillStyle = "#f4f7f7";
    context.font = "600 24px system-ui, sans-serif";
    context.fillText(value, left + 16, 497, 155);
  });
}

async function bitmapFor(
  photo: JourneyPhoto,
  cache: Map<string, ImageBitmap>,
  signal?: AbortSignal,
) {
  const cached = cache.get(photo.id);
  if (cached) return cached;
  try {
    const response = await fetch(photo.url, { signal });
    if (!response.ok) throw new Error();
    const bitmap = await createImageBitmap(await response.blob(), {
      imageOrientation: "from-image",
    });
    checkAbort(signal);
    cache.set(photo.id, bitmap);
    return bitmap;
  } catch (error) {
    if ((error as DOMException)?.name === "AbortError") throw error;
    throw new PhotoExportError(`Could not read ${photo.name} for MP4 export.`);
  }
}

function trimBitmapCache(cache: Map<string, ImageBitmap>, keepId: string) {
  for (const [id, bitmap] of cache) {
    if (id === keepId || cache.size <= 3) continue;
    bitmap.close();
    cache.delete(id);
  }
}

function composedMapArea(progress: number): MapArea {
  const left = MAP_LEFT * progress;
  return {
    left,
    top: 0,
    width: VIDEO_WIDTH - left,
    height: VIDEO_HEIGHT,
  };
}

function drawRouteLabel(context: CanvasRenderingContext2D, area: MapArea) {
  context.fillStyle = "#f1cf67";
  context.font = "600 15px system-ui, sans-serif";
  context.fillText("GPX ROUTE", area.left + 28, 36);
}

const trailClockFormatters = new Map<string, Intl.DateTimeFormat>();

function formatTrailClock(
  time: number | undefined,
  offsetMinutes: number | undefined,
  timezone: string,
) {
  if (time === undefined) return "—";
  const moment = localDisplayMoment(time, offsetMinutes, timezone);
  let formatter = trailClockFormatters.get(moment.timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: moment.timeZone,
    });
    trailClockFormatters.set(moment.timeZone, formatter);
  }
  return formatter.format(moment.instant);
}

function formatTrailElapsed(totalSeconds: number | undefined) {
  if (totalSeconds === undefined) return "—";
  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function trailPace(stats: RecordedProgressStats) {
  if (stats.distanceKm < 0.05 || stats.movingSeconds < 30) return "—";
  const seconds = Math.round(stats.movingSeconds / stats.distanceKm);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} /km`;
}

function traceElevationProfile(
  context: CanvasRenderingContext2D,
  profile: RecordedElevationProfile,
  left: number,
  top: number,
  width: number,
  height: number,
) {
  const distanceScale = Math.max(profile.totalDistanceKm, Number.EPSILON);
  const elevationScale = Math.max(
    profile.maxElevationM - profile.minElevationM,
    Number.EPSILON,
  );
  const points = profile.points.map((point) => ({
    x: left + (point.distanceKm / distanceScale) * width,
    y:
      top +
      height -
      ((point.elevationM - profile.minElevationM) / elevationScale) * height,
  }));
  context.beginPath();
  points.forEach((point, index) =>
    index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y),
  );
  return points;
}

function drawElevationProfile(
  context: CanvasRenderingContext2D,
  profile: RecordedElevationProfile,
  left: number,
  top: number,
  width: number,
  height: number,
) {
  const progress =
    profile.totalDistanceKm > 0
      ? profile.currentDistanceKm / profile.totalDistanceKm
      : 0;
  const points = traceElevationProfile(
    context,
    profile,
    left,
    top,
    width,
    height,
  );
  context.lineTo(left + width, top + height);
  context.lineTo(left, top + height);
  context.closePath();
  context.fillStyle = "#90a1a51f";
  context.fill();
  traceElevationProfile(context, profile, left, top, width, height);
  context.strokeStyle = "#718187";
  context.lineWidth = 1.25;
  context.stroke();
  context.save();
  context.beginPath();
  context.rect(left, top - 2, width * progress, height + 4);
  context.clip();
  traceElevationProfile(context, profile, left, top, width, height);
  context.strokeStyle = "#38bdf8";
  context.lineWidth = 2;
  context.stroke();
  context.restore();
  const markerX = left + width * progress;
  const marker = points.reduce((closest, point) =>
    Math.abs(point.x - markerX) < Math.abs(closest.x - markerX)
      ? point
      : closest,
  );
  context.beginPath();
  context.arc(markerX, marker.y, 4, 0, Math.PI * 2);
  context.fillStyle = "#f1cf67";
  context.fill();
  context.strokeStyle = "#071014";
  context.lineWidth = 2;
  context.stroke();
}

function drawTrailProgress(
  context: CanvasRenderingContext2D,
  stats: RecordedProgressStats,
  localTime: string,
  profile: RecordedElevationProfile | undefined,
  compact = false,
) {
  const items = compact
    ? ([
        [
          "ELEVATION",
          stats.elevationM === undefined
            ? "—"
            : `${Math.round(stats.elevationM)} m`,
        ],
        ["ELEVATION GAIN", `${Math.round(stats.ascentM)} m`],
        [
          "DISTANCE",
          `${stats.distanceKm.toFixed(stats.distanceKm < 10 ? 2 : 1)} km`,
        ],
        ["TIME SINCE START", formatTrailElapsed(stats.elapsedSeconds)],
      ] as const)
    : ([
        [
          "ELEVATION",
          stats.elevationM === undefined
            ? "—"
            : `${Math.round(stats.elevationM)} m`,
        ],
        ["LOCAL TIME", localTime],
        ["TIME SINCE START", formatTrailElapsed(stats.elapsedSeconds)],
        [
          "DISTANCE",
          `${stats.distanceKm.toFixed(stats.distanceKm < 10 ? 2 : 1)} km`,
        ],
        ["ELEVATION GAIN", `${Math.round(stats.ascentM)} m`],
        ["AVG. PACE", trailPace(stats)],
      ] as const);
  const left = compact ? 20 : 28;
  const width = compact ? 340 : 430;
  const height = compact ? 122 : 176;
  const top = compact
    ? VIDEO_HEIGHT - INFO_HEIGHT - height - 18
    : VIDEO_HEIGHT - height - 28;
  context.fillStyle = "#05090bd9";
  context.beginPath();
  context.roundRect(left, top, width, height, 14);
  context.fill();
  context.strokeStyle = "#31454d";
  context.lineWidth = 1;
  context.stroke();
  const profileHeight = compact ? 47 : 70;
  if (profile)
    drawElevationProfile(
      context,
      profile,
      left + 14,
      top + 12,
      width - 28,
      profileHeight,
    );
  const columns = compact ? 4 : 3;
  const itemWidth = (width - 28) / columns;
  const valuesTop = top + (profile ? profileHeight + 25 : 16);
  for (const [index, [label, value]] of items.entries()) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = left + 14 + column * itemWidth;
    const y = valuesTop + row * 46;
    context.fillStyle = "#9aabb0";
    context.font = "10px system-ui, sans-serif";
    context.fillText(label, x, y, itemWidth - 8);
    context.fillStyle = index === 0 ? "#f1cf67" : "#f4f7f7";
    context.font = "600 16px system-ui, sans-serif";
    context.fillText(value, x, y + 21, itemWidth - 8);
  }
}

function drawPhotoProgress(
  context: CanvasRenderingContext2D,
  routeStory: RouteStory | undefined,
  placement: Placement | undefined,
  photoIndex: number,
  timezone: string,
  panelProgress: number,
) {
  const stats = recordedPhotoProgressStats(routeStory, photoIndex);
  if (!stats) return;
  const profile = recordedElevationProfile(
    routeStory,
    photoIndex,
    stats.distanceKm,
  );
  context.save();
  context.globalAlpha *= Math.min(1, panelProgress * 1.8);
  context.translate((panelProgress - 1) * PHOTO_WIDTH, 0);
  context.beginPath();
  context.rect(0, 0, PHOTO_WIDTH, VIDEO_HEIGHT);
  context.clip();
  drawTrailProgress(
    context,
    stats,
    formatTrailClock(stats.time, placement?.offsetMinutes, timezone),
    profile,
    true,
  );
  context.restore();
}

function drawPhotoPanel(
  context: CanvasRenderingContext2D,
  bitmap: ImageBitmap,
  photo: JourneyPhoto,
  placement: Placement | undefined,
  photoIndex: number,
  total: number,
  timezone: string,
  progress: number,
) {
  context.save();
  context.globalAlpha *= Math.min(1, progress * 1.8);
  context.translate((progress - 1) * PHOTO_WIDTH, 0);
  context.beginPath();
  context.rect(0, 0, PHOTO_WIDTH, VIDEO_HEIGHT);
  context.clip();
  context.fillStyle = photo.dominantColor ?? "#05090b";
  context.fillRect(0, 0, PHOTO_WIDTH, VIDEO_HEIGHT - INFO_HEIGHT);
  context.save();
  context.globalAlpha = 0.22;
  context.filter = "saturate(0.72) brightness(0.48)";
  drawCoveredImage(context, bitmap, PHOTO_WIDTH, VIDEO_HEIGHT - INFO_HEIGHT);
  context.restore();
  drawContainedImage(context, bitmap, PHOTO_WIDTH, VIDEO_HEIGHT - INFO_HEIGHT);
  drawInfo(context, photo, placement, photoIndex, total, timezone);
  context.restore();
}

async function supportedOutput(
  format: Mp4OutputFormat,
  quality: Quality,
  resolution: (typeof VIDEO_OUTPUT_RESOLUTIONS)[number],
) {
  if (!format.getSupportedVideoCodecs().includes("avc")) return undefined;
  const codec = await getFirstEncodableVideoCodec(["avc"], {
    width: resolution.width,
    height: resolution.height,
    quality,
  });
  return codec ? { codec, resolution } : undefined;
}

async function renderAtResolution(
  options: JourneyVideoOptions,
  resolution: (typeof VIDEO_OUTPUT_RESOLUTIONS)[number],
) {
  checkAbort(options.signal);
  const format = new Mp4OutputFormat({ fastStart: "in-memory" });
  const quality = new Quality("high");
  const supported = await supportedOutput(format, quality, resolution);
  if (!supported)
    throw new Error(
      `This browser cannot encode ${resolution.label} H.264 video.`,
    );
  checkAbort(options.signal);
  const canvas = document.createElement("canvas");
  canvas.width = supported.resolution.width;
  canvas.height = supported.resolution.height;
  const context = canvasContext(canvas);
  const renderScale = supported.resolution.width / VIDEO_WIDTH;
  context.scale(renderScale, supported.resolution.height / VIDEO_HEIGHT);
  const target = new BufferTarget();
  const output = new Output({ format, target });
  const source = new CanvasSource(canvas, {
    codec: supported.codec,
    quality,
    keyFrameInterval: 2,
  });
  output.addVideoTrack(source, { frameRate: VIDEO_FRAME_RATE });
  output.setMetadataTags({ title: options.title });
  const allSegments = options.track ? trackSegments(options.track) : [];
  const fallbackBounds = videoBounds(options.track, options.placements);
  const mapMode = options.mapMode ?? "terrain";
  const mapCache = new Map<string, PreparedMap>();
  let terrainRenderer: VideoTerrainRenderer | undefined;
  const bitmaps = new Map<string, ImageBitmap>();
  const totalSeconds = options.timeline.totalDuration / 1000;
  const stats = options.track ? trackStats(options.track) : undefined;
  const locatedCount = options.placements.filter(
    (placement) => placement.coordinates,
  ).length;
  const dayCount = new Set(
    options.placements.flatMap((placement) =>
      placement.instant === undefined
        ? []
        : [
            new Intl.DateTimeFormat("en-CA", {
              timeZone: options.timezone,
            }).format(placement.instant),
          ],
    ),
  ).size;
  const frameDuration = 1 / VIDEO_FRAME_RATE;
  const frameCount = Math.max(1, Math.ceil(totalSeconds * VIDEO_FRAME_RATE));
  let started = false;
  let reported = -1;
  try {
    await output.start();
    started = true;
    if (mapMode === "terrain") {
      try {
        terrainRenderer = await VideoTerrainRenderer.create(
          supported.resolution.width,
          supported.resolution.height,
          options.signal,
        );
      } catch (error) {
        if (isAbort(error)) throw error;
        throw new Error(
          `The 3D terrain renderer could not start. ${error instanceof Error ? error.message : "Retry the export in a browser with WebGL enabled."}`,
        );
      }
    }
    for (let frame = 0; frame < frameCount; frame += 1) {
      checkAbort(options.signal);
      const seconds = Math.min(totalSeconds, frame * frameDuration);
      const state = timelineAt(seconds * 1000, options.timeline);
      if (state.phase === "intro") {
        const segments = allSegments.length
          ? allSegments
          : (recordedContextForPhoto(options.routeStory, 0) ?? []);
        const bounds = boundsForSegments(segments) ?? fallbackBounds;
        if (terrainRenderer && bounds) {
          const terrain = await terrainRenderer.render(
            {
              renderKey: "intro",
              contextKey: "intro",
              completedKey: "intro",
              currentKey: "intro",
              segments,
              completed: [],
              cameraPoints: segments.length
                ? segments.flat()
                : cameraPointsForBounds(bounds),
              maxZoom: STOP_ZOOM,
            },
            options.signal,
          );
          context.drawImage(terrain.canvas, 0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
          drawMapAttribution(context, FULL_MAP);
        }
        const cacheKey = `intro:${mapMode}`;
        let prepared = mapCache.get(cacheKey);
        if (!terrainRenderer && !prepared && bounds) {
          prepared = await prepareMapBackdrop(
            segments,
            bounds,
            {
              ...FULL_MAP,
              width: FULL_MAP.width * renderScale,
              height: FULL_MAP.height * renderScale,
            },
            mapMode,
            options.signal,
          );
          mapCache.set(cacheKey, prepared);
          trimPreparedMapCache(mapCache, cacheKey);
        }
        if (!terrainRenderer && prepared)
          drawPreparedMap(context, prepared, FULL_MAP);
        drawCard(
          context,
          options.title,
          "Your recorded journey",
          [
            ["Photos", String(options.photos.length)],
            ["Located", String(locatedCount)],
            ["Distance", stats ? `${stats.distanceKm.toFixed(1)} km` : "—"],
            ["Days", String(Math.max(1, dayCount))],
          ],
          !prepared && !terrainRenderer,
        );
      } else if (state.phase === "day") {
        drawCard(context, state.dayLabel ?? "Next day", options.title);
      } else if (state.phase === "outro" || state.phase === "complete") {
        drawCard(
          context,
          options.title,
          `${options.photos.length} photos · Journey complete`,
        );
      } else if (state.phase === "approach" || state.phase === "trail") {
        const legProgress = journeyMotion(state, false).leg;
        const departure = state.phase === "trail";
        const segments =
          recordedContextForPhoto(
            options.routeStory,
            state.checkpointPhotoIndex,
          ) ?? allSegments;
        const bounds = departure
          ? (boundsForSegments(segments) ?? fallbackBounds)
          : boundsAround(
              options.placements[state.checkpointPhotoIndex]?.coordinates,
              boundsForSegments(segments) ?? fallbackBounds,
            );
        const marker = markerForState(
          { ...state, currentLegProgress: legProgress },
          options.placements,
          options.routeStory,
        );
        const trailStats = departure
          ? recordedDepartureProgressStats(
              options.routeStory,
              state.checkpointPhotoIndex,
              legProgress,
            )
          : recordedProgressStats(
              options.routeStory,
              state.checkpointPhotoIndex,
              legProgress,
            );
        if (!bounds) {
          context.fillStyle = "#132027";
          context.fillRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
        }
        const groupKey = options.routeStory?.context.indexOf(segments[0]) ?? -1;
        const cacheKey = `${groupKey}:${state.checkpointPhotoIndex}:${departure ? "trail" : "approach"}:${mapMode}`;
        let prepared = mapCache.get(cacheKey);
        if (terrainRenderer && bounds) {
          const activeLeg = departure
            ? options.routeStory?.departureLegs[state.checkpointPhotoIndex]
            : options.routeStory?.legs[state.checkpointPhotoIndex];
          const cameraFrame = activeLeg
            ? recordedLegFrame(activeLeg, legProgress)
            : undefined;
          const previousLeg = options.routeStory
            ? departure
              ? options.routeStory.legs[state.checkpointPhotoIndex]
              : previousRecordedLeg(
                  options.routeStory.legs,
                  state.checkpointPhotoIndex,
                  activeLeg,
                )
            : undefined;
          const previousCamera = previousLeg
            ? recordedLegFrame(previousLeg, 1)
            : undefined;
          const blendFraction = routeCameraBlendFraction(
            state.phase,
            state.approachDuration,
            state.phaseDuration,
          );
          const current = cameraFrame?.revealed ?? [];
          const terrain = await terrainRenderer.render(
            {
              renderKey: `approach:${state.checkpointPhotoIndex}:${frame}`,
              contextKey: `context:${groupKey}`,
              completedKey: `completed:${state.checkpointPhotoIndex}`,
              currentKey: `current:${state.checkpointPhotoIndex}:${frame}`,
              segments,
              completed: [
                ...completedTerrainSegments(
                  options.routeStory,
                  state.checkpointPhotoIndex,
                ),
                ...(departure &&
                options.routeStory?.legs[state.checkpointPhotoIndex]
                  ? [
                      options.routeStory.legs[state.checkpointPhotoIndex]!
                        .drawable,
                    ]
                  : []),
              ],
              current,
              marker,
              cameraPoints: cameraFrame?.window.length
                ? cameraFrame.window
                : cameraPointsForBounds(bounds),
              bearingPoints: activeLeg?.drawable,
              previousCameraPoints: state.dayChange
                ? undefined
                : previousCamera?.window,
              previousBearingPoints: previousLeg?.drawable,
              cameraBlend: Math.min(1, legProgress / blendFraction),
              edgePadding: {
                top: 0,
                right: 0,
                bottom: trailStats ? TRAIL_PROGRESS_CAMERA_PADDING : 0,
                left: 0,
              },
            },
            options.signal,
          );
          context.drawImage(terrain.canvas, 0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
          drawMapAttribution(context, FULL_MAP);
        }
        if (!terrainRenderer && !prepared && bounds) {
          try {
            prepared = await prepareMapBackdrop(
              segments,
              bounds,
              {
                ...FULL_MAP,
                width: FULL_MAP.width * renderScale,
                height: FULL_MAP.height * renderScale,
              },
              mapMode,
              options.signal,
            );
            mapCache.set(cacheKey, prepared);
            trimPreparedMapCache(mapCache, cacheKey);
          } catch (error) {
            if ((error as DOMException)?.name === "AbortError") throw error;
          }
        }
        if (!terrainRenderer && prepared) {
          drawPreparedMap(context, prepared, FULL_MAP);
          drawTravelledRoute(
            context,
            prepared,
            FULL_MAP,
            options.routeStory,
            state.checkpointPhotoIndex,
            legProgress,
            departure,
          );
          drawPreparedMarker(context, prepared, FULL_MAP, marker);
        } else if (!terrainRenderer) {
          drawRoute(context, segments, bounds, FULL_MAP);
          drawMarker(context, marker, bounds, FULL_MAP);
        }
        drawRouteLabel(context, FULL_MAP);
        if (trailStats) {
          drawTrailProgress(
            context,
            trailStats,
            formatTrailClock(
              trailStats.time,
              options.placements[state.checkpointPhotoIndex]?.offsetMinutes,
              options.timezone,
            ),
            recordedElevationProfile(
              options.routeStory,
              state.checkpointPhotoIndex,
              trailStats.distanceKm,
            ),
          );
        }
      } else {
        const photoIndex = photoIndexForState(state, options.timeline);
        const photo = options.photos[photoIndex] ?? options.photos[0];
        const bitmap = await bitmapFor(photo, bitmaps, options.signal);
        const panelProgress = journeyMotion(state, false).panel;
        const stop = options.timeline.stops[state.checkpointIndex];
        const photoOffset = stop?.photoIndices.indexOf(photoIndex) ?? 0;
        const photoProgress = burstPhotoProgress(state, photoOffset, false);
        const mapArea = composedMapArea(panelProgress);
        context.fillStyle = "#132027";
        context.fillRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
        const segments =
          recordedContextForPhoto(options.routeStory, photoIndex) ??
          allSegments;
        const marker = markerForState(
          state,
          options.placements,
          options.routeStory,
        );
        const bounds = boundsAround(
          marker,
          boundsForSegments(segments) ?? fallbackBounds,
        );
        const groupKey = options.routeStory?.context.indexOf(segments[0]) ?? -1;
        const cacheKey = `${groupKey}:${photoIndex}:split:${mapMode}`;
        let prepared = mapCache.get(cacheKey);
        if (terrainRenderer && bounds) {
          const cameraPhotoIndex = terrainCameraPhotoIndex(state);
          const activeLeg = options.routeStory?.legs[cameraPhotoIndex];
          const cameraFrame = activeLeg
            ? recordedLegFrame(activeLeg, 1)
            : undefined;
          const terrain = await terrainRenderer.render(
            {
              renderKey: `photo:${photoIndex}:${panelProgress.toFixed(3)}`,
              contextKey: `context:${groupKey}`,
              completedKey: `completed:${photoIndex + 1}`,
              currentKey: `settled:${photoIndex}`,
              segments,
              completed: travelledSegments(options.routeStory, photoIndex),
              marker,
              cameraPoints: cameraFrame?.window.length
                ? cameraFrame.window
                : cameraPointsForBounds(bounds),
              bearingPoints: activeLeg?.drawable,
              edgePadding: {
                top: 0,
                right: 0,
                bottom: 0,
                left: mapArea.left,
              },
            },
            options.signal,
          );
          context.drawImage(terrain.canvas, 0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
          drawMapAttribution(context, mapArea);
          drawPhotoMapMarkerAt(context, terrain.marker, bitmap);
        }
        if (!terrainRenderer && !prepared && bounds) {
          try {
            prepared = await prepareMapBackdrop(
              segments,
              bounds,
              {
                ...SPLIT_MAP,
                width: SPLIT_MAP.width * renderScale,
                height: SPLIT_MAP.height * renderScale,
              },
              mapMode,
              options.signal,
            );
            mapCache.set(cacheKey, prepared);
            trimPreparedMapCache(mapCache, cacheKey);
          } catch (error) {
            if ((error as DOMException)?.name === "AbortError") throw error;
          }
        }
        if (!terrainRenderer && prepared) {
          drawPreparedMap(context, prepared, mapArea);
          drawTravelledRoute(
            context,
            prepared,
            mapArea,
            options.routeStory,
            photoIndex,
          );
          drawPhotoMapMarker(context, prepared, mapArea, marker, bitmap);
        } else if (!terrainRenderer) {
          drawRoute(context, segments, bounds, mapArea, FULL_MAP);
          drawMarker(context, marker, bounds, mapArea);
        }
        drawRouteLabel(context, mapArea);
        if (photoProgress < 1 && photoIndex > 0) {
          const previous = options.photos[photoIndex - 1];
          const previousBitmap = await bitmapFor(
            previous,
            bitmaps,
            options.signal,
          );
          drawPhotoPanel(
            context,
            previousBitmap,
            previous,
            options.placements[photoIndex - 1],
            photoIndex - 1,
            options.photos.length,
            options.timezone,
            panelProgress,
          );
          drawPhotoProgress(
            context,
            options.routeStory,
            options.placements[photoIndex - 1],
            photoIndex - 1,
            options.timezone,
            panelProgress,
          );
        }
        context.save();
        context.globalAlpha = photoProgress;
        drawPhotoPanel(
          context,
          bitmap,
          photo,
          options.placements[photoIndex],
          photoIndex,
          options.photos.length,
          options.timezone,
          panelProgress,
        );
        drawPhotoProgress(
          context,
          options.routeStory,
          options.placements[photoIndex],
          photoIndex,
          options.timezone,
          panelProgress,
        );
        context.restore();
        trimBitmapCache(bitmaps, photo.id);
      }
      await source.add(seconds, frameDuration, {
        keyFrame: frame % (VIDEO_FRAME_RATE * 2) === 0,
      });
      const progress = Math.min(
        99,
        Math.round(((frame + 1) / frameCount) * 99),
      );
      if (progress !== reported) {
        reported = progress;
        options.onProgress?.(progress);
      }
    }
    checkAbort(options.signal);
    await output.finalize();
    if (!target.buffer) throw new Error("The MP4 encoder produced no output.");
    options.onProgress?.(100);
    return new Blob([target.buffer], { type: "video/mp4" });
  } catch (error) {
    if (started && output.state !== "finalized" && output.state !== "canceled")
      await output.cancel();
    throw error;
  } finally {
    terrainRenderer?.destroy();
    for (const prepared of mapCache.values()) {
      prepared.canvas.width = 1;
      prepared.canvas.height = 1;
    }
    mapCache.clear();
    for (const bitmap of bitmaps.values()) bitmap.close();
    canvas.width = 1;
    canvas.height = 1;
  }
}

export async function renderJourneyMp4(options: JourneyVideoOptions) {
  if (!options.photos.length)
    throw new Error("Add at least one photo before exporting MP4.");
  const attempts = videoResolutionAttempts(options.resolution);
  let failure: unknown;
  for (const resolution of attempts) {
    try {
      options.onProgress?.(0);
      return await renderAtResolution(options, resolution);
    } catch (error) {
      if (
        (error as DOMException)?.name === "AbortError" ||
        error instanceof PhotoExportError
      )
        throw error;
      failure = error;
    }
  }
  throw new Error(
    `This browser could not create a 1080p H.264 MP4. ${failure instanceof Error ? failure.message : "Use a current Chrome, Edge, or Safari release."}`,
  );
}

export function videoResolutionAttempts(
  requested: VideoResolutionLabel = "1080p",
) {
  const preferred =
    VIDEO_OUTPUT_RESOLUTIONS.find(
      (resolution) => resolution.label === requested,
    ) ?? VIDEO_OUTPUT_RESOLUTIONS[0];
  return preferred.label === "4K"
    ? [preferred, VIDEO_OUTPUT_RESOLUTIONS[0]]
    : [preferred];
}
