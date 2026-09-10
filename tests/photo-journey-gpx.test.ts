import { JSDOM } from "jsdom";
import { describe, expect, test } from "vitest";

import {
  ASCENT_THRESHOLD_M,
  buildGpx,
  mergeTracks,
  parseGpx,
  pointAtTime,
  simplifyTrack,
  trackSegments,
  trackStats,
} from "../src/components/tools/PhotoJourney/gpx";
import { exportJourney } from "../src/components/tools/PhotoJourney/journey-data";
import { parseUtcOffset } from "../src/components/tools/PhotoJourney/metadata";
import {
  DISCREPANCY_LIMIT_M,
  inferUtcOffsetMinutes,
  photoInstant,
  placementSummary,
  resolvePlacements,
} from "../src/components/tools/PhotoJourney/track";
import type { JourneyPhoto } from "../src/components/tools/PhotoJourney/types";

// parseGpx uses the browser parser and the suite runs in node. Fixtures are parsed while the
// describe blocks are collected, so this has to happen at import time rather than in beforeAll.
globalThis.DOMParser = new JSDOM().window.DOMParser;

const gpx = (body: string) =>
  `<?xml version="1.0"?><gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">${body}</gpx>`;

function trkpt(lat: number, lon: number, ele: number, iso: string) {
  return `<trkpt lat="${lat}" lon="${lon}"><ele>${ele}</ele><time>${iso}</time></trkpt>`;
}

/** A short climb: five fixes, one minute apart, gaining 40 m and moving roughly 220 m east. */
const CLIMB = gpx(
  `<trk><name>Rosengarten</name><trkseg>` +
    trkpt(46.47, 11.6, 1800, "2026-08-20T06:00:00Z") +
    trkpt(46.47, 11.6007, 1810, "2026-08-20T06:01:00Z") +
    trkpt(46.47, 11.6014, 1825, "2026-08-20T06:02:00Z") +
    trkpt(46.47, 11.6021, 1836, "2026-08-20T06:03:00Z") +
    trkpt(46.47, 11.6028, 1840, "2026-08-20T06:04:00Z") +
    `</trkseg></trk>`,
);

/**
 * Two hours of steady walking, one fix every ten minutes, about 766 m per fix. Long enough that
 * several candidate offsets still land inside the recording, which is what makes the choice hard.
 */
const WANDER = gpx(
  `<trk><trkseg>` +
    Array.from({ length: 13 }, (_, step) =>
      trkpt(46.47, Number((11.6 + step * 0.01).toFixed(4)), 1800, `2026-08-20T0${6 + Math.floor(step / 6)}:${String((step * 10) % 60).padStart(2, "0")}:00Z`),
    ).join("") +
    `</trkseg></trk>`,
);

function photo(id: string, options: Partial<JourneyPhoto["metadata"]> = {}): JourneyPhoto {
  return {
    id,
    name: id,
    file: { size: 1 } as File,
    url: "blob:original",
    thumbnailUrl: "blob:preview",
    importOrder: 0,
    metadata: {
      dimensions: "1 × 1",
      fileSize: "1 KB",
      fileType: "JPEG",
      modifiedAtLabel: "-",
      details: [],
      ...options,
    },
  };
}

/** Builds the capture clock the way EXIF states it: wall time, read in the machine's own zone. */
function wallClock(iso: string, offsetMinutes: number) {
  const instant = Date.parse(iso) + offsetMinutes * 60_000;
  const local = new Date(instant);
  return new Date(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate(),
    local.getUTCHours(),
    local.getUTCMinutes(),
    local.getUTCSeconds(),
  );
}

