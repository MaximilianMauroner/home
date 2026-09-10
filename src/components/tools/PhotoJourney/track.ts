import { pointAtTime, type Track } from "./gpx";
import { distanceKm, type JourneyStop } from "./timeline";
import type { Coordinates, JourneyPhoto, PhotoMetadata } from "./types";

/**
 * A recorded track is the better witness. A watch logs continuously with a clear sky view, while a
 * phone fixes once, indoors or under a cliff, and can be far out. So when the two disagree by more
 * than this, the photo is placed by its timecode on the track instead of by its own coordinates.
 */
export const DISCREPANCY_LIMIT_M = 60;
/** Beyond this the track was not recording when the photo was taken, so it cannot place it. */
export const COVERAGE_LIMIT_SECONDS = 150;

export type PlacementSource =
  /** The photo's own GPS, which agrees with the track or has no track to check against. */
  | "photo"
  /** The track position at the photo's timecode. */
  | "track"
  /** No position of its own; holds the last known one so the camera does not jump. */
  | "carried"
  | "none";

export type Placement = {
  photoId: string;
  coordinates?: Coordinates;
  source: PlacementSource;
  /** Metres between the photo's own fix and the track at that instant, when both exist. */
  discrepancyM?: number;
  /** Seconds between the photo's timecode and the nearest recorded fix. */
  gapSeconds?: number;
  elevation?: number;
  /**
   * The instant the shutter fired, once the zone is known. EXIF holds only a wall clock, so this
   * is the only time worth writing out: a photo library re-tagging from the exported GPX has to
   * match the same instants the track was recorded in.
   */
  instant?: number;
};

/**
 * EXIF stores wall-clock time with no zone. `capturedAt` is that clock read in the viewer's own
 * zone, so both are removed here to recover the instant the shutter actually fired.
 */
export function photoInstant(metadata: PhotoMetadata, fallbackOffsetMinutes?: number) {
  const captured = metadata.capturedAt;
  if (!captured) return undefined;
  const offset = metadata.utcOffsetMinutes ?? fallbackOffsetMinutes;
  if (offset === undefined) return undefined;
  return captured.getTime() - captured.getTimezoneOffset() * 60_000 - offset * 60_000;
}

/**
 * Every zone in use is a whole hour, a half hour, or one of three quarter-hour zones. A free
 * 15-minute grid lets the fit slide along the track to absorb a bad fix instead of finding the
 * clock, so only real offsets are offered.
 */
const CANDIDATE_OFFSETS = (() => {
  const offsets = new Set([5 * 60 + 45, 8 * 60 + 45, 12 * 60 + 45]);
  for (let minutes = -12 * 60; minutes <= 14 * 60; minutes += 30) offsets.add(minutes);
  return [...offsets].sort((a, b) => a - b);
})();

/**
 * A phone fix is either close or badly wrong, so an average over all of them says little. At the
 * true offset the well-fixed photos land on the track almost exactly, so the better half of the
 * errors identifies the clock and one indoor fix cannot drag the answer away.
 */
function betterHalfMean(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const half = sorted.slice(0, Math.max(1, Math.ceil(sorted.length / 2)));
  return half.reduce((total, value) => total + value, 0) / half.length;
}

/**
 * Cameras that write no time-zone tag leave the clock ambiguous by whole hours. Photos that do
 * carry GPS reveal the answer: only the true offset puts them where the track says they were.
 */
export function inferUtcOffsetMinutes(photos: readonly JourneyPhoto[], track: Track) {
  const stated = photos.find((photo) => photo.metadata.utcOffsetMinutes !== undefined);
  if (stated) return stated.metadata.utcOffsetMinutes;
  const located = photos.filter(
    (photo) => photo.metadata.capturedAt && photo.metadata.coordinates,
  );
  let best: { offset: number; score: number } | undefined;
  for (const offset of CANDIDATE_OFFSETS) {
    const errors: number[] = [];
    let covered = 0;
    for (const photo of photos) {
      const instant = photoInstant(photo.metadata, offset);
      if (instant === undefined) continue;
      const found = pointAtTime(track, instant);
      if (!found || found.gapMs > COVERAGE_LIMIT_SECONDS * 1000) continue;
      covered += 1;
      const own = photo.metadata.coordinates;
      if (own) errors.push(distanceKm(own, found.point) * 1000);
    }
    if (!covered) continue;
    // With located photos, trust the fit. Without any, prefer the offset that lands the most
    // photos inside the recording at all.
    const score = located.length
      ? (errors.length ? betterHalfMean(errors) : Number.POSITIVE_INFINITY)
      : -covered;
    if (!best || score < best.score) best = { offset, score };
  }
  return best?.offset;
}

/**
 * Decides where every photo sits. Order of authority: an agreeing pair keeps the photo's own fix,
 * a disagreeing pair or a missing fix takes the track, and anything the track cannot reach falls
 * back to the photo, then to the position carried forward from the stop before it.
 */
export function resolvePlacements(
  photos: readonly JourneyPhoto[],
  track?: Track,
  options: { offsetMinutes?: number; discrepancyLimitM?: number } = {},
): Placement[] {
  const limit = options.discrepancyLimitM ?? DISCREPANCY_LIMIT_M;
  const offset = options.offsetMinutes;
  let carried: Coordinates | undefined;
  return photos.map((photo) => {
    const own = photo.metadata.coordinates;
    const instant = track ? photoInstant(photo.metadata, offset) : undefined;
    const found = instant === undefined || !track ? undefined : pointAtTime(track, instant);
    const covered = found && found.gapMs <= COVERAGE_LIMIT_SECONDS * 1000;
    if (covered && found) {
      const onTrack = { latitude: found.point.latitude, longitude: found.point.longitude };
      const discrepancyM = own ? distanceKm(own, onTrack) * 1000 : undefined;
      const useTrack = !own || (discrepancyM ?? 0) > limit;
      const coordinates = useTrack ? onTrack : own;
      carried = coordinates;
      return {
        photoId: photo.id,
        coordinates,
        source: useTrack ? "track" : "photo",
        discrepancyM,
        gapSeconds: found.gapMs / 1000,
        elevation: useTrack ? found.point.elevation : photo.metadata.altitude,
        instant,
      };
    }
    if (own) {
      carried = own;
      return { photoId: photo.id, coordinates: own, source: "photo", elevation: photo.metadata.altitude, instant };
    }
    return {
      photoId: photo.id,
      coordinates: carried,
      source: carried ? "carried" : "none",
      instant,
    };
  });
}

/**
 * The camera's view of the same decision. A carried position keeps the map still on a stop that
 * could not be placed, rather than sending it to 0°, 0°.
 */
export function journeyStops(placements: readonly Placement[]): JourneyStop[] {
  return placements.map((placement) => ({
    photoId: placement.photoId,
    coordinates: placement.coordinates,
    located: placement.source === "photo" || placement.source === "track",
  }));
}

export function placementSummary(placements: readonly Placement[]) {
  const corrected = placements.filter((placement) => placement.source === "track" && placement.discrepancyM !== undefined);
  return {
    fromTrack: placements.filter((placement) => placement.source === "track").length,
    fromPhoto: placements.filter((placement) => placement.source === "photo").length,
    unplaced: placements.filter((placement) => placement.source !== "track" && placement.source !== "photo").length,
    correctedCount: corrected.length,
    worstCorrectionM: corrected.reduce((worst, placement) => Math.max(worst, placement.discrepancyM ?? 0), 0),
  };
}
