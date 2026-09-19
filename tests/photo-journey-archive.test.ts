import { JSDOM } from "jsdom";
import { describe, expect, test } from "vitest";
import JSZip from "jszip";

import {
  buildBundle,
  buildScopedBundle,
} from "../src/components/tools/PhotoJourney/journey-data";
import {
  expandJourneyArchives,
  isArchiveFile,
  type ArchiveProgress,
} from "../src/components/tools/PhotoJourney/ingestion";
import { parseGpx } from "../src/components/tools/PhotoJourney/gpx";
import { normalizeMetadata } from "../src/components/tools/PhotoJourney/metadata";
import { resolvePlacementsForRecordings } from "../src/components/tools/PhotoJourney/track";
import { createProjectManifest } from "../src/components/tools/PhotoJourney/project-file";
import type {
  JourneyPhoto,
  JourneyRecording,
} from "../src/components/tools/PhotoJourney/types";

globalThis.DOMParser = new JSDOM().window.DOMParser;

const gpx = (body: string) =>
  `<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">${body}</gpx>`;
const point = (lat: number, lon: number, time?: string) =>
  `<trkpt lat="${lat}" lon="${lon}">${time ? `<time>${time}</time>` : ""}</trkpt>`;

function photo(id: string, wallClock?: string): JourneyPhoto {
  const file = new File([`bytes-${id}`], `${id}.jpg`, {
    type: "image/jpeg",
    lastModified: 0,
  });
  return {
    id,
    name: id,
    file,
    url: `blob:${id}`,
    thumbnailUrl: `blob:${id}-thumb`,
    importOrder: Number(id.replace(/\D/g, "")) || 0,
    metadata: normalizeMetadata(
      file,
      wallClock ? { DateTimeOriginal: wallClock } : {},
      1,
      1,
    ),
  };
}

function recording(id: string, body: string): JourneyRecording {
  const file = new File([body], `${id}.gpx`, { type: "application/gpx+xml" });
  return {
    id,
    file,
    name: id,
    digest: id,
    track: parseGpx(gpx(body)),
    importOrder: 0,
    included: true,
    warnings: [],
  };
}

async function zipFile(
  files: Record<string, string | Uint8Array>,
): Promise<File> {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(files)) zip.file(name, content);
  const bytes = await zip.generateAsync({
    type: "uint8array",
    compression: "STORE",
  });
  return new File([bytes as BlobPart], "journey.zip", {
    type: "application/zip",
  });
}

