import exifr from "exifr";

import { nearestPlace } from "./places";
import { createPreview } from "./thumbnail";
import type { JourneyPhoto, PhotoMetadata } from "./types";

const SUPPORTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence"]);
export function isHeicFile(file: Pick<File, "name" | "type">) {
  return /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
}
export function supportsPhoto(file: Pick<File, "name" | "type">) {
  return SUPPORTED_TYPES.has(file.type) || (!file.type && /\.(jpe?g|png|webp|hei[cf])$/i.test(file.name));
}
const EXIF_OPTIONS = {
  gps: true,
  tiff: true,
  exif: true,
  iptc: true,
  xmp: true,
} as const;

type ExifData = Record<string, unknown>;

export const MAX_FILES = 2_000;
export const MAX_TOTAL_BYTES = 4 * 1024 * 1024 * 1024;

function text(value: unknown) {
  if (typeof value === "string") return value.trim().slice(0, 160) || undefined;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function number(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function date(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value;
  if (typeof value !== "string") return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? undefined : parsed;
}

function wallClock(value: unknown, offsetMinutes?: number) {
  if (typeof value === "string") {
    const match = /^(\d{4})[:\-](\d{2})[:\-](\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(?:[.,](\d+))?)?/.exec(value.trim());
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      const hour = Number(match[4]);
      const minute = Number(match[5]);
      const second = Number(match[6] ?? "00");
      const check = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
      if (
        check.getUTCFullYear() === year &&
        check.getUTCMonth() === month - 1 &&
        check.getUTCDate() === day &&
        check.getUTCHours() === hour &&
        check.getUTCMinutes() === minute &&
        check.getUTCSeconds() === second
      ) {
        return `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6] ?? "00"}${match[7] ? `.${match[7].slice(0, 3).padEnd(3, "0")}` : ""}`;
      }
    }
  }
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    // exifr applies OffsetTimeOriginal to Date values. Shift the instant back to the literal
    // camera fields before storing the wall clock used for GPX matching and display.
    const cameraTime = isValidUtcOffsetMinutes(offsetMinutes)
      ? new Date(value.getTime() + offsetMinutes * 60_000)
      : value;
    const pad = (part: number, size = 2) => String(part).padStart(size, "0");
    return `${cameraTime.getUTCFullYear()}-${pad(cameraTime.getUTCMonth() + 1)}-${pad(cameraTime.getUTCDate())}T${pad(cameraTime.getUTCHours())}:${pad(cameraTime.getUTCMinutes())}:${pad(cameraTime.getUTCSeconds())}.${pad(cameraTime.getUTCMilliseconds(), 3)}`;
  }
  return undefined;
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatShutter(value: number) {
  if (value >= 1) return `${value.toFixed(value % 1 ? 1 : 0)} s`;
  return `1/${Math.round(1 / value)} s`;
}

/** Offsets are expressed in minutes east of UTC. */
export function isValidUtcOffsetMinutes(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= -720 && value <= 840;
}

/** Parses the numeric value used by the explicit offset controls. */
export function parseOffsetMinutes(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return isValidUtcOffsetMinutes(parsed) ? parsed : undefined;
}

/** "+02:00" becomes 120. Without this tag the capture clock cannot be compared with a GPX time. */
export function parseUtcOffset(value?: string) {
  const match = /^([+-])(\d{2}):?(\d{2})$/.exec(value?.trim() ?? "");
  if (!match) return undefined;
  const hours = Number(match[2]);
  const remainder = Number(match[3]);
  if (remainder > 59) return undefined;
  const minutes = hours * 60 + remainder;
  const signed = match[1] === "-" ? -minutes : minutes;
  return isValidUtcOffsetMinutes(signed) ? signed : undefined;
}

function validCoordinates(latitude?: number, longitude?: number) {
  if (latitude === undefined || longitude === undefined) return undefined;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return undefined;
  }
  return { latitude, longitude };
}

function visibleDetails(data: ExifData) {
  const ignored = new Set([
    "latitude",
    "longitude",
    "thumbnail",
    "ThumbnailImage",
    "MakerNote",
    "ImageDescription",
    "UserComment",
    "XPComment",
  ]);
  return Object.entries(data)
    .filter(
      ([key, value]) =>
        !ignored.has(key) &&
        ["string", "number", "boolean"].includes(typeof value),
    )
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, value]) => ({ label, value: String(value).slice(0, 160) }));
}

