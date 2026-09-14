import { JSDOM } from "jsdom";
import { describe, expect, test } from "vitest";
import JSZip from "jszip";

import { deriveJourneyDays, filterTrackToDay, photoDayKey, scopedPhotos } from "../src/components/tools/PhotoJourney/days";
import { parseGpx } from "../src/components/tools/PhotoJourney/gpx";
import { normalizeMetadata } from "../src/components/tools/PhotoJourney/metadata";
import { resolvePlacementsForRecordings } from "../src/components/tools/PhotoJourney/track";
import { buildScopedBundle } from "../src/components/tools/PhotoJourney/journey-data";
import type { JourneyPhoto, JourneyRecording } from "../src/components/tools/PhotoJourney/types";

globalThis.DOMParser = new JSDOM().window.DOMParser;

const gpx = (body: string) => `<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">${body}</gpx>`;
const point = (lat: number, lon: number, time?: string) => `<trkpt lat="${lat}" lon="${lon}">${time ? `<time>${time}</time>` : ""}</trkpt>`;

function photo(id: string, wallClock?: string): JourneyPhoto {
  const file = new File([id], `${id}.jpg`, { type: "image/jpeg", lastModified: 0 });
  return {
    id,
    name: id,
    file,
    url: `blob:${id}`,
    thumbnailUrl: `blob:${id}-thumb`,
    importOrder: Number(id.replace(/\D/g, "")) || 0,
    metadata: normalizeMetadata(file, wallClock ? { DateTimeOriginal: wallClock } : {}, 1, 1),
  };
}

function recording(id: string, body: string): JourneyRecording {
  const file = new File([body], `${id}.gpx`, { type: "application/gpx+xml" });
  return { id, file, name: id, digest: id, track: parseGpx(gpx(body)), importOrder: 0, included: true, warnings: [] };
}

describe("journey day scope", () => {
  test("uses the selected trip timezone at DST boundaries", () => {
    const spring = Date.parse("2026-03-29T00:30:00Z");
    const summer = Date.parse("2026-03-29T22:30:00Z");
    expect(photoDayKey(photo("1"), { photoId: "1", source: "track", instant: spring }, "Europe/Berlin")).toBe("2026-03-29");
    expect(photoDayKey(photo("2"), { photoId: "2", source: "track", instant: summer }, "Europe/Berlin")).toBe("2026-03-30");
  });

  test("uses a resolved camera offset when the viewer timezone is UTC", () => {
    const instant = Date.parse("2026-08-19T22:30:00Z");
    expect(photoDayKey(photo("1"), { photoId: "1", source: "track", instant, offsetMinutes: 120 }, "UTC")).toBe("2026-08-20");
  });

  test("includes recording-only dates and keeps undated samples separate", () => {
    const photos = [photo("1", "2026:08:20 10:00:00")];
    const source = recording("walk", `<trk><trkseg>${point(1, 2, "2026-08-21T00:00:00Z")}${point(1, 2.1)}</trkseg></trk>`);
    const placements = resolvePlacementsForRecordings(photos, [source]);
    const days = deriveJourneyDays(photos, placements, [source], "UTC");
    expect(days.map((day) => [day.key, day.photoIds.length, day.recordedPointCount])).toEqual([
      ["2026-08-20", 1, 0],
      ["2026-08-21", 0, 1],
      ["undated", 0, 1],
    ]);
  });

  test("keeps photos without a date in the selectable Undated scope", () => {
    const undated = photo("undated");
    const placements = [{ photoId: undated.id, source: "none" as const }];
    expect(deriveJourneyDays([undated], placements, [], "UTC").map((day) => day.key)).toEqual(["undated"]);
    expect(scopedPhotos([undated], placements, "undated", "UTC").map((entry) => entry.photo.id)).toEqual(["undated"]);
  });

  test("filters points without inventing or reconnecting boundaries", () => {
    const track = parseGpx(gpx(`<trk><trkseg>${point(1, 2, "2026-08-20T23:59:00Z")}${point(1, 2.1, "2026-08-21T00:01:00Z")}${point(1, 2.2, "2026-08-21T00:02:00Z")}</trkseg></trk>`));
    const day = filterTrackToDay(track, "2026-08-21", "UTC");
    expect(day?.points).toHaveLength(2);
    expect(day?.segmentStarts).toEqual([0]);
    expect(day?.points[0].longitude).toBe(2.1);
  });

  test("keeps each calendar day's recording samples in its own segment", () => {
    const track = parseGpx(gpx(`<trk><trkseg>${point(1, 2, "2026-08-20T23:59:00Z")}${point(1, 2.1, "2026-08-21T00:01:00Z")}${point(1, 2.2, "2026-08-21T00:02:00Z")}${point(1, 2.3)}</trkseg></trk>`));
    const day = filterTrackToDay(track, "2026-08-21", "UTC");
    expect(day?.points.map((entry) => entry.longitude)).toEqual([2.1, 2.2]);
    expect(day?.segmentStarts).toEqual([0]);
    const undated = filterTrackToDay(track, "undated", "UTC");
    expect(undated?.points.map((entry) => entry.longitude)).toEqual([2.3]);
  });

  test("builds deterministic day and recording GPX entries", async () => {
    const photos = [photo("1", "2026:08:20 10:00:00")];
    const source = recording("walk", `<trk><name>Morning</name><trkseg>${point(1, 2, "2026-08-20T10:00:00Z")}${point(1, 2.1, "2026-08-20T10:01:00Z")}</trkseg></trk>`);
    const placements = resolvePlacementsForRecordings(photos, [source], { offsetMinutes: 0 });
    const blob = await buildScopedBundle({ title: "Trip", timezone: "UTC", photos, placements, recordings: [source] });
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const names = Object.keys(zip.files);
    expect(names).toEqual([
      "journey.gpx",
      "journey.json",
      "journey.geojson",
      "days/",
      "days/01-2026-08-20.gpx",
      "recordings/",
      "recordings/walk.gpx",
      "recordings/walk-original.gpx",
      "readme.txt",
    ]);
    expect(await zip.file("days/01-2026-08-20.gpx")!.async("string")).toContain("<trkpt");
  });

  test("exports an Undated GPX when photos have no calendar data", async () => {
    const undated = photo("undated");
    const placements = [{ photoId: undated.id, source: "none" as const }];
    const blob = await buildScopedBundle({ title: "Trip", timezone: "UTC", photos: [undated], placements, recordings: [] });
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    expect(Object.keys(zip.files)).toContain("days/01-undated.gpx");
    expect(await zip.file("days/01-undated.gpx")!.async("string")).not.toContain("<wpt ");
  });

  test("exports recording-only and undated scopes independently", async () => {
    const source = recording("multi", `<trk><trkseg>${point(1, 2, "2026-08-20T23:59:00Z")}${point(1, 2.1, "2026-08-21T00:01:00Z")}${point(1, 2.2)}</trkseg></trk>`);
    const blob = await buildScopedBundle({ title: "Trip", timezone: "UTC", photos: [], placements: [], recordings: [source], track: source.track });
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const names = Object.keys(zip.files).filter((name) => name.endsWith(".gpx"));
    expect(names).toEqual([
      "journey.gpx",
      "days/01-2026-08-20.gpx",
      "days/02-2026-08-21.gpx",
      "days/03-undated.gpx",
      "recordings/multi.gpx",
      "recordings/multi-original.gpx",
    ]);
    expect(await zip.file("days/03-undated.gpx")!.async("string")).toContain('lon="2.2"');
    expect(await zip.file("recordings/multi-original.gpx")!.async("string")).toContain('lon="2.2"');
  });
});
