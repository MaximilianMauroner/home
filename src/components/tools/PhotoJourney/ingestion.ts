import { MAX_FILES, MAX_TOTAL_BYTES, supportsPhoto } from './metadata';
import type { JourneyPhoto } from './types';

/** Provisional safety limits for source recordings; validate before DOM parsing. */
export const MAX_GPX_BYTES = 20 * 1024 * 1024;
export const MAX_GPX_POINTS = 250_000;
export const MAX_GPX_TOTAL_BYTES = 200 * 1024 * 1024;

export function isTrackFile(file: Pick<File, 'name' | 'type'>) {
  return /\.gpx$/i.test(file.name) || /gpx\+xml$/i.test(file.type);
}

export async function digestFile(file: Pick<File, 'arrayBuffer'>) {
  const bytes = await file.arrayBuffer();
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    const digest = await subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
  }
  // HTTP development origins do not expose SubtleCrypto. Keep duplicate detection useful there
  // without making the local tool fail; production HTTPS uses the stronger SHA-256 path above.
  const values = new Uint8Array(bytes);
  let first = 2166136261;
  let second = 2166136261 ^ 0x9e3779b9;
  for (const value of values) {
    first = Math.imul(first ^ value, 16777619);
    second = Math.imul(second ^ value, 2246822519);
  }
  return `fallback-${(first >>> 0).toString(16)}-${(second >>> 0).toString(16)}-${values.length}`;
}

/** Confirms a digest match byte-for-byte, including the HTTP fallback hash path. */
export async function filesEqual(
  first: Pick<File, 'size' | 'arrayBuffer'>,
  second: Pick<File, 'size' | 'arrayBuffer'>,
) {
  if (first.size !== second.size) return false;
  const [a, b] = await Promise.all([first.arrayBuffer(), second.arrayBuffer()]);
  const left = new Uint8Array(a);
  const right = new Uint8Array(b);
  for (let index = 0; index < left.length; index += 1) if (left[index] !== right[index]) return false;
  return true;
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
