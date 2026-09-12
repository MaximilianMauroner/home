import { describe, expect, test } from 'vitest';
import { acceptFiles } from '../src/components/tools/PhotoJourney/ingestion';
import { normalizeMetadata, groupMetadata, MAX_TOTAL_BYTES } from '../src/components/tools/PhotoJourney/metadata';
import { dominantColor } from '../src/components/tools/PhotoJourney/thumbnail';
import { nearestPlace } from '../src/components/tools/PhotoJourney/places';
import { exportJourney, formatCoordinates, formatDayKeyRange, journeySummary } from '../src/components/tools/PhotoJourney/journey-data';
import { resolvePlacements } from '../src/components/tools/PhotoJourney/track';
import type { JourneyPhoto } from '../src/components/tools/PhotoJourney/types';

function photo(name: string, data: Record<string, unknown> = {}): JourneyPhoto {
  const file = new File(['photo'], `${name}.jpg`, { type: 'image/jpeg', lastModified: 0 });
  return { id: name, name, file, url: 'blob:private-original', thumbnailUrl: 'blob:private-preview', importOrder: 0, metadata: normalizeMetadata(file, data, 400, 300) };
}

describe('journey ingestion', () => {
  test('keeps later small files when an earlier file does not fit', () => {
    const huge = new File([], 'huge.jpg', { type: 'image/jpeg' });
    Object.defineProperty(huge, 'size', { value: MAX_TOTAL_BYTES + 1 });
    const small = photo('small').file;
    const bad = new File([], 'bad.txt', { type: 'text/plain' });
    const result = acceptFiles([huge, small, bad], []);
    expect(result.accepted).toEqual([small]);
    expect(result.skipped.map((item) => item.reason)).toEqual(['4 GB total limit', 'unsupported image format']);
  });
  test('reports count limits and accepts HEIC with no browser MIME', () => {
    const heic = new File([], 'phone.HEIC');
    expect(acceptFiles([heic], []).accepted).toEqual([heic]);
    expect(acceptFiles([heic], Array.from({ length: 2_000 }, () => photo('old'))).skipped[0].reason).toBe('2000-photo limit');
  });
});

describe('journey metadata and geography', () => {
  test('groups and sorts readable tags while retaining their original names', () => {
    const groups = groupMetadata([{ label: 'GPSAltitude', value: '10' }, { label: 'LensModel', value: 'Prime' }, { label: 'Make', value: 'Camera' }]);
    expect(groups.map((group) => group.name)).toEqual(['Camera', 'Location']);
    expect(groups[1].details[0]).toEqual({ label: 'GPS Altitude', rawLabel: 'GPSAltitude', value: '10' });
  });
  test('finds the nearest bundled place offline', async () => {
    expect(await nearestPlace({ latitude: 48.208, longitude: 16.373 })).toMatch(/Vienna, Austria/);
  });
  test('names the hemisphere instead of printing signed coordinates', () => {
    expect(formatCoordinates({ latitude: -0.37131, longitude: 36.05642 })).toBe('0.3713° S, 36.0564° E');
    expect(formatCoordinates({ latitude: 40.7128, longitude: -74.006 })).toBe('40.7128° N, 74.0060° W');
  });
  test('formats trip calendar keys independently of the viewer timezone', () => {
    expect(formatDayKeyRange('2026-08-20', '2026-08-20')).toMatch(/Aug 20, 2026/);
    expect(formatDayKeyRange('2026-08-20', '2026-08-21')).toMatch(/Aug 20.*21, 2026/);
  });
  test('uses the common colour and ignores transparent pixels', () => {
    expect(dominantColor(new Uint8ClampedArray([240, 0, 0, 255, 240, 0, 0, 255, 0, 240, 0, 255]))).toBe('rgb(240, 16, 16)');
    expect(dominantColor(new Uint8ClampedArray([255, 255, 255, 0]))).toBe('#071319');
  });
  test('summarizes missing positions, calendar days, below-sea altitude and cameras', () => {
    const photos = [photo('a', { latitude: 0, longitude: 0, DateTimeOriginal: new Date('2024-01-01T12:00:00Z'), GPSAltitude: 10, GPSAltitudeRef: 1, Make: 'Apple' }), photo('b'), photo('c', { latitude: 0, longitude: 1, DateTimeOriginal: new Date('2024-01-03T12:00:00Z'), GPSAltitude: 25, Make: 'Apple' })];
    expect(journeySummary(photos)).toMatchObject({ photoCount: 3, locatedCount: 2, unlocatedCount: 1, tripDays: 3, distinctDays: 2, altitudeMin: -10, altitudeMax: 25, cameras: ['Apple'] });
    expect(journeySummary(photos).distanceKm).toBeCloseTo(111.195, 2);
  });
});

