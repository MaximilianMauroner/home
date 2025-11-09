import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Headphones, Music2, Volume2, Waves } from "lucide-react";

class StereoOscillator {
  private audioContext: AudioContext | null;
  private leftOsc: OscillatorNode | null;
  private rightOsc: OscillatorNode | null;
  private leftGain: GainNode | null;
  private rightGain: GainNode | null;
  private merger: ChannelMergerNode | null;
  private leftFreq: number;
  private rightFreq: number;
  private volume: number;

  constructor() {
    this.audioContext = null;
    this.leftOsc = null;
    this.rightOsc = null;
    this.leftGain = null;
    this.rightGain = null;
    this.merger = null;
    this.leftFreq = 440;
    this.rightFreq = 440;
    this.volume = 0.25;
  }

  private ensureContext() {
    if (typeof window === "undefined") {
      return;
    }

    if (!this.audioContext) {
      this.audioContext = new AudioContext();
      this.leftGain = this.audioContext.createGain();
      this.rightGain = this.audioContext.createGain();
      this.merger = this.audioContext.createChannelMerger(2);

      this.leftGain.connect(this.merger, 0, 0);
      this.rightGain.connect(this.merger, 0, 1);
      this.merger.connect(this.audioContext.destination);

      this.setVolumes(this.volume);
    }

    if (this.audioContext.state === "suspended") {
      void this.audioContext.resume();
    }
  }

  private createOscillator(frequency: number): OscillatorNode | null {
    this.ensureContext();
    if (!this.audioContext) {
      return null;
    }

    const osc = this.audioContext.createOscillator();
    osc.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
    osc.type = "sine";
    return osc;
  }

  setLeft(frequency: number) {
    this.leftFreq = frequency;
    if (this.leftOsc && this.audioContext) {
      this.leftOsc.frequency.setValueAtTime(
        frequency,
        this.audioContext.currentTime,
      );
    }
  }

  setRight(frequency: number) {
    this.rightFreq = frequency;
    if (this.rightOsc && this.audioContext) {
      this.rightOsc.frequency.setValueAtTime(
        frequency,
        this.audioContext.currentTime,
      );
    }
  }

  setVolumes(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (!this.audioContext || !this.leftGain || !this.rightGain) {
      this.ensureContext();
    }
    if (!this.audioContext || !this.leftGain || !this.rightGain) {
      return;
    }
    this.leftGain.gain.setValueAtTime(
      this.volume,
      this.audioContext.currentTime,
    );
    this.rightGain.gain.setValueAtTime(
      this.volume,
      this.audioContext.currentTime,
    );
  }

  startLeft() {
    if (this.leftOsc) {
      this.stopLeft();
    }
    const osc = this.createOscillator(this.leftFreq);
    if (!osc || !this.leftGain) {
      return;
    }
    this.leftOsc = osc;
    osc.connect(this.leftGain);
    osc.start();
  }

  startRight() {
    if (this.rightOsc) {
      this.stopRight();
    }
    const osc = this.createOscillator(this.rightFreq);
    if (!osc || !this.rightGain) {
      return;
    }
    this.rightOsc = osc;
    osc.connect(this.rightGain);
    osc.start();
  }

  startBoth() {
    this.startLeft();
    this.startRight();
  }

  stopLeft() {
    if (!this.leftOsc) {
      return;
    }
    this.leftOsc.stop();
    this.leftOsc.disconnect();
    this.leftOsc = null;
  }

  stopRight() {
    if (!this.rightOsc) {
      return;
    }
    this.rightOsc.stop();
    this.rightOsc.disconnect();
    this.rightOsc = null;
  }

  stopBoth() {
    this.stopLeft();
    this.stopRight();
  }

  destroy() {
    this.stopBoth();
    if (this.audioContext) {
      void this.audioContext.close();
    }
    this.audioContext = null;
    this.leftGain = null;
    this.rightGain = null;
    this.merger = null;
  }
}

const formatFrequency = (value: number) =>
  value.toLocaleString(undefined, {
    maximumFractionDigits: value >= 1000 ? 0 : value >= 100 ? 1 : 2,
  });

