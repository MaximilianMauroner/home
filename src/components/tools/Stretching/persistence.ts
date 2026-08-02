import type { Stretch, StretchRoutine } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

function isStretch(value: unknown): value is Stretch {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.description === "string" &&
    typeof value.duration === "number" &&
    Number.isFinite(value.duration) &&
    typeof value.repetitions === "number" &&
    Number.isFinite(value.repetitions) &&
    (value.image === undefined || typeof value.image === "string") &&
    typeof value.how === "string" &&
    typeof value.lookFor === "string" &&
    (value.targetAreas === undefined || isStringArray(value.targetAreas))
  );
}

function isStretchRoutine(value: unknown): value is StretchRoutine {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.goal === "string" &&
    typeof value.totalDuration === "number" &&
    Number.isFinite(value.totalDuration) &&
    Array.isArray(value.stretches) &&
    value.stretches.every(isStretch) &&
    (value.category === undefined ||
      value.category === "posture-correction" ||
      value.category === "pain-relief" ||
      value.category === "mobility" ||
      value.category === "flexibility" ||
      value.category === "warm-up" ||
      value.category === "recovery") &&
    (value.difficulty === undefined ||
      value.difficulty === "beginner" ||
      value.difficulty === "intermediate" ||
      value.difficulty === "advanced") &&
    (value.tags === undefined || isStringArray(value.tags))
  );
}

function parseStoredJson(value: string | null): unknown {
  if (value === null) return null;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function parseStoredStretches(value: string | null): Stretch[] | null {
  const parsed = parseStoredJson(value);
  return Array.isArray(parsed) && parsed.length > 0 && parsed.every(isStretch)
    ? parsed
    : null;
}

export function parseStoredCustomRoutines(
  value: string | null,
): StretchRoutine[] {
  const parsed = parseStoredJson(value);
  return Array.isArray(parsed) && parsed.every(isStretchRoutine) ? parsed : [];
}

export function parseStoredRestDuration(
  value: string | null,
  fallback = 10,
): number {
  if (value === null) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}
