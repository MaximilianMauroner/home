import { MAX_FILES, MAX_TOTAL_BYTES, supportsPhoto } from './metadata';
import type { JourneyPhoto } from './types';

export function isTrackFile(file: Pick<File, 'name' | 'type'>) {
  return /\.gpx$/i.test(file.name) || /gpx\+xml$/i.test(file.type);
}

export function acceptFiles(files: readonly File[], existing: readonly JourneyPhoto[]) {
  const accepted: File[] = [];
  const tracks: File[] = [];
  const skipped: { file: File; reason: string }[] = [];
  let bytes = existing.reduce((sum, photo) => sum + photo.file.size, 0);
  for (const file of files) {
    if (isTrackFile(file)) {
      tracks.push(file);
      continue;
    }
    let reason: string | undefined;
    if (!supportsPhoto(file)) reason = 'unsupported image format';
    else if (existing.length + accepted.length >= MAX_FILES) reason = '100-photo limit';
    else if (bytes + file.size > MAX_TOTAL_BYTES) reason = '500 MB total limit';
    if (reason) skipped.push({ file, reason });
    else { accepted.push(file); bytes += file.size; }
  }
  return { accepted, tracks, skipped };
}
