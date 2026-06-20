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
  const leftRangeId = "frequency-left-range";
  const leftNumberId = "frequency-left-number";
  const rightRangeId = "frequency-right-range";
  const rightNumberId = "frequency-right-number";
  const volumeRangeId = "frequency-volume-range";

  return (
    <div className="tools-shell flex max-w-5xl flex-col gap-6">
      <section className="tool-panel-lg">
        <div className="grid gap-6 md:grid-cols-[1.15fr_0.85fr] md:items-center">
          <div className="space-y-4 text-foreground">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Stereo Frequency Tester
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-card-foreground">
              Craft precise binaural tone tests. Adjust individual channel
              frequencies, sync the output, and fine-tune volume.
            </p>
          </div>
          <div className="tool-subpanel grid gap-4 text-sm text-card-foreground">
            <div className="flex items-center justify-between">
              <span className="tool-label">
                Left channel
              </span>
              <span className="text-lg font-semibold text-foreground">
                {formatFrequency(leftFrequency)} Hz
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="tool-label">
                Right channel
              </span>
              <span className="text-lg font-semibold text-foreground">
                {formatFrequency(rightFrequency)} Hz
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="tool-label">
                Difference
              </span>
              <span className="text-lg font-semibold text-foreground">
                {frequencyDifference === 0
                  ? "Perfectly matched"
                  : `${formatFrequency(frequencyDifference)} Hz`}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="tool-label">
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
        <div className="tool-panel-lg flex flex-col gap-6">
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
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background text-primary">
              <Headphones className="h-5 w-5" />
            </div>
          </header>

          <div className="tool-subpanel grid gap-4 text-sm text-muted-foreground">
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
            <div className="tool-subpanel space-y-4">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span className="font-medium text-card-foreground">Left channel</span>
                <span className="rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {isLeftPlaying ? "Playing" : "Paused"}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-3xl font-semibold text-foreground">
                  {formatFrequency(leftFrequency)}
                </span>
                <span className="text-sm text-muted-foreground">Hz</span>
              </div>
              <label
                htmlFor={leftRangeId}
                className="flex flex-col gap-2 text-sm text-muted-foreground"
              >
                <span>Fine adjustment</span>
                <input
                  id={leftRangeId}
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
              <label
                htmlFor={leftNumberId}
                className="flex flex-col gap-2 text-sm text-muted-foreground"
              >
                <span>Exact frequency</span>
                <input
                  id={leftNumberId}
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
                  className="tool-field w-full text-base"
                />
              </label>
              <button
                type="button"
                onClick={toggleLeft}
                className="tool-button w-full py-3"
              >
                {isLeftPlaying ? "Pause left" : "Play left"}
              </button>
            </div>

            <div className="tool-subpanel space-y-4">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span className="font-medium text-card-foreground">
                  Right channel
                </span>
                <span className="rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {isRightPlaying ? "Playing" : "Paused"}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-3xl font-semibold text-foreground">
                  {formatFrequency(rightFrequency)}
                </span>
                <span className="text-sm text-muted-foreground">Hz</span>
              </div>
              <label
                htmlFor={rightRangeId}
                className="flex flex-col gap-2 text-sm text-muted-foreground"
              >
                <span>Fine adjustment</span>
                <input
                  id={rightRangeId}
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
              <label
                htmlFor={rightNumberId}
                className="flex flex-col gap-2 text-sm text-muted-foreground"
              >
                <span>Exact frequency</span>
                <input
                  id={rightNumberId}
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
                  className="tool-field w-full text-base"
                />
              </label>
              <button
                type="button"
                onClick={toggleRight}
                className="tool-button w-full py-3"
              >
                {isRightPlaying ? "Pause right" : "Play right"}
              </button>
            </div>
          </div>

          <div className="space-y-4 rounded-lg border border-border bg-background p-4 text-sm text-muted-foreground">
            <div className="flex items-center justify-between text-card-foreground">
              <span className="font-semibold text-foreground">Master controls</span>
              <Volume2 className="h-4 w-4 text-primary" />
            </div>
            <label htmlFor={volumeRangeId} className="flex flex-col gap-2 text-sm">
              <span>Output level</span>
              <input
                id={volumeRangeId}
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
              className="tool-button-secondary w-full py-3"
            >
              {isLeftPlaying && isRightPlaying ? "Pause both channels" : "Play both channels"}
            </button>
          </div>
        </div>

        <aside className="tool-panel-lg flex flex-col justify-between gap-6">
          <div className="space-y-4 text-card-foreground">
            <h3 className="text-lg font-semibold text-foreground">Visualizer</h3>
            <p className="text-sm text-muted-foreground">
              The highlighted bars indicate the current binaural offset. Larger
              offsets illuminate more bars. Equal frequencies keep the spectrum calm.
            </p>
            <div className="flex h-32 items-end gap-1 rounded-lg border border-border bg-background p-3">
              {visualizerBars.map((active, index) => (
                <div
                  // eslint-disable-next-line react/no-array-index-key
                  key={index}
                  className="flex-1 rounded-sm bg-primary transition-all"
                  style={{
                    opacity: active ? 1 : 0.12,
                    height: `${active ? 40 + index * 2 : 12}%`,
                  }}
                />
              ))}
            </div>
          </div>
          <div className="tool-subpanel text-sm text-muted-foreground">
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
