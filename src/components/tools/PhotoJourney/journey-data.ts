import { buildGpx, simplifyTrack, trackStats, type Track, type TrackStats } from './gpx';
import { distanceKm } from './timeline';
import type { Placement } from './track';
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

export function journeySummary(
  photos: readonly JourneyPhoto[],
  placements?: readonly Placement[],
  track?: TrackStats,
) {
  // A recorded track knows the route; without one the line between photos is the best estimate.
  const located = placements
    ? placements.flatMap((placement) => (placement.source === 'photo' || placement.source === 'track' ? [placement.coordinates!] : []))
    : photos.flatMap((photo) => photo.metadata.coordinates ? [photo.metadata.coordinates] : []);
  const dates = photos.flatMap((photo) => photo.metadata.capturedAt ? [photo.metadata.capturedAt] : []).sort((a, b) => +a - +b);
  const altitudes = photos.flatMap((photo) => photo.metadata.altitude === undefined ? [] : [photo.metadata.altitude]);
  const startDate = dates[0];
  const endDate = dates.at(-1);
  const calendarDay = (date: Date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return {
    photoCount: photos.length,
    locatedCount: located.length,
    unlocatedCount: photos.length - located.length,
    distanceKm: track ? track.distanceKm : located.reduce((total, point, index) => total + (index ? distanceKm(located[index - 1], point) : 0), 0),
    track,
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

/** Where each photo ended up, and why. Falls back to the photo's own fix with no track loaded. */
export function exportPlacement(photo: JourneyPhoto, placement?: Placement) {
  const coordinates = placement ? placement.coordinates : photo.metadata.coordinates;
  const placed = placement ? placement.source === 'photo' || placement.source === 'track' : Boolean(coordinates);
  return {
    coordinates: placed ? coordinates : undefined,
    elevation: placement?.elevation ?? photo.metadata.altitude,
    source: placement?.source ?? (coordinates ? 'photo' : 'none'),
    discrepancyM: placement?.discrepancyM,
    // Without a track the zone is unknown, so the EXIF wall clock is all there is to write.
    time: placement?.instant === undefined ? photo.metadata.capturedAt : new Date(placement.instant),
  };
}

export function exportJourney(
  photos: readonly JourneyPhoto[],
  format: ExportFormat,
  title = 'Photo Journey',
  placements?: readonly Placement[],
  track?: Track,
) {
  const placed = photos.map((photo, index) => ({ photo, ...exportPlacement(photo, placements?.[index]) }))
    .filter((entry) => entry.coordinates);
  if (format === 'gpx') {
    const waypoints = placed.map((entry) => ({
      name: entry.photo.name,
      latitude: entry.coordinates!.latitude,
      longitude: entry.coordinates!.longitude,
      elevation: entry.elevation,
      time: entry.time,
    }));
    // With no recorded track the photo stops are the track, which is what this tool wrote before.
    const line: Track | undefined = track ?? (placed.length
      ? {
          points: placed.map((entry) => ({
            latitude: entry.coordinates!.latitude,
            longitude: entry.coordinates!.longitude,
            elevation: entry.elevation,
            time: entry.time?.getTime(),
          })),
          segmentStarts: [0],
        }
      : undefined);
    return {
      content: buildGpx(title, line, waypoints),
      mime: 'application/gpx+xml',
      extension: 'gpx',
    };
  }
  const metadata = photos.map((photo, index) => {
    const placement = exportPlacement(photo, placements?.[index]);
    return {
      index: index + 1,
      name: photo.name,
      filename: photo.file.name,
      ...photo.metadata,
      placedBy: placement.source,
      placedCoordinates: placement.coordinates,
      cameraFixOffByM: placement.discrepancyM === undefined ? undefined : Math.round(placement.discrepancyM),
      // capturedAt above is the EXIF wall clock. This is the same moment with the zone resolved.
      capturedAtUtc: placements?.[index]?.instant === undefined ? undefined : placement.time?.toISOString(),
    };
  });
  if (format === 'json') {
    return {
      content: JSON.stringify({ title, summary: journeySummary(photos, placements, track ? trackStats(track) : undefined), photos: metadata }, null, 2),
      mime: 'application/json',
      extension: 'json',
    };
  }
  const point = (entry: (typeof placed)[number]) =>
    entry.elevation === undefined
      ? [entry.coordinates!.longitude, entry.coordinates!.latitude]
      : [entry.coordinates!.longitude, entry.coordinates!.latitude, entry.elevation];
  const features: Array<{ type: string; geometry: { type: string; coordinates: number[] | number[][] }; properties: object }> =
    placed.map((entry) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: point(entry) },
      properties: {
        name: entry.photo.name,
        capturedAt: entry.time?.toISOString(),
        place: entry.photo.metadata.place,
        placedBy: entry.source,
      },
    }));
  const line = track
    ? simplifyTrack(track.points, 5).map((node) => (node.elevation === undefined ? [node.longitude, node.latitude] : [node.longitude, node.latitude, node.elevation]))
    : placed.map(point);
  if (line.length >= 2) features.unshift({ type: 'Feature', geometry: { type: 'LineString', coordinates: line }, properties: { name: title } });
  return { content: JSON.stringify({ type: 'FeatureCollection', features }, null, 2), mime: 'application/geo+json', extension: 'geojson' };
}

export type BundleOptions = { title: string; includePhotos: boolean; track?: Track; placements?: readonly Placement[] };

/**
 * Everything the journey knows, in one file: the route as GPX with a waypoint per photo, the same
 * route as GeoJSON, the metadata, and optionally the original photos. The GPX is the useful part
 * for a photo library, which can re-tag the originals from it.
 */
export async function buildBundle(photos: readonly JourneyPhoto[], options: BundleOptions) {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  for (const format of ['gpx', 'geojson', 'json'] as const) {
    const result = exportJourney(photos, format, options.title, options.placements, options.track);
    zip.file(`journey.${result.extension}`, result.content);
  }
  zip.file('readme.txt', readme(photos, options));
  if (options.includePhotos) {
    const folder = zip.folder('photos')!;
    for (const [index, photo] of photos.entries()) {
      folder.file(`${String(index + 1).padStart(2, '0')}-${photo.file.name}`, photo.file);
    }
  }
  // No compression: photos and a short text file both fare better without the CPU cost.
  return zip.generateAsync({ type: 'blob', compression: 'STORE' });
}

function readme(photos: readonly JourneyPhoto[], options: BundleOptions) {
  const corrected = options.placements?.filter((placement) => placement.source === 'track').length ?? 0;
  return [
    options.title,
    '',
    `${photos.length} photos.`,
    options.track ? `Route from your GPX: ${options.track.points.length} recorded points.` : 'Route taken from the photo positions.',
    corrected ? `${corrected} photo${corrected === 1 ? '' : 's'} placed by timecode on the track rather than by the camera's own fix.` : '',
    '',
    'journey.gpx      the route, plus one waypoint per photo at its final position',
    'journey.geojson  the same route and points, for maps and GIS tools',
    'journey.json     all readable metadata, including how each photo was placed',
    options.includePhotos ? 'photos/          the original files, unmodified' : '',
    '',
    'To move the corrected positions into your photo library, import journey.gpx and let the',
    'library geotag by time. The original files are never modified by this tool.',
  ].filter((line) => line !== '').join('\n');
}