export function normalizeMetadata(
  file: Pick<File, "name" | "size" | "type" | "lastModified">,
  data: ExifData,
  width: number,
  height: number,
): PhotoMetadata {
  const captureValue = data.DateTimeOriginal ?? data.CreateDate ?? data.DateTimeDigitized;
  const offset = text(data.OffsetTimeOriginal ?? data.OffsetTime);
  const utcOffsetMinutes = parseUtcOffset(offset);
  const capturedAt = date(captureValue);
  const capturedAtWallClock = wallClock(captureValue, utcOffsetMinutes);
  const latitude = number(data.latitude ?? data.GPSLatitude);
  const longitude = number(data.longitude ?? data.GPSLongitude);
  const exposure = number(data.ExposureTime);
  const aperture = number(data.FNumber ?? data.ApertureValue);
  const focalLength = number(data.FocalLength);
  const iso = number(data.ISO ?? data.ISOSpeedRatings);
  const make = text(data.Make);
  const model = text(data.Model);
  const camera =
    [make, model && model !== make ? model : undefined]
      .filter(Boolean)
      .join(" ") || undefined;
  return {
    capturedAt,
    capturedAtWallClock,
    utcOffsetMinutes,
    capturedAtLabel: capturedAtWallClock
      ? `${capturedAtWallClock.replace("T", " ").replace(/\.\d{3}$/, "")}${offset ? ` ${offset}` : ""}`
      : capturedAt
        ? `${new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(capturedAt)}${offset ? ` ${offset}` : ""}`
        : undefined,
    modifiedAtLabel: new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(file.lastModified)),
    coordinates: validCoordinates(latitude, longitude),
    altitude: number(data.GPSAltitude) === undefined ? undefined : number(data.GPSAltitude)! * (data.GPSAltitudeRef === 1 || data.GPSAltitudeRef === "Below sea level" ? -1 : 1),
    camera,
    lens: text(data.LensModel ?? data.Lens),
    focalLength: focalLength ? `${focalLength} mm` : undefined,
    aperture: aperture ? `f/${aperture}` : undefined,
    shutterSpeed: exposure ? formatShutter(exposure) : undefined,
    iso: iso ? `ISO ${iso}` : undefined,
    dimensions: `${width} × ${height}`,
    fileSize: formatBytes(file.size),
    fileType: (file.type.replace("image/", "") || file.name.split(".").pop() || "Image").toUpperCase(),
    details: visibleDetails(data),
  };
}

export async function readPhoto(
  file: File,
  importOrder: number,
): Promise<JourneyPhoto> {
  if (!supportsPhoto(file)) throw new Error("Use a JPEG, PNG, WebP, HEIC, or HEIF image.");
  const display = isHeicFile(file) ? await (await import("./heic")).decodeHeic(file) : file;
  const url = URL.createObjectURL(display);
  let preview: Awaited<ReturnType<typeof createPreview>> | undefined;
  try {
    const [created, data] = await Promise.all([
      createPreview(display),
      extractMetadata(file),
    ]);
    preview = created;
    const metadata = normalizeMetadata(file, data, created.width, created.height);
    if (metadata.coordinates) metadata.place = await nearestPlace(metadata.coordinates);
    return {
      id: `${importOrder}-${file.name}-${file.lastModified}`,
      file,
      url,
      thumbnailUrl: created.url,
      name: file.name.replace(/\.[^.]+$/, ""),
      dominantColor: created.dominantColor,
      metadata,
      importOrder,
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    if (preview) URL.revokeObjectURL(preview.url);
    throw error;
  }
}

/** A journey photo needs either a camera clock for track matching or its own GPS fix. */
export function hasJourneyExif(metadata: Pick<PhotoMetadata, "capturedAtWallClock" | "coordinates">) {
  return Boolean(metadata.capturedAtWallClock || metadata.coordinates);
}

export function revokePhoto(photo: JourneyPhoto) {
  URL.revokeObjectURL(photo.url);
  URL.revokeObjectURL(photo.thumbnailUrl);
}

export async function extractMetadata(input: Blob | ArrayBuffer | Uint8Array) {
  const [parsed, gps] = await Promise.allSettled([
    exifr.parse(input, EXIF_OPTIONS),
    exifr.gps(input),
  ]);
  const data =
    parsed.status === "fulfilled" && parsed.value
      ? (parsed.value as ExifData)
      : {};
  if (gps.status !== "fulfilled" || !gps.value) return data;
  return {
    ...data,
    latitude: gps.value.latitude,
    longitude: gps.value.longitude,
  };
}

function metadataSortTime(metadata: Pick<PhotoMetadata, "capturedAt" | "capturedAtWallClock">) {
  if (metadata.capturedAtWallClock) {
    const parsed = Date.parse(`${metadata.capturedAtWallClock}Z`);
    if (Number.isFinite(parsed)) return parsed;
  }
  const captured = metadata.capturedAt?.valueOf();
  return captured !== undefined && Number.isFinite(captured) ? captured : undefined;
}

export function sortPhotos(photos: JourneyPhoto[], resolvedInstants?: readonly (number | undefined)[]) {
  return [...photos].sort((a, b) => {
    const aTime = resolvedInstants?.[photos.indexOf(a)] ?? metadataSortTime(a.metadata);
    const bTime = resolvedInstants?.[photos.indexOf(b)] ?? metadataSortTime(b.metadata);
    if (aTime !== undefined && bTime !== undefined && aTime !== bTime)
      return aTime - bTime;
    if (aTime !== undefined && bTime === undefined) return -1;
    if (bTime !== undefined && aTime === undefined) return 1;
    return a.importOrder - b.importOrder;
  });
}

export function groupMetadata(details: PhotoMetadata['details']) {
  const names = ['Camera', 'Exposure', 'Location', 'Time', 'Software', 'Other'];
  const groups = names.map((name) => ({ name, details: [] as Array<{ label: string; rawLabel: string; value: string }> }));
  for (const detail of details) {
    const rawLabel = detail.label;
    const index = /^(Make|Model|Lens|Serial|Body|Camera)/i.test(rawLabel) ? 0
      : /(Exposure|Aperture|FNumber|Focal|ISO|Flash|Metering|WhiteBalance|Shutter)/i.test(rawLabel) ? 1
      : /^(GPS|latitude|longitude)/i.test(rawLabel) ? 2
      : /(Date|Time|Offset)/i.test(rawLabel) ? 3
      : /(Software|Processing|CreatorTool|Version)/i.test(rawLabel) ? 4 : 5;
    groups[index].details.push({ ...detail, rawLabel, label: rawLabel.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2') });
  }
  return groups.filter((group) => group.details.length).map((group) => ({ ...group, details: group.details.sort((a, b) => a.label.localeCompare(b.label)) }));
}
