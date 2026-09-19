import { normalizeTimezone } from "./days";
import { isValidUtcOffsetMinutes } from "./metadata";
import type { PlacementChoice } from "./track";
import type { JourneyPhoto, JourneyRecording } from "./types";

export const PROJECT_MANIFEST_FILENAME = "photo-journey-project.json";
export const PROJECT_SCHEMA_VERSION = 2 as const;

export type ProjectPhotoIdentity = {
  fileName: string;
  fileSize: number;
  /** Zero-based position among files with the same name and byte size. */
  occurrence: number;
};

export type ProjectPhotoDecision = {
  identity: ProjectPhotoIdentity;
  clockOffsetMinutes?: number;
  /** Stable identity of the GPX selected when recordings overlap. */
  selectedRecordingDigest?: string;
  /** Whether this original participates in the presented journey. */
  shown?: boolean;
};

export type ProjectRecordingDecision = {
  digest: string;
  included: boolean;
};

export type PhotoJourneyProjectManifest = {
  schemaVersion: 1 | typeof PROJECT_SCHEMA_VERSION;
  title: string;
  timezone: string;
  order: "capture" | "manual";
  /** Array order is the saved photo order. */
  photos: ProjectPhotoDecision[];
  recordings: ProjectRecordingDecision[];
  photoSelectionMode?: "automatic" | "all";
};

export type CreateProjectManifestOptions = {
  title: string;
  timezone: string;
  order: PhotoJourneyProjectManifest["order"];
  photos: readonly JourneyPhoto[];
  recordings: readonly JourneyRecording[];
  offsetMinutesByPhoto?: Readonly<Record<string, number | undefined>>;
  recordingChoices?: Readonly<Record<string, PlacementChoice | undefined>>;
  shownByPhoto?: Readonly<Record<string, boolean | undefined>>;
  showAllPhotos?: boolean;
};

function fileIdentityKey(file: Pick<File, "name" | "size">) {
  return `${file.name}\u0000${file.size}`;
}

export function createProjectManifest(
  options: CreateProjectManifestOptions,
): PhotoJourneyProjectManifest {
  const recordingDigestById = new Map(
    options.recordings
      .filter((recording) => recording.included)
      .map((recording) => [recording.id, recording.digest]),
  );
  const occurrences = new Map<string, number>();
  const photos = options.photos.map((photo): ProjectPhotoDecision => {
    const key = fileIdentityKey(photo.file);
    const occurrence = occurrences.get(key) ?? 0;
    occurrences.set(key, occurrence + 1);
    const offset = options.offsetMinutesByPhoto?.[photo.id];
    const choice = options.recordingChoices?.[photo.id];
    const selectedRecordingDigest =
      typeof choice === "object"
        ? recordingDigestById.get(choice.recordingId)
        : undefined;
    return {
      identity: {
        fileName: photo.file.name,
        fileSize: photo.file.size,
        occurrence,
      },
      ...(isValidUtcOffsetMinutes(offset)
        ? { clockOffsetMinutes: offset }
        : {}),
      ...(selectedRecordingDigest ? { selectedRecordingDigest } : {}),
      ...(options.shownByPhoto?.[photo.id] !== undefined
        ? { shown: options.shownByPhoto[photo.id] }
        : {}),
    };
  });

  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    title: options.title.slice(0, 120),
    timezone: normalizeTimezone(options.timezone),
    order: options.order,
    photos,
    recordings: options.recordings.map(({ digest, included }) => ({
      digest,
      included,
    })),
    photoSelectionMode: options.showAllPhotos ? "all" : "automatic",
  };
}

