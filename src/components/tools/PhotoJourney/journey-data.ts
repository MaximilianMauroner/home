import { buildGpx, mergeTracks, trackSegments, trackStats, type Track, type TrackPoint, type TrackStats } from './gpx';
import { distanceKm, routeSegments } from './timeline';
import { photoInstant, photoOffsetMinutes, type Placement } from './track';
import type { Coordinates, JourneyPhoto } from './types';
import { deriveJourneyDays, dayKeyFromInstant, filterTrackToDay, normalizeTimezone, photoDayKey, scopedPhotos, type DayScope } from './days';
import type { JourneyRecording } from './types';

export function formatDistance(km: number) {
  return `${km < 10 ? km.toFixed(1) : Math.round(km).toLocaleString('en')} km`;
}

export function formatCoordinates({ latitude, longitude }: Coordinates) {
  return `${Math.abs(latitude).toFixed(4)}° ${latitude < 0 ? 'S' : 'N'}, ${Math.abs(longitude).toFixed(4)}° ${longitude < 0 ? 'W' : 'E'}`;
}

export function formatDateRange(start?: Date, end?: Date, timezone?: string) {
  if (!start) return undefined;
  const format = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: timezone ? normalizeTimezone(timezone) : undefined });
  return end ? format.formatRange(start, end) : format.format(start);
}

/** Formats calendar keys without letting the viewer's timezone move a trip day across midnight. */
export function formatDayKeyRange(startKey?: string, endKey?: string) {
  if (!startKey || !/^\d{4}-\d{2}-\d{2}$/.test(startKey)) return undefined;
  const start = new Date(`${startKey}T12:00:00.000Z`);
  const end = endKey && /^\d{4}-\d{2}-\d{2}$/.test(endKey)
    ? new Date(`${endKey}T12:00:00.000Z`)
    : undefined;
  if (Number.isNaN(start.valueOf()) || (end && Number.isNaN(end.valueOf()))) return undefined;
  const format = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  return end && endKey !== startKey ? format.formatRange(start, end) : format.format(start);
}

