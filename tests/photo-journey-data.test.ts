import { describe, expect, test } from 'vitest';
import { acceptFiles } from '../src/components/tools/PhotoJourney/ingestion';
import { normalizeMetadata, groupMetadata, MAX_TOTAL_BYTES } from '../src/components/tools/PhotoJourney/metadata';
import { dominantColor } from '../src/components/tools/PhotoJourney/thumbnail';
import { nearestPlace } from '../src/components/tools/PhotoJourney/places';
import { exportJourney, formatCoordinates, journeySummary } from '../src/components/tools/PhotoJourney/journey-data';
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
    expect(result.skipped.map((item) => item.reason)).toEqual(['500 MB total limit', 'unsupported image format']);
  });
  test('reports count limits and accepts HEIC with no browser MIME', () => {
    const heic = new File([], 'phone.HEIC');
    expect(acceptFiles([heic], []).accepted).toEqual([heic]);
    expect(acceptFiles([heic], Array.from({ length: 100 }, () => photo('old'))).skipped[0].reason).toBe('100-photo limit');
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
    expect(result.content.match(/<trkpt /g)).toHaveLength(1);
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
});