const FrequencyTester = () => {
  const [leftFrequency, setLeftFrequency] = useState(440);
  const [rightFrequency, setRightFrequency] = useState(440);
  const [volume, setVolume] = useState(0.25);
  const [isLeftPlaying, setIsLeftPlaying] = useState(false);
  const [isRightPlaying, setIsRightPlaying] = useState(false);

  const oscillatorRef = useRef<StereoOscillator | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    oscillatorRef.current = new StereoOscillator();
    oscillatorRef.current.setLeft(leftFrequency);
    oscillatorRef.current.setRight(rightFrequency);
    oscillatorRef.current.setVolumes(volume);

    return () => {
      oscillatorRef.current?.destroy();
      oscillatorRef.current = null;
    };
  }, []);

  useEffect(() => {
    oscillatorRef.current?.setLeft(leftFrequency);
  }, [leftFrequency]);

  useEffect(() => {
    oscillatorRef.current?.setRight(rightFrequency);
  }, [rightFrequency]);

  useEffect(() => {
    oscillatorRef.current?.setVolumes(volume);
  }, [volume]);

  const toggleLeft = useCallback(() => {
    if (!oscillatorRef.current) {
      return;
    }
    if (isLeftPlaying) {
      oscillatorRef.current.stopLeft();
      setIsLeftPlaying(false);
    } else {
      oscillatorRef.current.setLeft(leftFrequency);
      oscillatorRef.current.startLeft();
      setIsLeftPlaying(true);
    }
  }, [isLeftPlaying, leftFrequency]);

  const toggleRight = useCallback(() => {
    if (!oscillatorRef.current) {
      return;
    }
    if (isRightPlaying) {
      oscillatorRef.current.stopRight();
      setIsRightPlaying(false);
    } else {
      oscillatorRef.current.setRight(rightFrequency);
      oscillatorRef.current.startRight();
      setIsRightPlaying(true);
    }
  }, [isRightPlaying, rightFrequency]);

  const toggleBoth = useCallback(() => {
    if (!oscillatorRef.current) {
      return;
    }

    if (isLeftPlaying && isRightPlaying) {
      oscillatorRef.current.stopBoth();
      setIsLeftPlaying(false);
      setIsRightPlaying(false);
      return;
    }

    oscillatorRef.current.setLeft(leftFrequency);
    oscillatorRef.current.setRight(rightFrequency);
    oscillatorRef.current.startBoth();
    setIsLeftPlaying(true);
    setIsRightPlaying(true);
  }, [isLeftPlaying, isRightPlaying, leftFrequency, rightFrequency]);

  const visualizerBars = useMemo(() => {
    const maxBars = 24;
    const diff = Math.abs(rightFrequency - leftFrequency);
    const normalized = Math.min(diff / 400, 1);
    const highlightedBars = Math.round(normalized * maxBars);
    return new Array(maxBars).fill(false).map((_, index) => index < highlightedBars);
  }, [leftFrequency, rightFrequency]);

  const frequencyRange = { min: 20, max: 20000 };

  const frequencyDifference = Math.abs(leftFrequency - rightFrequency);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-10 px-4 pb-16 pt-8 md:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-pink-500/15 via-background to-purple-500/10 p-8 shadow-lg backdrop-blur-sm dark:from-pink-500/20 dark:via-background dark:to-purple-500/15">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(236,72,153,0.12),transparent_65%)]" />
        <div className="grid gap-6 md:grid-cols-[1.15fr_0.85fr] md:items-center">
          <div className="space-y-4 text-foreground">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
              Audio Playground
            </span>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Stereo Frequency Tester
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-card-foreground">
              Craft precise binaural tone tests. Adjust individual channel
              frequencies, sync the output, and fine-tune volume with an elegant
              interface that adapts beautifully to light and dark modes.
            </p>
          </div>
          <div className="grid gap-4 rounded-2xl border border-border bg-card p-4 text-sm text-card-foreground shadow-sm backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                Left channel
              </span>
              <span className="text-lg font-semibold text-foreground">
                {formatFrequency(leftFrequency)} Hz
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                Right channel
              </span>
              <span className="text-lg font-semibold text-foreground">
                {formatFrequency(rightFrequency)} Hz
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                Difference
              </span>
              <span className="text-lg font-semibold text-foreground">
                {frequencyDifference === 0
                  ? "Perfectly matched"
                  : `${formatFrequency(frequencyDifference)} Hz`}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                Volume
              </span>
              <span className="text-lg font-semibold text-foreground">
                {Math.round(volume * 100)}%
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6 rounded-3xl border border-border bg-card p-6 shadow-sm">
          <header className="flex items-start justify-between gap-4 text-card-foreground">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-foreground">
                Channel controls
              </h2>
              <p className="text-sm text-muted-foreground">
                Fine-tune each channel and listen instantly. Buttons toggle the
                respective channels, while &ldquo;Play both&rdquo; keeps them
                perfectly in sync.
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Headphones className="h-5 w-5" />
            </div>
          </header>

          <div className="grid gap-4 rounded-2xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-card-foreground">
                <Waves className="h-4 w-4" />
                <span>Frequency range</span>
              </div>
              <span className="font-medium text-foreground">
                {frequencyRange.min} Hz – {frequencyRange.max} Hz
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-card-foreground">
                <Music2 className="h-4 w-4" />
                <span>Binaural offset</span>
              </div>
              <span className="font-medium text-foreground">
                {frequencyDifference === 0
                  ? "None"
                  : `${formatFrequency(frequencyDifference)} Hz`}
              </span>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4 rounded-2xl border border-border bg-background/60 p-4 shadow-sm">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span className="font-medium text-card-foreground">Left channel</span>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-primary">
                  {isLeftPlaying ? "Playing" : "Paused"}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-3xl font-semibold text-foreground">
                  {formatFrequency(leftFrequency)}
                </span>
                <span className="text-sm text-muted-foreground">Hz</span>
              </div>
              <label className="flex flex-col gap-2 text-sm text-muted-foreground">
                <span>Fine adjustment</span>
                <input
                  type="range"
                  min={frequencyRange.min}
                  max={frequencyRange.max}
                  step={1}
                  value={leftFrequency}
                  onChange={(event) =>
                    setLeftFrequency(event.target.valueAsNumber)
                  }
                  className="accent-primary"
                />
              </label>
              <input
                type="number"
                min={frequencyRange.min}
                max={frequencyRange.max}
                value={leftFrequency}
                onChange={(event) => {
                  const value = Number.isFinite(event.target.valueAsNumber)
                    ? event.target.valueAsNumber
                    : leftFrequency;
                  setLeftFrequency(
                    Math.max(frequencyRange.min, Math.min(frequencyRange.max, value)),
                  );
                }}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button
                type="button"
                onClick={toggleLeft}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {isLeftPlaying ? "Pause left" : "Play left"}
              </button>
            </div>

            <div className="space-y-4 rounded-2xl border border-border bg-background/60 p-4 shadow-sm">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span className="font-medium text-card-foreground">
                  Right channel
                </span>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-primary">
                  {isRightPlaying ? "Playing" : "Paused"}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-3xl font-semibold text-foreground">
                  {formatFrequency(rightFrequency)}
                </span>
                <span className="text-sm text-muted-foreground">Hz</span>
              </div>
              <label className="flex flex-col gap-2 text-sm text-muted-foreground">
                <span>Fine adjustment</span>
                <input
                  type="range"
                  min={frequencyRange.min}
                  max={frequencyRange.max}
                  step={1}
                  value={rightFrequency}
                  onChange={(event) =>
                    setRightFrequency(event.target.valueAsNumber)
                  }
                  className="accent-primary"
                />
              </label>
              <input
                type="number"
                min={frequencyRange.min}
                max={frequencyRange.max}
                value={rightFrequency}
                onChange={(event) => {
                  const value = Number.isFinite(event.target.valueAsNumber)
                    ? event.target.valueAsNumber
                    : rightFrequency;
                  setRightFrequency(
                    Math.max(frequencyRange.min, Math.min(frequencyRange.max, value)),
                  );
                }}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button
                type="button"
                onClick={toggleRight}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {isRightPlaying ? "Pause right" : "Play right"}
              </button>
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-4 text-sm text-muted-foreground">
            <div className="flex items-center justify-between text-card-foreground">
              <span className="font-semibold text-foreground">Master controls</span>
              <Volume2 className="h-4 w-4 text-primary" />
            </div>
            <label className="flex flex-col gap-2 text-sm">
              <span>Output level</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={(event) => setVolume(event.target.valueAsNumber)}
                className="accent-primary"
              />
            </label>
            <p className="text-xs leading-relaxed">
              Keep the master slider conservative to prevent clipping. Increase
              gradually once you verify your playback device handles the current
              frequencies comfortably.
            </p>
            <button
              type="button"
              onClick={toggleBoth}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-primary/60 bg-primary/10 px-4 py-3 text-sm font-semibold text-primary transition hover:bg-primary/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {isLeftPlaying && isRightPlaying ? "Pause both channels" : "Play both channels"}
            </button>
          </div>
        </div>

        <aside className="flex flex-col justify-between gap-6 rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-background to-purple-500/10 p-6 shadow-sm">
          <div className="space-y-4 text-card-foreground">
            <h3 className="text-lg font-semibold text-foreground">Visualizer</h3>
            <p className="text-sm text-muted-foreground">
              The highlighted bars indicate the current binaural offset. Larger
              offsets illuminate more bars. Equal frequencies keep the spectrum calm.
            </p>
            <div className="flex h-32 items-end gap-1 rounded-2xl border border-border bg-background/80 p-3">
              {visualizerBars.map((active, index) => (
                <div
                  // eslint-disable-next-line react/no-array-index-key
                  key={index}
                  className="flex-1 rounded-full bg-gradient-to-t from-primary/10 via-primary/40 to-primary/80 transition-all"
                  style={{
                    opacity: active ? 1 : 0.12,
                    height: `${active ? 40 + index * 2 : 12}%`,
                  }}
                />
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card/80 p-4 text-sm text-muted-foreground shadow-sm">
            <p>
              Need a quick reference? Start around <span className="font-semibold text-primary">440 Hz</span> on both
              channels. Adjust one channel in small increments to explore
              binaural beats and phase perception.
            </p>
          </div>
        </aside>
      </section>
    </div>
  );
};

export default FrequencyTester;

