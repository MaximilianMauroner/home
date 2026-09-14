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
  recordedLegFrame,
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
  const columns = 3;
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
  const stats = options.track ? trackStats(options.track) : undefined;
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
        const legProgress = journeyMotion(state, false).leg;
        drawRoute(context, segments, bounds, FULL_MAP);
        drawMarker(
          context,
          markerForState(
            { ...state, currentLegProgress: legProgress },
            options.placements,
            options.routeStory,
          ),
          bounds,
          FULL_MAP,
        );
        drawRouteLabel(context, FULL_MAP);
        const trailStats = recordedProgressStats(
          options.routeStory,
          state.checkpointPhotoIndex,
          legProgress,
        );
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
        // The surface remains full-frame. Only the route composition shifts toward the visible
        // map area while the photo overlays it, matching the stable live MapLibre canvas.
        drawRoute(context, segments, bounds, mapArea, FULL_MAP);
        drawMarker(
          context,
          markerForState(state, options.placements, options.routeStory),
          bounds,
          mapArea,
        );
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
