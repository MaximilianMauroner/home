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

export const MAX_FILES = 100;
export const MAX_TOTAL_BYTES = 500 * 1024 * 1024;

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

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatShutter(value: number) {
  if (value >= 1) return `${value.toFixed(value % 1 ? 1 : 0)} s`;
  return `1/${Math.round(1 / value)} s`;
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
  const capturedAt = date(
    data.DateTimeOriginal ?? data.CreateDate ?? data.DateTimeDigitized,
  );
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
  const offset = text(data.OffsetTimeOriginal ?? data.OffsetTime);

  return {
    capturedAt,
    capturedAtLabel: capturedAt
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
    if (metadata.coordinates) metadata.place = nearestPlace(metadata.coordinates);
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

export function sortPhotos(photos: JourneyPhoto[]) {
  return [...photos].sort((a, b) => {
    const aTime = a.metadata.capturedAt?.valueOf();
    const bTime = b.metadata.capturedAt?.valueOf();
    if (aTime !== undefined && bTime !== undefined && aTime !== bTime)
      return aTime - bTime;
    if (aTime !== undefined) return -1;
    if (bTime !== undefined) return 1;
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