describe("journey zip import", () => {
  test("reports opening and completed extraction with file and byte counts across ZIPs", async () => {
    const first = await zipFile({
      "a.jpg": "abc",
      "b.jpg": "defg",
      "readme.txt": "ignored",
    });
    const second = await zipFile({ "c.jpg": "hi" });
    const progress: ArchiveProgress[] = [];
    await expandJourneyArchives([first, second], (value) =>
      progress.push(value),
    );
    expect(progress[0]).toMatchObject({
      stage: "opening",
      archiveIndex: 1,
      archiveCount: 2,
    });
    expect(
      progress.find(
        (value) => value.archiveIndex === 1 && value.completed === 2,
      ),
    ).toMatchObject({ total: 2, extractedBytes: 7 });
    expect(progress.at(-1)).toMatchObject({
      stage: "extracting",
      archiveIndex: 2,
      completed: 1,
      total: 1,
      extractedBytes: 9,
    });
  });
  test("detects archives by name and type", () => {
    expect(isArchiveFile(new File([], "trip.zip"))).toBe(true);
    expect(
      isArchiveFile(new File([], "trip.ZIP", { type: "application/zip" })),
    ).toBe(true);
    expect(isArchiveFile(new File([], "track.gpx"))).toBe(false);
    expect(
      isArchiveFile(new File([], "photo.jpg", { type: "image/jpeg" })),
    ).toBe(false);
  });

  test("unpacks a plain zip of photos and GPX", async () => {
    const archive = await zipFile({
      "IMG_001.jpg": "photo-bytes",
      "track.gpx": gpx(
        `<trk><trkseg>${point(1, 2, "2026-08-20T10:00:00Z")}</trkseg></trk>`,
      ),
    });
    const { expanded, skipped } = await expandJourneyArchives([archive]);
    expect(skipped).toEqual([]);
    expect(expanded.files.map((file) => file.name).sort()).toEqual([
      "IMG_001.jpg",
      "track.gpx",
    ]);
    expect(
      expanded.files.find((file) => file.name.endsWith(".jpg"))?.type,
    ).toBe("image/jpeg");
  });

  test("inspects large journey archives instead of rejecting their container size", async () => {
    const archive = await zipFile({ "IMG_001.jpg": "photo-bytes" });
    Object.defineProperty(archive, "size", { value: 701 * 1024 * 1024 });

    const { expanded, skipped } = await expandJourneyArchives([archive]);

    expect(skipped).toEqual([]);
    expect(expanded.files.map((file) => file.name)).toEqual(["IMG_001.jpg"]);
  });

  test("does not count ignored generated bundle copies toward the file limit", async () => {
    const generated = Object.fromEntries(
      Array.from({ length: 501 }, (_, index) => [
        `days/${index}.gpx`,
        gpx(`<trk><trkseg>${point(1, 2)}</trkseg></trk>`),
      ]),
    );
    const archive = await zipFile({
      ...generated,
      "journey.gpx": gpx(`<trk><trkseg>${point(1, 2)}</trkseg></trk>`),
      "photos/01-IMG_001.jpg": "photo-bytes",
    });

    const { expanded, skipped } = await expandJourneyArchives([archive]);

    expect(skipped).toEqual([]);
    expect(expanded.files.map((file) => file.name).sort()).toEqual([
      "IMG_001.jpg",
      "journey.gpx",
    ]);
  });

  test("restores a simple bundle without duplicating the route", async () => {
    const photos = [photo("a", "2026:08:20 10:00:00")];
    const source = recording(
      "walk",
      `<trk><trkseg>${point(1, 2, "2026-08-20T10:00:00Z")}${point(1, 2.1, "2026-08-20T10:01:00Z")}</trkseg></trk>`,
    );
    const placements = resolvePlacementsForRecordings(photos, [source], {
      offsetMinutes: 0,
    });
    const bundle = await buildBundle(photos, {
      title: "Summer Trip",
      includePhotos: true,
      track: source.track,
      placements,
      timezone: "UTC",
    });
    const archive = new File([bundle], "summer.zip", {
      type: "application/zip",
    });
    const { expanded, skipped } = await expandJourneyArchives([archive]);
    expect(skipped).toEqual([]);
    expect(expanded.bundleTitle).toBe("Summer Trip");
    // Photos lose the `01-` bundle prefix; the single journey.gpx is the only track source.
    expect(expanded.files.map((file) => file.name).sort()).toEqual([
      "a.jpg",
      "journey.gpx",
    ]);
  });

  test("prefers original recordings over generated day and recording copies", async () => {
    const photos = [photo("1", "2026:08:20 10:00:00")];
    const source = recording(
      "walk",
      `<trk><name>Morning</name><trkseg>${point(1, 2, "2026-08-20T10:00:00Z")}${point(1, 2.1, "2026-08-20T10:01:00Z")}</trkseg></trk>`,
    );
    const placements = resolvePlacementsForRecordings(photos, [source], {
      offsetMinutes: 0,
    });
    const bundle = await buildScopedBundle({
      title: "Trip",
      timezone: "UTC",
      photos,
      placements,
      recordings: [source],
      includePhotos: true,
    });
    const archive = new File([bundle], "scopes.zip", {
      type: "application/zip",
    });
    const { expanded } = await expandJourneyArchives([archive]);
    const gpxFiles = expanded.files.filter((file) =>
      file.name.endsWith(".gpx"),
    );
    expect(gpxFiles).toHaveLength(1);
    expect(gpxFiles[0].name).toBe("walk.gpx");
    expect(expanded.files.map((file) => file.name)).toContain("1.jpg");
  });

  test("round-trips a restorable project manifest with original photos and recordings", async () => {
    const photos = [
      photo("1", "2026:08:20 10:00:00"),
      photo("2", "2026:08:20 10:00:10"),
    ];
    const source = recording(
      "walk",
      `<trk><trkseg>${point(1, 2, "2026-08-20T10:00:00Z")}${point(1, 2.1, "2026-08-20T10:01:00Z")}</trkseg></trk>`,
    );
    const excluded = {
      ...recording(
        "paused",
        `<trk><trkseg>${point(4, 5, "2026-08-21T10:00:00Z")}</trkseg></trk>`,
      ),
      included: false,
    };
    const placements = resolvePlacementsForRecordings(photos, [source], {
      offsetMinutes: 0,
    });
    const projectManifest = createProjectManifest({
      title: "Restorable trip",
      timezone: "UTC",
      order: "manual",
      photos,
      recordings: [source, excluded],
      offsetMinutesByPhoto: { "1": 0 },
    });
    const bundle = await buildScopedBundle({
      title: "Restorable trip",
      timezone: "UTC",
      photos: photos.slice(0, 1),
      placements: placements.slice(0, 1),
      sourcePhotos: photos,
      recordings: [source, excluded],
      includePhotos: true,
      projectManifest,
    });

    const { expanded, skipped } = await expandJourneyArchives([
      new File([bundle], "restorable.zip", { type: "application/zip" }),
    ]);

    expect(skipped).toEqual([]);
    expect(expanded.projectManifest).toEqual(projectManifest);
    expect(expanded.files.map((file) => file.name).sort()).toEqual([
      "1.jpg",
      "2.jpg",
      "paused.gpx",
      "walk.gpx",
    ]);
  });

  test("ignores bundle metadata and OS files", async () => {
    const archive = await zipFile({
      "__MACOSX/._IMG_001.jpg": "x",
      "photos/01-IMG_001.jpg": "photo-bytes",
      ".DS_Store": "x",
      "readme.txt": "hello",
      "journey.json": JSON.stringify({ title: "Kept Title" }),
      "journey.geojson": "{}",
    });
    const { expanded, skipped } = await expandJourneyArchives([archive]);
    expect(skipped).toEqual([]);
    expect(expanded.files.map((file) => file.name)).toEqual(["IMG_001.jpg"]);
    expect(expanded.bundleTitle).toBe("Kept Title");
  });

  test("reports a zip with nothing importable", async () => {
    const archive = await zipFile({
      "readme.txt": "hello",
      "journey.json": "{}",
    });
    const { expanded, skipped } = await expandJourneyArchives([archive]);
    expect(expanded.files).toEqual([]);
    expect(skipped[0].reason).toMatch(/no photos or GPX/i);
  });

  test("reports a file that is not a zip", async () => {
    const fake = new File(["not a zip"], "fake.zip", {
      type: "application/zip",
    });
    const { expanded, skipped } = await expandJourneyArchives([fake]);
    expect(expanded.files).toEqual([]);
    expect(skipped[0].reason).toMatch(/could not be read as a ZIP/i);
  });
});