describe("GPX parsing", () => {
  test("reads points, name, elevation and time", () => {
    const track = parseGpx(CLIMB);
    expect(track.name).toBe("Rosengarten");
    expect(track.points).toHaveLength(5);
    expect(track.points[0]).toMatchObject({ latitude: 46.47, longitude: 11.6, elevation: 1800 });
    expect(track.points[4].time).toBe(Date.parse("2026-08-20T06:04:00Z"));
  });

  test("keeps recorded pauses as separate segments and skips impossible coordinates", () => {
    const track = parseGpx(
      gpx(
        `<trk><trkseg>${trkpt(46.47, 11.6, 1800, "2026-08-20T06:00:00Z")}` +
          `<trkpt lat="99" lon="11.6"><time>2026-08-20T06:00:30Z</time></trkpt></trkseg>` +
          `<trkseg>${trkpt(46.48, 11.62, 1900, "2026-08-20T07:00:00Z")}` +
          trkpt(46.481, 11.621, 1910, "2026-08-20T07:01:00Z") +
          `</trkseg></trk>`,
      ),
    );
    expect(track.points).toHaveLength(3);
    expect(track.segmentStarts).toEqual([0, 1]);
    expect(trackSegments(track)).toHaveLength(1);
  });

  test("rejects a file with no track points", () => {
    expect(() => parseGpx(gpx("<trk><trkseg></trkseg></trk>"))).toThrow(/no track points/i);
    expect(() => parseGpx("not xml at all <")).toThrow();
  });

  test("merges several files in time order", () => {
    const morning = parseGpx(CLIMB);
    const afternoon = parseGpx(
      gpx(
        `<trk><trkseg>${trkpt(46.5, 11.7, 2100, "2026-08-20T14:00:00Z")}` +
          trkpt(46.501, 11.701, 2110, "2026-08-20T14:01:00Z") +
          `</trkseg></trk>`,
      ),
    );
    const merged = mergeTracks([afternoon, morning]);
    expect(merged.points).toHaveLength(7);
    expect(merged.segmentStarts).toEqual([0, 5]);
    expect(merged.points[0].time).toBe(Date.parse("2026-08-20T06:00:00Z"));
  });
});

describe("track statistics", () => {
  test("measures distance, climb and moving time", () => {
    const stats = trackStats(parseGpx(CLIMB));
    expect(stats.distanceKm).toBeCloseTo(0.214, 2);
    expect(stats.minElevation).toBe(1800);
    expect(stats.maxElevation).toBe(1840);
    expect(stats.movingSeconds).toBe(240);
    expect(stats.pointCount).toBe(5);
  });

  test("ignores elevation noise below the threshold", () => {
    const jitter = gpx(
      `<trk><trkseg>` +
        [0, 1, 2, 3, 4, 5, 6]
          .map((step) =>
            trkpt(
              46.47 + step * 0.0001,
              11.6,
              1800 + (step % 2 === 0 ? 0 : ASCENT_THRESHOLD_M - 4),
              `2026-08-20T06:0${step}:00Z`,
            ),
          )
          .join("") +
        `</trkseg></trk>`,
    );
    // Summed naively this is 3 × 6 m of climb. None of it is real.
    expect(trackStats(parseGpx(jitter)).ascentM).toBe(0);
  });

  test("excludes a long pause from moving time", () => {
    const paused = gpx(
      `<trk><trkseg>` +
        trkpt(46.47, 11.6, 1800, "2026-08-20T06:00:00Z") +
        trkpt(46.47, 11.6007, 1800, "2026-08-20T06:01:00Z") +
        trkpt(46.47, 11.6014, 1800, "2026-08-20T07:30:00Z") +
        `</trkseg></trk>`,
    );
    expect(trackStats(parseGpx(paused)).movingSeconds).toBe(60);
  });
});

describe("time lookup and simplification", () => {
  test("finds the nearest fix to an instant and reports the gap", () => {
    const track = parseGpx(CLIMB);
    const found = pointAtTime(track, Date.parse("2026-08-20T06:02:20Z"));
    expect(found?.index).toBe(2);
    expect(found?.gapMs).toBe(20_000);
    const before = pointAtTime(track, Date.parse("2026-08-20T05:00:00Z"));
    expect(before?.index).toBe(0);
    expect(before?.gapMs).toBe(3_600_000);
  });

  test("drops points that do not change the drawn line but keeps both ends", () => {
    const straight = Array.from({ length: 40 }, (_, index) => ({
      latitude: 46.47,
      longitude: 11.6 + index * 0.0002,
    }));
    const simplified = simplifyTrack(straight, 8);
    expect(simplified).toHaveLength(2);
    expect(simplified[0]).toEqual(straight[0]);
    expect(simplified[1]).toEqual(straight.at(-1));
  });

  test("keeps a corner that a walker would notice", () => {
    const corner = [
      { latitude: 46.47, longitude: 11.6 },
      { latitude: 46.4715, longitude: 11.6005 },
      { latitude: 46.47, longitude: 11.601 },
    ];
    expect(simplifyTrack(corner, 8)).toHaveLength(3);
  });
});

