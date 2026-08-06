import { describe, expect, test } from "vitest";
import {
  CLIP_THRESHOLD,
  FREQUENCY_GATE_DBFS,
  MIN_DBFS,
  amplitudeToDbfs,
  calculateTimeDomainMetrics,
  findDominantFrequency,
  nearestNote,
} from "../src/components/tools/MicrophoneTester/audioMetrics";

describe("microphone audio metrics", () => {
  test("converts amplitude to bounded dBFS", () => {
    expect(amplitudeToDbfs(1)).toBe(0);
    expect(amplitudeToDbfs(0.5)).toBeCloseTo(-6.0206, 3);
    expect(amplitudeToDbfs(0)).toBe(MIN_DBFS);
    expect(amplitudeToDbfs(Number.NaN)).toBe(MIN_DBFS);
  });

  test("calculates RMS, peak, and clipping from time-domain samples", () => {
    const healthy = calculateTimeDomainMetrics(
      Float32Array.from([0.5, -0.5, 0.5, -0.5]),
    );
    expect(healthy.rmsDbfs).toBeCloseTo(-6.0206, 3);
    expect(healthy.peakDbfs).toBeCloseTo(-6.0206, 3);
    expect(healthy.clipped).toBe(false);

    const clipped = calculateTimeDomainMetrics(
      Float32Array.from([0, CLIP_THRESHOLD, -1]),
    );
    expect(clipped.peakDbfs).toBe(0);
    expect(clipped.clipped).toBe(true);
  });

  test("gates dominant frequency below the usable signal level", () => {
    const spectrum = new Float32Array(2048).fill(-100);
    spectrum[38] = -20;
    expect(
      findDominantFrequency(spectrum, 48_000, 4096, FREQUENCY_GATE_DBFS - 0.1),
    ).toBeNull();
  });

  test("interpolates the dominant FFT bin", () => {
    const spectrum = new Float32Array(2048).fill(-100);
    spectrum[37] = -32;
    spectrum[38] = -20;
    spectrum[39] = -36;
    const frequency = findDominantFrequency(spectrum, 48_000, 4096, -18);
    expect(frequency).not.toBeNull();
    expect(frequency!).toBeGreaterThan(438);
    expect(frequency!).toBeLessThan(450);
  });

  test("reports the nearest note and cent offset", () => {
    expect(nearestNote(440)).toEqual({ label: "A4", cents: 0 });
    expect(nearestNote(null)).toBeNull();
  });
});