export function journeySummary(
  photos: readonly JourneyPhoto[],
  placements?: readonly Placement[],
  track?: TrackStats,
  timezone = 'UTC',
  recordedTrack?: Track,
) {
  const located = placements
    ? placements.flatMap((placement) => (placement.source === 'photo' || placement.source === 'track' ? [placement.coordinates!] : []))
    : photos.flatMap((photo) => photo.metadata.coordinates ? [photo.metadata.coordinates] : []);
  const dates = photos.flatMap((photo, index) => {
    const placement = placements?.[index];
    if (placement?.instant !== undefined) return [new Date(placement.instant)];
    return photo.metadata.capturedAt ? [photo.metadata.capturedAt] : [];
  }).sort((a, b) => +a - +b);
  const altitudes = photos.flatMap((photo) => photo.metadata.altitude === undefined ? [] : [photo.metadata.altitude]);
  const dateKeys = new Set<string>();
  photos.forEach((photo, index) => {
    const key = photoDayKey(photo, placements?.[index], timezone);
    if (key) dateKeys.add(key);
  });
  if (recordedTrack) {
    for (const point of recordedTrack.points) {
      if (point.time === undefined || !Number.isFinite(point.time)) continue;
      const key = dayKeyFromInstant(point.time, timezone);
      if (key) dateKeys.add(key);
    }
  }
  const orderedDateKeys = [...dateKeys].sort();
  const startDate = dates[0];
  const endDate = dates.at(-1);
  const allDates = dates.concat(track?.start ? [track.start] : [], track?.end ? [track.end] : []).sort((a, b) => +a - +b);
  return {
    photoCount: photos.length,
    locatedCount: located.length,
    unlocatedCount: photos.length - located.length,
    distanceKm: track ? track.distanceKm : located.reduce((total, point, index) => total + (index ? distanceKm(located[index - 1], point) : 0), 0),
    track,
    startDate: allDates[0] ?? startDate,
    endDate: allDates.at(-1) ?? endDate,
    startDateKey: orderedDateKeys[0],
    endDateKey: orderedDateKeys.at(-1),
    tripDays: orderedDateKeys.length ? Math.round((Date.parse(`${orderedDateKeys.at(-1)}T00:00:00Z`) - Date.parse(`${orderedDateKeys[0]}T00:00:00Z`)) / 86_400_000) + 1 : 0,
    distinctDays: dateKeys.size,
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
  const instant = placement?.instant ?? photoInstant(photo.metadata);
  return {
    coordinates: placed ? coordinates : undefined,
    elevation: placement?.elevation ?? photo.metadata.altitude,
    source: placement?.source ?? (coordinates ? 'photo' : 'none'),
    discrepancyM: placement?.discrepancyM,
    recordingId: placement?.recordingId,
    conflict: placement?.conflict,
    ambiguous: placement?.ambiguous,
    choiceUnavailable: placement?.choiceUnavailable,
    offsetMinutes: placement?.offsetMinutes ?? photoOffsetMinutes(photo.metadata),
    // Only a resolved instant is safe to serialize. A bare camera wall clock must never become a
    // false UTC timestamp in a GPX file.
    time: instant === undefined ? undefined : new Date(instant),
  };
}

export function exportJourney(
  photos: readonly JourneyPhoto[],
  format: ExportFormat,
  title = 'Photo Journey',
  placements?: readonly Placement[],
  track?: Track,
  timezone = 'UTC',
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
    // A photo-only export is waypoint-only. A line between photo fixes is an estimate, not a
    // recorded route, and must not be presented as one.
    return {
      content: buildGpx(title, track, waypoints),
      mime: 'application/gpx+xml',
      extension: 'gpx',
    };
  }
  const metadata = photos.map((photo, index) => {
    const placement = exportPlacement(photo, placements?.[index]);
    const { capturedAt: _capturedAt, capturedAtWallClock: _capturedAtWallClock, utcOffsetMinutes: _utcOffsetMinutes, ...readableMetadata } = photo.metadata;
    return {
      index: index + 1,
      name: photo.name,
      filename: photo.file.name,
      ...readableMetadata,
      capturedAtCamera: photo.metadata.capturedAtWallClock,
      cameraUtcOffsetMinutes: photo.metadata.utcOffsetMinutes,
      resolvedUtcOffsetMinutes: placement.offsetMinutes,
      placedBy: placement.source,
      recordingId: placement.recordingId,
      locationConflict: placement.conflict,
      ambiguousRecordingMatch: placement.ambiguous,
      recordingChoiceUnavailable: placement.choiceUnavailable,
      placedCoordinates: placement.coordinates,
      cameraFixOffByM: placement.discrepancyM === undefined ? undefined : Math.round(placement.discrepancyM),
      // capturedAt above is the EXIF wall clock. This is the same moment with the zone resolved.
      capturedAtUtc: placement.time?.toISOString(),
    };
  });
  if (format === 'json') {
    return {
      content: JSON.stringify({ title, summary: journeySummary(photos, placements, track ? trackStats(track) : undefined, timezone, track), photos: metadata }, null, 2),
      mime: 'application/json',
      extension: 'json',
    };
  }
  const point = (entry: (typeof placed)[number]) =>
    entry.elevation === undefined
      ? [entry.coordinates!.longitude, entry.coordinates!.latitude]
      : [entry.coordinates!.longitude, entry.coordinates!.latitude, entry.elevation];
  const photoFeatures: Array<{ type: string; geometry: { type: string; coordinates: number[] | number[][] }; properties: object }> =
    placed.map((entry) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: point(entry) },
      properties: {
        name: entry.photo.name,
        capturedAt: entry.time?.toISOString(),
        place: entry.source === 'track' && (entry.discrepancyM === undefined || entry.discrepancyM > 60)
          ? 'recorded position'
          : entry.photo.metadata.place,
        placedBy: entry.source,
        recordingId: entry.recordingId,
        locationConflict: entry.conflict,
        ambiguousRecordingMatch: entry.ambiguous,
        recordingChoiceUnavailable: entry.choiceUnavailable,
      },
    }));
  const recordedFeatures: Array<{ type: string; geometry: { type: string; coordinates: number[] | number[][] }; properties: object }> = [];
  for (const segment of track ? trackSegments(track, 5) : []) {
    if (segment.length === 1) {
      const node = segment[0];
      recordedFeatures.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: node.elevation === undefined
            ? [node.longitude, node.latitude]
            : [node.longitude, node.latitude, node.elevation],
        },
        properties: { name: title, recorded: true, singleton: true },
      });
      continue;
    }
    for (const line of routeSegments(segment)) {
      recordedFeatures.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: line.map((node) => {
            const point = node as TrackPoint;
            return point.elevation === undefined
              ? [point.longitude, point.latitude]
              : [point.longitude, point.latitude, point.elevation];
          }),
        },
        properties: { name: title, recorded: true },
      });
    }
  }
  return { content: JSON.stringify({ type: 'FeatureCollection', features: [...recordedFeatures, ...photoFeatures] }, null, 2), mime: 'application/geo+json', extension: 'geojson' };
}