describe("placing photos on the track", () => {
  const track = parseGpx(CLIMB);

  test("keeps the photo's own fix when it agrees with the track", () => {
    const [placement] = resolvePlacements(
      [
        photo("agree", {
          capturedAt: wallClock("2026-08-20T06:02:00Z", 120),
          utcOffsetMinutes: 120,
          coordinates: { latitude: 46.47, longitude: 11.60142 },
        }),
      ],
      track,
    );
    expect(placement.source).toBe("photo");
    expect(placement.discrepancyM).toBeLessThan(DISCREPANCY_LIMIT_M);
    expect(placement.coordinates?.longitude).toBeCloseTo(11.60142, 5);
  });

  test("takes the track when the camera fix disagrees strongly", () => {
    const [placement] = resolvePlacements(
      [
        photo("phone-drift", {
          capturedAt: wallClock("2026-08-20T06:02:00Z", 120),
          utcOffsetMinutes: 120,
          // ~800 m north, the kind of jump a phone makes against a cliff.
          coordinates: { latitude: 46.4772, longitude: 11.6014 },
        }),
      ],
      track,
    );
    expect(placement.source).toBe("track");
    expect(placement.discrepancyM).toBeGreaterThan(700);
    expect(placement.coordinates).toEqual({ latitude: 46.47, longitude: 11.6014 });
    expect(placement.elevation).toBe(1825);
  });

  test("places a photo that carries no GPS at all", () => {
    const [placement] = resolvePlacements(
      [photo("no-gps", { capturedAt: wallClock("2026-08-20T06:03:00Z", 120), utcOffsetMinutes: 120 })],
      track,
    );
    expect(placement.source).toBe("track");
    expect(placement.coordinates).toEqual({ latitude: 46.47, longitude: 11.6021 });
    expect(placement.discrepancyM).toBeUndefined();
  });

  test("falls back to the photo, then to the position carried forward, outside coverage", () => {
    const placements = resolvePlacements(
      [
        photo("before", {
          capturedAt: wallClock("2026-08-20T04:00:00Z", 120),
          utcOffsetMinutes: 120,
          coordinates: { latitude: 46.4, longitude: 11.5 },
        }),
        photo("after-no-gps", {
          capturedAt: wallClock("2026-08-20T09:00:00Z", 120),
          utcOffsetMinutes: 120,
        }),
      ],
      track,
    );
    expect(placements[0].source).toBe("photo");
    expect(placements[1].source).toBe("carried");
    expect(placements[1].coordinates).toEqual({ latitude: 46.4, longitude: 11.5 });
  });

  test("reports nothing to place when there is neither time nor position", () => {
    const [placement] = resolvePlacements([photo("blank")], track);
    expect(placement.source).toBe("none");
    expect(placement.coordinates).toBeUndefined();
  });

  test("works with no track at all, exactly as before", () => {
    const placements = resolvePlacements([
      photo("a", { coordinates: { latitude: 1, longitude: 2 } }),
      photo("b"),
    ]);
    expect(placements.map((placement) => placement.source)).toEqual(["photo", "carried"]);
  });

  test("summarizes what the track corrected", () => {
    const summary = placementSummary([
      { photoId: "1", source: "track", discrepancyM: 800, coordinates: { latitude: 0, longitude: 0 } },
      { photoId: "2", source: "track", coordinates: { latitude: 0, longitude: 0 } },
      { photoId: "3", source: "photo", coordinates: { latitude: 0, longitude: 0 } },
      { photoId: "4", source: "none" },
    ]);
    expect(summary).toEqual({
      fromTrack: 2,
      fromPhoto: 1,
      unplaced: 1,
      correctedCount: 1,
      worstCorrectionM: 800,
    });
  });
});

