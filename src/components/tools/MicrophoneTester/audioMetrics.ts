export const MIN_DBFS = -96;
export const CLIP_THRESHOLD = 0.99;
export const FREQUENCY_GATE_DBFS = -60;

export interface TimeDomainMetrics {
  rmsDbfs: number;
  peakDbfs: number;
  clipped: boolean;
}

export function amplitudeToDbfs(amplitude: number) {
  if (!Number.isFinite(amplitude) || amplitude <= 0) {
    return MIN_DBFS;
  }

  return Math.max(MIN_DBFS, Math.min(0, 20 * Math.log10(amplitude)));
}

export function calculateTimeDomainMetrics(
  samples: Float32Array,
): TimeDomainMetrics {
  if (samples.length === 0) {
    return { rmsDbfs: MIN_DBFS, peakDbfs: MIN_DBFS, clipped: false };
  }

  let sumSquares = 0;
  let peak = 0;

  for (const sample of samples) {
    const amplitude = Math.abs(sample);
    sumSquares += sample * sample;
    peak = Math.max(peak, amplitude);
  }

  return {
    rmsDbfs: amplitudeToDbfs(Math.sqrt(sumSquares / samples.length)),
    peakDbfs: amplitudeToDbfs(peak),
    clipped: peak >= CLIP_THRESHOLD,
  };
}

export function findDominantFrequency(
  frequencyData: Float32Array,
  sampleRate: number,
  fftSize: number,
  rmsDbfs: number,
) {
  if (rmsDbfs < FREQUENCY_GATE_DBFS || frequencyData.length < 3) {
    return null;
  }

  const binWidth = sampleRate / fftSize;
  const firstBin = Math.max(1, Math.ceil(20 / binWidth));
  const lastBin = Math.min(
    frequencyData.length - 2,
    Math.floor(Math.min(20_000, sampleRate / 2) / binWidth),
  );
  let peakIndex = firstBin;

  for (let index = firstBin + 1; index <= lastBin; index += 1) {
    if (frequencyData[index] > frequencyData[peakIndex]) {
      peakIndex = index;
    }
  }

  if (!Number.isFinite(frequencyData[peakIndex])) {
    return null;
  }

  const left = frequencyData[peakIndex - 1];
  const center = frequencyData[peakIndex];
  const right = frequencyData[peakIndex + 1];
  const denominator = left - 2 * center + right;
  const offset =
    denominator === 0
      ? 0
      : Math.max(-0.5, Math.min(0.5, (0.5 * (left - right)) / denominator));

  return (peakIndex + offset) * binWidth;
}

export function nearestNote(frequency: number | null) {
  if (frequency === null || frequency <= 0) {
    return null;
  }

  const midi = Math.round(69 + 12 * Math.log2(frequency / 440));
  const noteNames = [
    "C",
    "C♯",
    "D",
    "D♯",
    "E",
    "F",
    "F♯",
    "G",
    "G♯",
    "A",
    "A♯",
    "B",
  ];
  const note = noteNames[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  const referenceFrequency = 440 * 2 ** ((midi - 69) / 12);
  const cents = Math.round(1200 * Math.log2(frequency / referenceFrequency));

  return { label: `${note}${octave}`, cents };
}
