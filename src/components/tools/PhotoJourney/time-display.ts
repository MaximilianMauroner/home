import { normalizeTimezone } from "./days";
import { isValidUtcOffsetMinutes } from "./metadata";
import type { PhotoMetadata } from "./types";

export type DisplayMoment = {
  instant: number;
  timeZone: string;
};

/** Convert an absolute instant to a value that Intl can render at a fixed camera offset. */
export function localDisplayMoment(
  instant: number,
  offsetMinutes: number | undefined,
  fallbackTimezone: string,
): DisplayMoment {
  return isValidUtcOffsetMinutes(offsetMinutes)
    ? {
        instant: instant + offsetMinutes * 60_000,
        timeZone: "UTC",
      }
    : { instant, timeZone: normalizeTimezone(fallbackTimezone) };
}

/** Prefer the camera's literal wall clock so a remote/browser timezone cannot change its label. */
export function photoDisplayMoment(
  metadata: Pick<PhotoMetadata, "capturedAtWallClock">,
  instant: number | undefined,
  offsetMinutes: number | undefined,
  fallbackTimezone: string,
): DisplayMoment | undefined {
  if (metadata.capturedAtWallClock) {
    const wallClock = Date.parse(`${metadata.capturedAtWallClock}Z`);
    if (Number.isFinite(wallClock))
      return { instant: wallClock, timeZone: "UTC" };
  }
  return instant === undefined
    ? undefined
    : localDisplayMoment(instant, offsetMinutes, fallbackTimezone);
}
