import {
  BufferTarget,
  CanvasSource,
  getFirstEncodableVideoCodec,
  Mp4OutputFormat,
  Output,
  Quality,
} from "mediabunny";
import { trackSegments, trackStats, type Track, type TrackPoint } from "./gpx";
import { smoothProgress } from "./motion";
import { recordedLegFrame, type RouteStory } from "./route-progress";
import {
  timelineAt,
  type JourneyTimeline,
  type TimelineState,
} from "./timeline";
import type { Placement } from "./track";
import type { Coordinates, JourneyPhoto } from "./types";

export const VIDEO_WIDTH = 1280;
export const VIDEO_HEIGHT = 720;
export const VIDEO_FRAME_RATE = 30;
export const VIDEO_OUTPUT_RESOLUTIONS = [
  { width: 3840, height: 2160, label: "4K" },
  { width: 1920, height: 1080, label: "1080p" },
] as const;
const PHOTO_WIDTH = 768;
const INFO_HEIGHT = 82;
const MAP_LEFT = PHOTO_WIDTH;

export type JourneyVideoOptions = {
  title: string;
  timezone: string;
  photos: readonly JourneyPhoto[];
  placements: readonly Placement[];
  timeline: JourneyTimeline;
  track?: Track;
  routeStory?: RouteStory;
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
  const longitudes = points.map((point) =>
    unwrapLongitude(point.longitude, reference),
  );
  const latitudes = points.map((point) => point.latitude);
  return {
    minLatitude: Math.min(...latitudes),
    maxLatitude: Math.max(...latitudes),
    minLongitude: Math.min(...longitudes),
    maxLongitude: Math.max(...longitudes),
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
) {
  context.fillStyle = "#0b1519";
  context.fillRect(area.left, area.top, area.width, area.height);
  context.strokeStyle = "#20343c";
  context.lineWidth = 1;
  for (let x = area.left + 52; x < area.left + area.width; x += 96) {
    context.beginPath();
    context.moveTo(x, area.top);
    context.lineTo(x, area.top + area.height);
    context.stroke();
  }
  for (let y = area.top + 70; y < area.top + area.height; y += 96) {
    context.beginPath();
    context.moveTo(area.left, y);
    context.lineTo(area.left + area.width, y);
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

function markerForState(
  state: TimelineState,
  placements: readonly Placement[],
  routeStory?: RouteStory,
) {
  const destination = placements[state.checkpointPhotoIndex]?.coordinates;
  if (state.phase !== "approach") return destination;
  const leg = routeStory?.legs[state.checkpointPhotoIndex];
  return leg
    ? recordedLegFrame(leg, state.currentLegProgress).tip
    : destination;
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
  if (placement?.instant === undefined)
    return photo.metadata.capturedAtLabel ?? "Time unknown";
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }).format(placement.instant);
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
  context.fillText(
    photo.metadata.place ?? photo.name,
    28,
    VIDEO_HEIGHT - 43,
    PHOTO_WIDTH - 150,
  );
  context.fillStyle = "#9aabb0";
  context.font = "16px system-ui, sans-serif";
  context.fillText(
    formatCapture(placement, photo, timezone),
    28,
    VIDEO_HEIGHT - 18,
  );
  context.textAlign = "right";
  context.fillStyle = "#f1cf67";
  context.font = "600 18px ui-monospace, monospace";
  context.fillText(
    `${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`,
    PHOTO_WIDTH - 28,
    VIDEO_HEIGHT - 28,
  );
  context.textAlign = "left";
}

function drawCard(
  context: CanvasRenderingContext2D,
  title: string,
  subtitle: string,
) {
  context.fillStyle = "#071014";
  context.fillRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
  context.fillStyle = "#f1cf67";
  context.font = "600 18px system-ui, sans-serif";
  context.fillText("PHOTO JOURNEY", 96, 270);
  context.fillStyle = "#f4f7f7";
  context.font = "700 54px system-ui, sans-serif";
  context.fillText(title, 96, 348, VIDEO_WIDTH - 192);
  context.fillStyle = "#9aabb0";
  context.font = "22px system-ui, sans-serif";
  context.fillText(subtitle, 96, 395, VIDEO_WIDTH - 192);
}

async function bitmapFor(photo: JourneyPhoto, cache: Map<string, ImageBitmap>) {
  const cached = cache.get(photo.id);
  if (cached) return cached;
  const response = await fetch(photo.url);
  if (!response.ok)
    throw new Error(`Could not read ${photo.name} for MP4 export.`);
  const bitmap = await createImageBitmap(await response.blob(), {
    imageOrientation: "from-image",
  });
  cache.set(photo.id, bitmap);
  return bitmap;
}

function trimBitmapCache(cache: Map<string, ImageBitmap>, keepId: string) {
  for (const [id, bitmap] of cache) {
    if (id === keepId || cache.size <= 3) continue;
    bitmap.close();
    cache.delete(id);
  }
}

function arrivalMapArea(progress: number): MapArea {
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
  const scale = 0.97 + progress * 0.03;
  context.save();
  context.globalAlpha = progress;
  context.translate((1 - progress) * -36, VIDEO_HEIGHT / 2);
  context.scale(scale, scale);
  context.translate(0, -VIDEO_HEIGHT / 2);
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

async function supportedOutput(format: Mp4OutputFormat, quality: Quality) {
  for (const resolution of VIDEO_OUTPUT_RESOLUTIONS) {
    const codec = await getFirstEncodableVideoCodec(
      format.getSupportedVideoCodecs(),
      {
        width: resolution.width,
        height: resolution.height,
        quality,
      },
    );
    if (codec) return { codec, resolution };
  }
  return undefined;
}

export async function renderJourneyMp4(options: JourneyVideoOptions) {
  if (!options.photos.length)
    throw new Error("Add at least one photo before exporting MP4.");
  checkAbort(options.signal);
  const format = new Mp4OutputFormat({ fastStart: "in-memory" });
  const quality = new Quality("high");
  const supported = await supportedOutput(format, quality);
  if (!supported)
    throw new Error(
      "This browser cannot encode a 1080p MP4 video. Use a current Chrome, Edge, or Safari release.",
    );
  checkAbort(options.signal);
  const canvas = document.createElement("canvas");
  canvas.width = supported.resolution.width;
  canvas.height = supported.resolution.height;
  const context = canvasContext(canvas);
  context.scale(
    supported.resolution.width / VIDEO_WIDTH,
    supported.resolution.height / VIDEO_HEIGHT,
  );
  const target = new BufferTarget();
  const output = new Output({ format, target });
  const source = new CanvasSource(canvas, {
    codec: supported.codec,
    quality,
    keyFrameInterval: 2,
  });
  output.addVideoTrack(source, { frameRate: VIDEO_FRAME_RATE });
  output.setMetadataTags({ title: options.title });
  const segments = options.track ? trackSegments(options.track) : [];
  const bounds = videoBounds(options.track, options.placements);
  const bitmaps = new Map<string, ImageBitmap>();
  const totalSeconds = options.timeline.totalDuration / 1000;
  const frameDuration = 1 / VIDEO_FRAME_RATE;
  const frameCount = Math.max(1, Math.ceil(totalSeconds * VIDEO_FRAME_RATE));
  let started = false;
  let reported = -1;
  try {
    await output.start();
    started = true;
    for (let frame = 0; frame < frameCount; frame += 1) {
      checkAbort(options.signal);
      const seconds = Math.min(totalSeconds, frame * frameDuration);
      const state = timelineAt(seconds * 1000, options.timeline);
      if (state.phase === "intro") {
        const stats = options.track ? trackStats(options.track) : undefined;
        drawCard(
          context,
          options.title,
          `${options.photos.length} photos${stats ? ` · ${stats.distanceKm.toFixed(1)} km recorded` : ""}`,
        );
      } else if (state.phase === "day") {
        drawCard(context, state.dayLabel ?? "Next day", options.title);
      } else if (state.phase === "outro" || state.phase === "complete") {
        drawCard(
          context,
          options.title,
          `${options.photos.length} photos · Journey complete`,
        );
      } else if (state.phase === "approach") {
        drawRoute(context, segments, bounds, FULL_MAP);
        drawMarker(
          context,
          markerForState(state, options.placements, options.routeStory),
          bounds,
          FULL_MAP,
        );
        drawRouteLabel(context, FULL_MAP);
      } else {
        const photoIndex = photoIndexForState(state, options.timeline);
        const photo = options.photos[photoIndex] ?? options.photos[0];
        const bitmap = await bitmapFor(photo, bitmaps);
        const arrivalProgress =
          state.phase === "reveal" ? smoothProgress(state.phaseProgress) : 1;
        const mapArea = arrivalMapArea(arrivalProgress);
        drawRoute(context, segments, bounds, mapArea);
        drawMarker(
          context,
          markerForState(state, options.placements, options.routeStory),
          bounds,
          mapArea,
        );
        drawRouteLabel(context, mapArea);
        drawPhotoPanel(
          context,
          bitmap,
          photo,
          options.placements[photoIndex],
          photoIndex,
          options.photos.length,
          options.timezone,
          arrivalProgress,
        );
        trimBitmapCache(bitmaps, photo.id);
      }
      await source.add(seconds, frameDuration, {
        keyFrame: frame % (VIDEO_FRAME_RATE * 2) === 0,
      });
      const progress = Math.round(((frame + 1) / frameCount) * 100);
      if (progress !== reported) {
        reported = progress;
        options.onProgress?.(progress);
      }
    }
    checkAbort(options.signal);
    await output.finalize();
    if (!target.buffer) throw new Error("The MP4 encoder produced no output.");
    return new Blob([target.buffer], { type: "video/mp4" });
  } catch (error) {
    if (started && output.state !== "finalized" && output.state !== "canceled")
      await output.cancel();
    throw error;
  } finally {
    for (const bitmap of bitmaps.values()) bitmap.close();
  }
}
