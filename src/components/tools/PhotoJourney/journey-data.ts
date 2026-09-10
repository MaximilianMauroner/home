import { distanceKm } from './timeline';
import type { Coordinates, JourneyPhoto } from './types';

export function formatDistance(km: number) {
  return `${km < 10 ? km.toFixed(1) : Math.round(km).toLocaleString('en')} km`;
}

export function formatCoordinates({ latitude, longitude }: Coordinates) {
  return `${Math.abs(latitude).toFixed(4)}° ${latitude < 0 ? 'S' : 'N'}, ${Math.abs(longitude).toFixed(4)}° ${longitude < 0 ? 'W' : 'E'}`;
}

export function formatDateRange(start?: Date, end?: Date) {
  if (!start) return undefined;
  const format = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  return end ? format.formatRange(start, end) : format.format(start);
}

export function journeySummary(photos: readonly JourneyPhoto[]) {
  const located = photos.flatMap((photo) => photo.metadata.coordinates ? [photo.metadata.coordinates] : []);
  const dates = photos.flatMap((photo) => photo.metadata.capturedAt ? [photo.metadata.capturedAt] : []).sort((a, b) => +a - +b);
  const altitudes = photos.flatMap((photo) => photo.metadata.altitude === undefined ? [] : [photo.metadata.altitude]);
  const startDate = dates[0];
  const endDate = dates.at(-1);
  const calendarDay = (date: Date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return {
    photoCount: photos.length,
    locatedCount: located.length,
    unlocatedCount: photos.length - located.length,
    distanceKm: located.reduce((total, point, index) => total + (index ? distanceKm(located[index - 1], point) : 0), 0),
    startDate,
    endDate,
    tripDays: startDate && endDate ? Math.round((calendarDay(endDate) - calendarDay(startDate)) / 86_400_000) + 1 : 0,
    distinctDays: new Set(dates.map(calendarDay)).size,
    altitudeMin: altitudes.length ? Math.min(...altitudes) : undefined,
    altitudeMax: altitudes.length ? Math.max(...altitudes) : undefined,
    cameras: [...new Set(photos.flatMap((photo) => photo.metadata.camera ? [photo.metadata.camera] : []))],
  };
}

export type ExportFormat = 'gpx' | 'geojson' | 'json';
const xml = (value: string) => value.replace(/[<>&"']/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[char] ?? char);

export function exportJourney(photos: readonly JourneyPhoto[], format: ExportFormat, title = 'Photo Journey') {
  const located = photos.filter((photo) => photo.metadata.coordinates);
  if (format === 'gpx') {
    const points = located.map((photo) => {
      const { coordinates, altitude, capturedAt } = photo.metadata;
      return `<trkpt lat="${coordinates!.latitude}" lon="${coordinates!.longitude}">${altitude === undefined ? '' : `<ele>${altitude}</ele>`}${capturedAt ? `<time>${capturedAt.toISOString()}</time>` : ''}<name>${xml(photo.name)}</name></trkpt>`;
    }).join('\n');
    return { content: `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Photo Journey" xmlns="http://www.topografix.com/GPX/1/1"><metadata><name>${xml(title)}</name></metadata><trk><name>${xml(title)}</name><trkseg>${points}</trkseg></trk></gpx>`, mime: 'application/gpx+xml', extension: 'gpx' };
  }
  const metadata = photos.map((photo, index) => ({ index: index + 1, name: photo.name, filename: photo.file.name, ...photo.metadata }));
  if (format === 'json') return { content: JSON.stringify({ title, summary: journeySummary(photos), photos: metadata }, null, 2), mime: 'application/json', extension: 'json' };
  const coordinates = located.map((photo) => {
    const point = photo.metadata.coordinates!;
    return photo.metadata.altitude === undefined ? [point.longitude, point.latitude] : [point.longitude, point.latitude, photo.metadata.altitude];
  });
  const features: Array<{ type: string; geometry: { type: string; coordinates: number[] | number[][] }; properties: object }> = located.map((photo, index) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: coordinates[index] }, properties: { name: photo.name, capturedAt: photo.metadata.capturedAt?.toISOString(), place: photo.metadata.place } }));
  if (coordinates.length >= 2) features.unshift({ type: 'Feature', geometry: { type: 'LineString', coordinates }, properties: { name: title } });
  return { content: JSON.stringify({ type: 'FeatureCollection', features }, null, 2), mime: 'application/geo+json', extension: 'geojson' };
}