describe("clock handling", () => {
  const track = parseGpx(CLIMB);

  test("reads the EXIF offset tag", () => {
    expect(parseUtcOffset("+02:00")).toBe(120);
    expect(parseUtcOffset("-05:30")).toBe(-330);
    expect(parseUtcOffset("bogus")).toBeUndefined();
    expect(parseUtcOffset(undefined)).toBeUndefined();
  });

  test("recovers the shutter instant from wall-clock time and an offset", () => {
    const captured = wallClock("2026-08-20T06:02:00Z", 120);
    expect(photoInstant({ capturedAt: captured, utcOffsetMinutes: 120 } as never)).toBe(
      Date.parse("2026-08-20T06:02:00Z"),
    );
  });

  test("infers the zone from photos that carry GPS when the camera wrote none", () => {
    const photos = [
      photo("one", {
        capturedAt: wallClock("2026-08-20T06:01:00Z", 120),
        coordinates: { latitude: 46.47, longitude: 11.6007 },
      }),
      photo("two", {
        capturedAt: wallClock("2026-08-20T06:03:00Z", 120),
        coordinates: { latitude: 46.47, longitude: 11.6021 },
      }),
    ];
    expect(inferUtcOffsetMinutes(photos, track)).toBe(120);
    const placements = resolvePlacements(photos, track, {
      offsetMinutes: inferUtcOffsetMinutes(photos, track),
    });
    expect(placements.every((placement) => placement.source === "photo")).toBe(true);
  });

  test("does not slide the clock to split the difference with a bad fix", () => {
    // One photo sits exactly on the track, the other's fix is 300 m off it. Sliding the clock so
    // both are half wrong scores better on an average, and is the wrong answer.
    const photos = [
      photo("exact", {
        capturedAt: wallClock("2026-08-20T06:30:00Z", 120),
        coordinates: { latitude: 46.47, longitude: 11.63 },
      }),
      photo("bad fix", {
        capturedAt: wallClock("2026-08-20T07:00:00Z", 120),
        coordinates: { latitude: 46.47, longitude: 11.6639 },
      }),
    ];
    const track = parseGpx(WANDER);
    expect(inferUtcOffsetMinutes(photos, track)).toBe(120);
    const placements = resolvePlacements(photos, track, { offsetMinutes: 120 });
    expect(placements[0]).toMatchObject({ source: "photo" });
    expect(placements[1]).toMatchObject({ source: "track" });
    expect(placements[1].discrepancyM).toBeGreaterThan(250);
  });

  test("still finds the three real quarter-hour zones", () => {
    const photos = [
      photo("kathmandu", {
        capturedAt: wallClock("2026-08-20T06:30:00Z", 345),
        coordinates: { latitude: 46.47, longitude: 11.63 },
      }),
    ];
    expect(inferUtcOffsetMinutes(photos, parseGpx(WANDER))).toBe(345);
  });

  test("prefers a stated offset over inference", () => {
    const photos = [
      photo("stated", {
        capturedAt: wallClock("2026-08-20T06:01:00Z", 60),
        utcOffsetMinutes: 60,
        coordinates: { latitude: 46.47, longitude: 11.6007 },
      }),
    ];
    expect(inferUtcOffsetMinutes(photos, track)).toBe(60);
  });
});

describe("writing GPX back out", () => {
  test("carries the track and one waypoint per photo, with escaping", () => {
    const track = parseGpx(CLIMB);
    const output = buildGpx("Tour & rest", track, [
      {
        name: "dawn <ridge>",
        latitude: 46.47,
        longitude: 11.6014,
        elevation: 1825,
        time: new Date("2026-08-20T06:02:00Z"),
      },
    ]);
    expect(output).toContain("<name>Tour &amp; rest</name>");
    expect(output).toContain('<wpt lat="46.47" lon="11.6014">');
    expect(output).toContain("<name>dawn &lt;ridge&gt;</name>");
    expect(output.match(/<trkpt /g)).toHaveLength(5);
    expect(output.match(/<trkseg>/g)).toHaveLength(1);
    // Round trip: what we write is what we can read back.
    const reparsed = parseGpx(output);
    expect(reparsed.points).toHaveLength(5);
  });

  test("writes waypoints with no track when the journey has only photos", () => {
    const output = buildGpx("Photos only", undefined, [
      { name: "one", latitude: 1, longitude: 2 },
    ]);
    expect(output).toContain('<wpt lat="1" lon="2">');
    expect(output).not.toContain("<trk>");
  });

  test("times the waypoints by the resolved instant, not the viewer's reading of the clock", () => {
    // The wall clock says 06:02 and the camera was two hours ahead of UTC. Writing the clock
    // itself would place the photo hours away on the track in whatever library re-tags from it.
    const track = parseGpx(CLIMB);
    const photos = [
      photo("dawn", {
        capturedAt: wallClock("2026-08-20T06:02:00Z", 120),
        utcOffsetMinutes: 120,
        coordinates: { latitude: 46.47, longitude: 11.6014 },
      }),
    ];
    const placements = resolvePlacements(photos, track);
    const output = exportJourney(photos, "gpx", "Instants", placements, track);
    expect(output.content).toContain("<time>2026-08-20T06:02:00.000Z</time>");
  });
});
