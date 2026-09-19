import type { JourneyPhoto, PhotoVisualFeatures } from "./types";

export type SimilarPhotoScore = {
  photoId: string;
  score: number;
  reason: string;
  faceCount: number;
};

export type SimilarPhotoGroup = {
  id: string;
  photoIds: string[];
  recommendedId?: string;
  scores?: SimilarPhotoScore[];
};

export type SimilarPhotoOverride = {
  representativeId?: string;
  keepAll?: boolean;
};

function hamming(left: string, right: string) {
  if (!left || left.length !== right.length) return Infinity;
  let total = 0;
  for (let index = 0; index < left.length; index += 1)
    if (left[index] !== right[index]) total += 1;
  return total;
}

function signatureError(left: PhotoVisualFeatures, right: PhotoVisualFeatures) {
  if (
    left.signature.length !== 64 ||
    right.signature.length !== left.signature.length
  )
    return Infinity;
  let total = 0;
  for (let index = 0; index < left.signature.length; index += 1) {
    const difference = left.signature[index] - right.signature[index];
    total += difference * difference;
  }
  return Math.sqrt(total / left.signature.length);
}

function distanceM(first: JourneyPhoto, second: JourneyPhoto) {
  const a = first.metadata.coordinates;
  const b = second.metadata.coordinates;
  if (!a || !b) return undefined;
  const radians = Math.PI / 180;
  const latitude = ((a.latitude + b.latitude) / 2) * radians;
  const x = (b.longitude - a.longitude) * radians * Math.cos(latitude);
  const y = (b.latitude - a.latitude) * radians;
  return Math.sqrt(x * x + y * y) * 6_371_000;
}

/** Conservative equality for repeated frames, invariant to import/manual order. */
export function areSimilarPhotos(first: JourneyPhoto, second: JourneyPhoto) {
  const left = first.visualFeatures;
  const right = second.visualFeatures;
  if (!left || !right) return false;
  const firstTime = first.metadata.capturedAt?.getTime();
  const secondTime = second.metadata.capturedAt?.getTime();
  if (firstTime === undefined || secondTime === undefined) return false;
  if (Math.abs(firstTime - secondTime) > 120_000) return false;
  const distance = distanceM(first, second);
  if (distance !== undefined && distance > 50) return false;
  return (
    hamming(left.differenceHash, right.differenceHash) <= 13 &&
    signatureError(left, right) <= 0.17
  );
}

/** Complete-link groups prevent A≈B≈C chains from hiding a distinct endpoint. */
export function findSimilarPhotoGroups(
  photos: readonly JourneyPhoto[],
): SimilarPhotoGroup[] {
  const stable = [...photos].sort(
    (a, b) =>
      (a.metadata.capturedAt?.getTime() ?? Infinity) -
        (b.metadata.capturedAt?.getTime() ?? Infinity) ||
      a.importOrder - b.importOrder ||
      a.id.localeCompare(b.id),
  );
  const groups: JourneyPhoto[][] = [];
  for (const photo of stable) {
    const group = groups.find((candidate) =>
      candidate.every((member) => areSimilarPhotos(photo, member)),
    );
    if (group) group.push(photo);
    else groups.push([photo]);
  }
  return groups
    .filter((group) => group.length > 1)
    .map((group) => ({
      id: group
        .map((photo) => photo.id)
        .sort()
        .join("\u0001"),
      photoIds: group.map((photo) => photo.id),
    }));
}

export function shownPhotoIds(
  photos: readonly JourneyPhoto[],
  groups: readonly SimilarPhotoGroup[],
  overrides: Readonly<Record<string, SimilarPhotoOverride | undefined>>,
  persisted: Readonly<Record<string, boolean | undefined>>,
  showAll: boolean,
) {
  const shown = new Set(photos.map((photo) => photo.id));
  if (showAll) return shown;
  for (const group of groups) {
    const restored = group.photoIds.some(
      (photoId) => persisted[photoId] !== undefined,
    );
    if (restored) {
      for (const photoId of group.photoIds)
        if (persisted[photoId] === false) shown.delete(photoId);
      continue;
    }
    const override = overrides[group.id];
    if (override?.keepAll || !group.recommendedId) continue;
    const representative = override?.representativeId ?? group.recommendedId;
    for (const photoId of group.photoIds)
      if (photoId !== representative) shown.delete(photoId);
  }
  for (const [photoId, visible] of Object.entries(persisted)) {
    if (visible) shown.add(photoId);
    else shown.delete(photoId);
  }
  return shown;
}

export function groupForPhoto(
  groups: readonly SimilarPhotoGroup[],
  photoId: string,
) {
  return groups.find((group) => group.photoIds.includes(photoId));
}
