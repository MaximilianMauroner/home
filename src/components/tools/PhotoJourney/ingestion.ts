import { MAX_FILES, MAX_TOTAL_BYTES, supportsPhoto } from './metadata';
import type { JourneyPhoto } from './types';

/** Provisional safety limits for source recordings; validate before DOM parsing. */
export const MAX_GPX_BYTES = 20 * 1024 * 1024;
export const MAX_GPX_POINTS = 250_000;
export const MAX_GPX_TOTAL_BYTES = 200 * 1024 * 1024;
/** Bound the data we actually materialize; exported ZIPs may also contain ignored generated copies. */
export const MAX_ARCHIVE_UNCOMPRESSED_BYTES = 4 * 1024 * 1024 * 1024;
export const MAX_ARCHIVE_ENTRIES = MAX_FILES + 500;

export function isTrackFile(file: Pick<File, 'name' | 'type'>) {
  return /\.gpx$/i.test(file.name) || /gpx\+xml$/i.test(file.type);
}

export function isArchiveFile(file: Pick<File, 'name' | 'type'>) {
  return /\.zip$/i.test(file.name) || /zip/i.test(file.type);
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
    if (isArchiveFile(file)) {
      // Archives are expanded before this step. Reaching here means expansion failed.
      skipped.push({ file, reason: 'could not be read as a ZIP' });
      continue;
    }
    if (isTrackFile(file)) {
      tracks.push(file);
      continue;
    }
    let reason: string | undefined;
    if (!supportsPhoto(file)) reason = 'unsupported image format';
    else if (existing.length + accepted.length >= MAX_FILES) reason = `${MAX_FILES}-photo limit`;
    else if (bytes + file.size > MAX_TOTAL_BYTES) reason = '4 GB total limit';
    if (reason) skipped.push({ file, reason });
    else { accepted.push(file); bytes += file.size; }
  }
  return { accepted, tracks, skipped };
}

function mimeForFilename(name: string) {
  if (/\.gpx$/i.test(name)) return 'application/gpx+xml';
  if (/\.(jpe?g)$/i.test(name)) return 'image/jpeg';
  if (/\.png$/i.test(name)) return 'image/png';
  if (/\.webp$/i.test(name)) return 'image/webp';
  if (/\.hei[cf]$/i.test(name)) return 'image/heic';
  return '';
}

function bundleEntryName(path: string) {
  const base = path.split('/').pop() ?? path;
  // Bundles prefix photos as `01-original.jpg` to keep them ordered.
  if (/^photos\//i.test(path)) return base.replace(/^\d{2,}-/, '') || base;
  // Scoped bundles keep the source as `walk-original.gpx` next to the generated `walk.gpx`.
  if (/-original\.gpx$/i.test(base)) return base.replace(/-original\.gpx$/i, '.gpx');
  return base;
}

function isIgnorableEntry(path: string) {
  if (/(^|\/)__MACOSX\//.test(path)) return true;
  const base = path.split('/').pop() ?? path;
  return base === '.DS_Store' || base === 'Thumbs.db' || base.startsWith('._') ||
    /^readme\.txt$/i.test(base) || /\.(json|geojson)$/i.test(base);
}

/**
 * An exported bundle holds the same photos and recordings plus generated
 * `journey.gpx`, `days/`, and `recordings/` copies. Importing every GPX would
 * record the same route two or three times, so prefer the untouched sources.
 */
function selectJourneyGpx(paths: readonly string[]) {
  const originals = paths.filter((path) => /-original\.gpx$/i.test(path));
  if (originals.length) return new Set(originals);
  const rootJourney = paths.find((path) => /^journey\.gpx$/i.test(path) && !path.includes('/'));
  if (rootJourney && paths.some((path) => /^(days|recordings)\//i.test(path))) return new Set([rootJourney]);
  return new Set(paths);
}

export type ExpandedArchive = {
  files: File[];
  bundleTitle?: string;
};

/**
 * Unpacks journey ZIP bundles (and plain zips of photos/GPX) into importable
 * files. Generated exports are skipped in favour of the original recordings;
 * `journey.json` supplies the title so a re-import keeps its name.
 */
export async function expandJourneyArchives(archives: readonly File[]): Promise<{ expanded: ExpandedArchive; skipped: { file: File; reason: string }[] }> {
  const { default: JSZip } = await import('jszip');
  const files: File[] = [];
  const skipped: { file: File; reason: string }[] = [];
  let bundleTitle: string | undefined;
  let uncompressedBytes = 0;

  for (const archive of archives) {
    let zip: Awaited<ReturnType<typeof JSZip.loadAsync>>;
    try {
      // ArrayBuffer works in browsers and in Node tests, where JSZip cannot read Blob/File inputs.
      zip = await JSZip.loadAsync(await archive.arrayBuffer());
    } catch {
      skipped.push({ file: archive, reason: 'could not be read as a ZIP' });
      continue;
    }
    const entries = Object.values(zip.files).filter((entry) => !entry.dir);
    const candidates = entries.filter((entry) => !isIgnorableEntry(entry.name));
    const gpxPaths = candidates.filter((entry) => /\.gpx$/i.test(entry.name)).map((entry) => entry.name);
    const wantedGpx = selectJourneyGpx(gpxPaths);
    const selected = candidates.filter((entry) => {
      const isGpx = /\.gpx$/i.test(entry.name);
      if (isGpx) return wantedGpx.has(entry.name);
      const name = bundleEntryName(entry.name);
      return supportsPhoto({ name, type: mimeForFilename(name) });
    });
    if (selected.length > MAX_ARCHIVE_ENTRIES) {
      skipped.push({ file: archive, reason: `ZIP exceeds the ${MAX_ARCHIVE_ENTRIES} importable file limit` });
      continue;
    }
    let usable = 0;

    for (const entry of selected) {
      const isGpx = /\.gpx$/i.test(entry.name);
      const name = bundleEntryName(entry.name);
      const type = isGpx ? 'application/gpx+xml' : mimeForFilename(name);
      try {
        const bytes = await entry.async('uint8array');
        uncompressedBytes += bytes.byteLength;
        if (uncompressedBytes > MAX_ARCHIVE_UNCOMPRESSED_BYTES) {
          skipped.push({ file: archive, reason: `ZIP contents exceed the ${Math.round(MAX_ARCHIVE_UNCOMPRESSED_BYTES / 1024 / 1024)} MB limit` });
          break;
        }
        usable += 1;
        files.push(new File([bytes as BlobPart], name, { type: type || undefined, lastModified: entry.date?.valueOf() ?? archive.lastModified }));
      } catch {
        skipped.push({ file: new File([], name), reason: `could not be read from ${archive.name}` });
      }
    }

    if (!usable && !skipped.some((entry) => entry.file === archive)) {
      skipped.push({ file: archive, reason: 'no photos or GPX found in this ZIP' });
      continue;
    }

    if (!bundleTitle) {
      const manifest = entries.find((entry) => !entry.dir && /(^|\/)journey\.json$/i.test(entry.name));
      if (manifest) {
        try {
          const parsed = JSON.parse(await manifest.async('string')) as { title?: unknown };
          if (typeof parsed.title === 'string' && parsed.title.trim()) bundleTitle = parsed.title.trim().slice(0, 120);
        } catch { /* A hand-made zip keeps its files even without a readable manifest. */ }
      }
    }
  }

  return { expanded: { files, bundleTitle }, skipped };
}