export function serializeProjectManifest(
  manifest: PhotoJourneyProjectManifest,
) {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBoundedString(
  value: unknown,
  maxLength: number,
  allowEmpty = false,
): value is string {
  return (
    typeof value === "string" &&
    value.length <= maxLength &&
    (allowEmpty || value.length > 0)
  );
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isTimezone(value: unknown): value is string {
  if (!isBoundedString(value, 120)) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

function parsePhotoDecision(value: unknown): ProjectPhotoDecision | undefined {
  if (!isRecord(value) || !isRecord(value.identity)) return undefined;
  const { fileName, fileSize, occurrence } = value.identity;
  if (
    !isBoundedString(fileName, 1_000) ||
    !isNonNegativeInteger(fileSize) ||
    !isNonNegativeInteger(occurrence)
  )
    return undefined;
  const offset = value.clockOffsetMinutes;
  if (offset !== undefined && !isValidUtcOffsetMinutes(offset))
    return undefined;
  const selectedRecordingDigest = value.selectedRecordingDigest;
  if (
    selectedRecordingDigest !== undefined &&
    !isBoundedString(selectedRecordingDigest, 256)
  )
    return undefined;
  if (value.shown !== undefined && typeof value.shown !== "boolean")
    return undefined;
  return {
    identity: { fileName, fileSize, occurrence },
    ...(offset !== undefined ? { clockOffsetMinutes: offset } : {}),
    ...(selectedRecordingDigest !== undefined
      ? { selectedRecordingDigest }
      : {}),
    ...(value.shown !== undefined ? { shown: value.shown } : {}),
  };
}

function parseRecordingDecision(
  value: unknown,
): ProjectRecordingDecision | undefined {
  if (
    !isRecord(value) ||
    !isBoundedString(value.digest, 256) ||
    typeof value.included !== "boolean"
  )
    return undefined;
  return { digest: value.digest, included: value.included };
}

/** Parses an untrusted manifest. Unsupported versions and malformed data are ignored safely. */
export function parseProjectManifest(
  input: unknown,
): PhotoJourneyProjectManifest | undefined {
  let value = input;
  if (typeof input === "string") {
    try {
      value = JSON.parse(input);
    } catch {
      return undefined;
    }
  }
  if (
    !isRecord(value) ||
    (value.schemaVersion !== 1 &&
      value.schemaVersion !== PROJECT_SCHEMA_VERSION)
  )
    return undefined;
  if (!isBoundedString(value.title, 120, true) || !isTimezone(value.timezone))
    return undefined;
  if (value.order !== "capture" && value.order !== "manual") return undefined;
  if (!Array.isArray(value.photos) || !Array.isArray(value.recordings))
    return undefined;
  if (
    value.photoSelectionMode !== undefined &&
    value.photoSelectionMode !== "automatic" &&
    value.photoSelectionMode !== "all"
  )
    return undefined;

  const photos: ProjectPhotoDecision[] = [];
  const photoKeys = new Set<string>();
  for (const entry of value.photos) {
    const photo = parsePhotoDecision(entry);
    if (!photo) return undefined;
    const key = `${fileIdentityKey({ name: photo.identity.fileName, size: photo.identity.fileSize })}\u0000${photo.identity.occurrence}`;
    if (photoKeys.has(key)) return undefined;
    photoKeys.add(key);
    photos.push(photo);
  }

  const recordings: ProjectRecordingDecision[] = [];
  const recordingDigests = new Set<string>();
  for (const entry of value.recordings) {
    const recording = parseRecordingDecision(entry);
    if (!recording || recordingDigests.has(recording.digest)) return undefined;
    recordingDigests.add(recording.digest);
    recordings.push(recording);
  }
  const includedRecordingDigests = new Set(
    recordings.filter(({ included }) => included).map(({ digest }) => digest),
  );
  if (
    photos.some(
      (photo) =>
        photo.selectedRecordingDigest &&
        !includedRecordingDigests.has(photo.selectedRecordingDigest),
    )
  )
    return undefined;

  return {
    schemaVersion: value.schemaVersion,
    title: value.title,
    timezone: value.timezone,
    order: value.order,
    photos,
    recordings,
    ...(value.photoSelectionMode
      ? { photoSelectionMode: value.photoSelectionMode }
      : {}),
  };
}

export type RestoredProjectManifest = {
  title: string;
  timezone: string;
  order: PhotoJourneyProjectManifest["order"];
  photos: JourneyPhoto[];
  recordings: JourneyRecording[];
  offsetMinutesByPhoto: Record<string, number>;
  recordingChoices: Record<string, { source: "track"; recordingId: string }>;
  shownByPhoto: Record<string, boolean>;
  showAllPhotos: boolean;
  unmatchedPhotoCount: number;
  unmatchedRecordingCount: number;
};

/** Applies stable file/digest identities to newly imported objects with fresh runtime IDs. */
export function restoreProjectManifest(
  manifest: PhotoJourneyProjectManifest,
  photos: readonly JourneyPhoto[],
  recordings: readonly JourneyRecording[],
): RestoredProjectManifest {
  const photoGroups = new Map<string, JourneyPhoto[]>();
  for (const photo of photos) {
    const key = fileIdentityKey(photo.file);
    const group = photoGroups.get(key);
    if (group) group.push(photo);
    else photoGroups.set(key, [photo]);
  }
  const recordingByDigest = new Map(
    recordings.map((recording) => [recording.digest, recording]),
  );
  const recordingDecisionByDigest = new Map(
    manifest.recordings.map((recording) => [recording.digest, recording]),
  );
  const matchedPhotoIds = new Set<string>();
  const restoredPhotos: JourneyPhoto[] = [];
  const offsetMinutesByPhoto: Record<string, number> = {};
  const recordingChoices: RestoredProjectManifest["recordingChoices"] = {};
  const shownByPhoto: Record<string, boolean> = {};
  let unmatchedPhotoCount = 0;

  for (const decision of manifest.photos) {
    const key = fileIdentityKey({
      name: decision.identity.fileName,
      size: decision.identity.fileSize,
    });
    const photo = photoGroups.get(key)?.[decision.identity.occurrence];
    if (!photo || matchedPhotoIds.has(photo.id)) {
      unmatchedPhotoCount += 1;
      continue;
    }
    matchedPhotoIds.add(photo.id);
    restoredPhotos.push(photo);
    if (decision.clockOffsetMinutes !== undefined)
      offsetMinutesByPhoto[photo.id] = decision.clockOffsetMinutes;
    if (decision.shown !== undefined) shownByPhoto[photo.id] = decision.shown;
    if (decision.selectedRecordingDigest) {
      const recording = recordingByDigest.get(decision.selectedRecordingDigest);
      if (recording)
        recordingChoices[photo.id] = {
          source: "track",
          recordingId: recording.id,
        };
    }
  }
  restoredPhotos.push(
    ...photos.filter((photo) => !matchedPhotoIds.has(photo.id)),
  );

  return {
    title: manifest.title,
    timezone: manifest.timezone,
    order: manifest.order,
    photos: restoredPhotos,
    recordings: recordings.map((recording) => {
      const decision = recordingDecisionByDigest.get(recording.digest);
      return decision
        ? { ...recording, included: decision.included }
        : recording;
    }),
    offsetMinutesByPhoto,
    recordingChoices,
    shownByPhoto,
    showAllPhotos:
      manifest.schemaVersion === 1 || manifest.photoSelectionMode === "all",
    unmatchedPhotoCount,
    unmatchedRecordingCount: manifest.recordings.filter(
      ({ digest }) => !recordingByDigest.has(digest),
    ).length,
  };
}