export type BundleOptions = { title: string; includePhotos: boolean; track?: Track; placements?: readonly Placement[]; timezone?: string; scopeLabel?: string };

/**
 * Everything in one selected scope: the route as GPX with a waypoint per placed photo, the same
 * route as GeoJSON, the metadata, and optionally the original photos.
 */
export async function buildBundle(photos: readonly JourneyPhoto[], options: BundleOptions) {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  for (const format of ['gpx', 'geojson', 'json'] as const) {
    const result = exportJourney(photos, format, options.title, options.placements, options.track, options.timezone);
    zip.file(`journey.${result.extension}`, result.content);
  }
  zip.file('readme.txt', readme(photos, options));
  if (options.includePhotos) {
    const folder = zip.folder('photos')!;
    for (const [index, photo] of photos.entries()) {
      // ArrayBuffer keeps this working in browsers and in Node tests, where JSZip cannot read Blob/File.
      folder.file(`${String(index + 1).padStart(2, '0')}-${photo.file.name}`, await photo.file.arrayBuffer());
    }
  }
  // No compression: photos and a short text file both fare better without the CPU cost.
  return zip.generateAsync({ type: 'blob', compression: 'STORE' });
}

function readme(photos: readonly JourneyPhoto[], options: BundleOptions) {
  const corrected = options.placements?.filter((placement) => placement.source === 'track' && placement.discrepancyM !== undefined).length ?? 0;
  const unassigned = photos.filter((photo, index) => !exportPlacement(photo, options.placements?.[index]).coordinates).length;
  const unresolvedTime = photos.filter((photo, index) => photo.metadata.capturedAtWallClock && exportPlacement(photo, options.placements?.[index]).time === undefined).length;
  return [
    options.title,
    '',
    `${photos.length} photos.`,
    options.scopeLabel ? `Selected days: ${options.scopeLabel}.` : '',
    options.timezone ? `Trip timezone: ${options.timezone}.` : '',
    options.track ? `Route from your GPX: ${options.track.points.length} recorded points.` : 'Distance estimated from photo positions.',
    corrected ? `${corrected} photo${corrected === 1 ? '' : 's'} placed by timecode on the track rather than by the camera's own fix.` : '',
    `${unassigned} photo${unassigned === 1 ? '' : 's'} omitted from GPX waypoints because no position was assigned.`,
    unresolvedTime ? `${unresolvedTime} camera time${unresolvedTime === 1 ? '' : 's'} remain unresolved and are omitted from GPX timestamps.` : '',
    '',
    'journey.gpx      the route, plus one waypoint per photo at its final position',
    'journey.geojson  the same route and points, for maps and GIS tools',
    'journey.json     all readable metadata, including how each photo was placed',
    'This bundle is an export, not a restorable project file.',
    options.includePhotos ? 'photos/          the original files, unmodified' : '',
    '',
    'The generated GPX includes final photo waypoints for tools that support them. Check the',
    'destination tool before applying positions; the original files are never modified here.',
  ].filter((line) => line !== '').join('\n');
}

function safeFilename(value: string, fallback: string) {
  const cleaned = value.trim().replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "");
  return cleaned || fallback;
}

export type ScopedBundleOptions = {
  title: string;
  timezone: string;
  photos: readonly JourneyPhoto[];
  placements: readonly Placement[];
  recordings: readonly JourneyRecording[];
  track?: Track;
  includePhotos?: boolean;
};

/**
 * A deterministic archive of the same scopes shown in the workspace. Each date and each source
 * gets its own GPX, while the root files remain the complete journey for tools that prefer one
 * download. Original recording bytes are kept next to their generated, photo-waypoint version.
 */