describe('journey exports', () => {
  const photos = [photo('A<&', { latitude: 10, longitude: 20, GPSAltitude: 5 }), photo('no GPS')];
  test('escapes GPX text and excludes missing GPS points', () => {
    const result = exportJourney(photos, 'gpx', 'Trip & friends');
    expect(result.content).toContain('Trip &amp; friends');
    expect(result.content).toContain('<name>A&lt;&amp;</name>');
    expect(result.content).not.toContain('<trkpt ');
    expect(result.content.match(/<wpt /g)).toHaveLength(1);
  });
  test('exports longitude first without an invalid single-point LineString', () => {
    expect(JSON.parse(exportJourney(photos, 'geojson').content).features).toHaveLength(1);
    expect(JSON.parse(exportJourney(photos, 'geojson').content).features[0].geometry.coordinates).toEqual([20, 10, 5]);
  });
  test('metadata export includes unlocated photos and excludes object URLs and files', () => {
    const output = exportJourney(photos, 'json').content;
    expect(JSON.parse(output).photos).toHaveLength(2);
    expect(output).not.toContain('blob:');
  });
  test('metadata export keeps an unresolved camera clock out of UTC fields', () => {
    const unknown = photo('unknown', { DateTimeOriginal: '2026:08:20 08:02:00' });
    const output = exportJourney([unknown], 'json', 'Unknown').content;
    const record = JSON.parse(output).photos[0];
    expect(record.capturedAt).toBeUndefined();
    expect(record.capturedAtCamera).toBe('2026-08-20T08:02:00');
    expect(record.capturedAtUtc).toBeUndefined();
  });
  test('metadata export includes a known camera instant without placements', () => {
    const known = photo('known', {
      DateTimeOriginal: '2024-01-01T14:00:00',
      OffsetTimeOriginal: '+02:00',
    });
    const output = exportJourney([known], 'json', 'Known').content;
    expect(JSON.parse(output).photos[0].capturedAtUtc).toBe('2024-01-01T12:00:00.000Z');
  });
  test('photo-only GPX includes an explicitly offset camera instant without placements', () => {
    const known = photo('known', {
      DateTimeOriginal: '2024-01-01T14:00:00',
      OffsetTimeOriginal: '+02:00',
      latitude: 1,
      longitude: 2,
    });
    expect(exportJourney([known], 'gpx').content).toContain('<time>2024-01-01T12:00:00.000Z</time>');
  });
  test('metadata export records a user supplied camera offset separately from EXIF', () => {
    const unknown = photo('unknown', { DateTimeOriginal: '2024:01:01 14:00:00', latitude: 1, longitude: 2 });
    const placement = resolvePlacements([unknown], undefined, { offsetMinutes: 120 });
    const record = JSON.parse(exportJourney([unknown], 'json', 'Fallback', placement).content).photos[0];
    expect(record.cameraUtcOffsetMinutes).toBeUndefined();
    expect(record.resolvedUtcOffsetMinutes).toBe(120);
    expect(record.capturedAtUtc).toBe('2024-01-01T12:00:00.000Z');
  });
  test('GeoJSON keeps a singleton recording sample as a point', () => {
    const track = {
      points: [{ latitude: 1, longitude: 2, elevation: 3, time: 0 }],
      segmentStarts: [0],
    };
    const features = JSON.parse(exportJourney([], 'geojson', 'One', [], track).content).features;
    expect(features).toEqual([expect.objectContaining({ geometry: { type: 'Point', coordinates: [2, 1, 3] } })]);
  });
  test('GeoJSON keeps elevation on recorded line vertices', () => {
    const track = {
      points: [{ latitude: 1, longitude: 2, elevation: 3 }, { latitude: 1.1, longitude: 2.1, elevation: 4 }],
      segmentStarts: [0],
    };
    const features = JSON.parse(exportJourney([], 'geojson', 'Line', [], track).content).features;
    expect(features[0].geometry.coordinates).toEqual([[2, 1, 3], [2.1, 1.1, 4]]);
  });
  test('exports recording provenance and unresolved location state', () => {
    const placement = { photoId: 'A<&', source: 'photo' as const, coordinates: { latitude: 10, longitude: 20 }, recordingId: 'walk', conflict: true, ambiguous: true };
    const output = JSON.parse(exportJourney([photos[0]], 'json', 'Trip', [placement]).content);
    expect(output.photos[0]).toMatchObject({ recordingId: 'walk', locationConflict: true, ambiguousRecordingMatch: true });
    const geojson = JSON.parse(exportJourney([photos[0]], 'geojson', 'Trip', [placement]).content);
    expect(geojson.features[0].properties).toMatchObject({ recordingId: 'walk', locationConflict: true, ambiguousRecordingMatch: true });
  });
});