export async function buildScopedBundle(options: ScopedBundleOptions) {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const includedRecordings = options.recordings.filter((recording) => recording.included);
  const scopeTrack = options.track ?? (includedRecordings.length
    ? mergeTracks(includedRecordings.map((recording) => recording.track))
    : undefined);
  const days = deriveJourneyDays(options.photos, options.placements, options.recordings, options.timezone);
  const allResult = exportJourney(options.photos, 'gpx', options.title, options.placements, scopeTrack, options.timezone);
  zip.file('journey.gpx', allResult.content);
  zip.file('journey.json', exportJourney(options.photos, 'json', options.title, options.placements, scopeTrack, options.timezone).content);
  zip.file('journey.geojson', exportJourney(options.photos, 'geojson', options.title, options.placements, scopeTrack, options.timezone).content);

  const usedDayNames = new Set<string>();
  for (const [index, day] of days.entries()) {
    const entries = scopedPhotos(options.photos, options.placements, day.key as DayScope, options.timezone);
    const dayPhotos = entries.map((entry) => entry.photo);
    const dayPlacements = entries.map((entry) => entry.placement);
    const dayTrack = filterTrackToDay(scopeTrack, day.key, options.timezone);
    const base = safeFilename(day.undated ? 'undated' : day.key, `day-${index + 1}`);
    let name = base;
    let suffix = 2;
    while (usedDayNames.has(name)) name = `${base}-${suffix++}`;
    usedDayNames.add(name);
    zip.file(`days/${String(index + 1).padStart(2, '0')}-${name}.gpx`, exportJourney(dayPhotos, 'gpx', `${options.title} · ${day.label}`, dayPlacements, dayTrack, options.timezone).content);
  }

  const usedRecordingNames = new Set<string>();
  for (const [index, recording] of [...includedRecordings].sort((a, b) => a.importOrder - b.importOrder).entries()) {
    const base = safeFilename(recording.name || recording.file.name.replace(/\.gpx$/i, ''), `recording-${index + 1}`);
    let name = base;
    let suffix = 2;
    while (usedRecordingNames.has(name)) name = `${base}-${suffix++}`;
    usedRecordingNames.add(name);
    const sourceEntries = options.photos.flatMap((photo, photoIndex) => {
      const placement = options.placements[photoIndex];
      // A conflicted photo GPS is not a recording waypoint until the viewer accepts the
      // recording position. This keeps source exports from presenting an unresolved match as fact.
      return placement?.recordingId === recording.id && (placement.source === 'track' || !placement.conflict)
        ? [{ photo, placement }]
        : [];
    });
    const sourcePhotos = sourceEntries.map((entry) => entry.photo);
    const sourcePlacements = sourceEntries.map((entry) => entry.placement);
    zip.file(`recordings/${name}.gpx`, exportJourney(sourcePhotos, 'gpx', recording.name, sourcePlacements, recording.track, options.timezone).content);
    zip.file(`recordings/${name}-original.gpx`, await recording.file.arrayBuffer());
  }

  if (options.includePhotos) {
    const folder = zip.folder('photos')!;
    for (const [index, photo] of options.photos.entries()) folder.file(`${String(index + 1).padStart(2, '0')}-${photo.file.name}`, await photo.file.arrayBuffer());
  }
  const unresolved = options.placements.filter((placement) => placement.source === 'none' || placement.source === 'carried').length;
  const unresolvedTime = options.photos.filter((photo, index) => photo.metadata.capturedAtWallClock && options.placements[index]?.instant === undefined).length;
  const conflicts = options.placements.filter((placement) => placement.conflict).length;
  zip.file('readme.txt', [
    options.title,
    '',
    `Trip timezone: ${options.timezone}`,
    `${days.length} day${days.length === 1 ? '' : 's'} exported.`,
    `${unresolved} photo${unresolved === 1 ? '' : 's'} have no independently assigned position.`,
    unresolvedTime ? `${unresolvedTime} camera time${unresolvedTime === 1 ? '' : 's'} remain unresolved; generated GPX omits those timestamps.` : '',
    conflicts ? `${conflicts} photo${conflicts === 1 ? '' : 's'} still need a location choice.` : '',
    '',
    'journey.gpx, journey.geojson, and journey.json cover the complete journey.',
    'days/ contains one independent GPX per calendar day, including Undated when needed.',
    'recordings/ contains one generated waypoint GPX and one unchanged original per source.',
    options.includePhotos ? 'photos/ contains the original photo files, unmodified.' : '',
  ].filter(Boolean).join('\n'));
  return zip.generateAsync({ type: 'blob', compression: 'STORE' });
}
