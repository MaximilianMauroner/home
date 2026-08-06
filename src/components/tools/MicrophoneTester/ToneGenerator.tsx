import { Headphones, Volume2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

class StereoOscillator {
  private audioContext: AudioContext | null = null;
  private leftOscillator: OscillatorNode | null = null;
  private rightOscillator: OscillatorNode | null = null;
  private leftGain: GainNode | null = null;
  private rightGain: GainNode | null = null;
  private merger: ChannelMergerNode | null = null;
  private leftFrequency = 440;
  private rightFrequency = 440;
  private volume = 0.25;

  private ensureContext() {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
      this.leftGain = this.audioContext.createGain();
      this.rightGain = this.audioContext.createGain();
      this.merger = this.audioContext.createChannelMerger(2);
      this.leftGain.connect(this.merger, 0, 0);
      this.rightGain.connect(this.merger, 0, 1);
      this.merger.connect(this.audioContext.destination);
      this.setVolume(this.volume);
    }
    if (this.audioContext.state === "suspended") {
      void this.audioContext.resume();
    }
  }

  setFrequencies(left: number, right: number) {
    this.leftFrequency = left;
    this.rightFrequency = right;
    if (this.audioContext && this.leftOscillator) {
      this.leftOscillator.frequency.setValueAtTime(
        left,
        this.audioContext.currentTime,
      );
    }
    if (this.audioContext && this.rightOscillator) {
      this.rightOscillator.frequency.setValueAtTime(
        right,
        this.audioContext.currentTime,
      );
    }
  }

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
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

  start(channel: "left" | "right") {
    this.ensureContext();
    if (!this.audioContext) {
      return;
    }
    this.stop(channel);
    const oscillator = this.audioContext.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(
      channel === "left" ? this.leftFrequency : this.rightFrequency,
      this.audioContext.currentTime,
    );
    oscillator.connect(channel === "left" ? this.leftGain! : this.rightGain!);
    oscillator.start();
    if (channel === "left") {
      this.leftOscillator = oscillator;
    } else {
      this.rightOscillator = oscillator;
    }
  }

  stop(channel: "left" | "right") {
    const oscillator =
      channel === "left" ? this.leftOscillator : this.rightOscillator;
    if (!oscillator) {
      return;
    }
    oscillator.stop();
    oscillator.disconnect();
    if (channel === "left") {
      this.leftOscillator = null;
    } else {
      this.rightOscillator = null;
    }
  }

  destroy() {
    this.stop("left");
    this.stop("right");
    if (this.audioContext) {
      void this.audioContext.close();
    }
    this.audioContext = null;
  }
}

const clampFrequency = (value: number) => Math.max(20, Math.min(20_000, value));
const formatFrequency = (value: number) => value.toLocaleString();

export default function ToneGenerator() {
  const [leftFrequency, setLeftFrequency] = useState(440);
  const [rightFrequency, setRightFrequency] = useState(440);
  const [volume, setVolume] = useState(0.25);
  const [playing, setPlaying] = useState({ left: false, right: false });
  const oscillator = useRef<StereoOscillator | null>(null);

  useEffect(() => {
    oscillator.current = new StereoOscillator();
    return () => oscillator.current?.destroy();
  }, []);

  useEffect(() => {
    oscillator.current?.setFrequencies(leftFrequency, rightFrequency);
  }, [leftFrequency, rightFrequency]);

  useEffect(() => oscillator.current?.setVolume(volume), [volume]);

  const toggleChannel = useCallback(
    (channel: "left" | "right") => {
      if (playing[channel]) {
        oscillator.current?.stop(channel);
      } else {
        oscillator.current?.start(channel);
      }
      setPlaying((current) => ({ ...current, [channel]: !current[channel] }));
    },
    [playing],
  );

  const toggleBoth = () => {
    const shouldPlay = !playing.left || !playing.right;
    for (const channel of ["left", "right"] as const) {
      if (shouldPlay) {
        oscillator.current?.start(channel);
      } else {
        oscillator.current?.stop(channel);
      }
    }
    setPlaying({ left: shouldPlay, right: shouldPlay });
  };

  const difference = Math.abs(leftFrequency - rightFrequency);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section className="tool-panel-lg space-y-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              Stereo tone generator
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Test each output channel independently or create a binaural
              offset.
            </p>
          </div>
          <Headphones className="h-5 w-5 text-primary" aria-hidden="true" />
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          {(["left", "right"] as const).map((channel) => {
            const frequency =
              channel === "left" ? leftFrequency : rightFrequency;
            const setFrequency =
              channel === "left" ? setLeftFrequency : setRightFrequency;
            const rangeId = `tone-${channel}-range`;
            const numberId = `tone-${channel}-number`;
            return (
              <div key={channel} className="tool-subpanel space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold capitalize text-foreground">
                    {channel} channel
                  </h3>
                  <span className="tool-catalog-pill">
                    {playing[channel] ? "Playing" : "Paused"}
                  </span>
                </div>
                <p className="font-mono text-3xl font-semibold text-foreground">
                  {formatFrequency(frequency)}{" "}
                  <span className="text-sm text-muted-foreground">Hz</span>
                </p>
                <label
                  htmlFor={rangeId}
                  className="block text-sm text-muted-foreground"
                >
                  Frequency
                  <input
                    id={rangeId}
                    className="mt-2 w-full accent-primary"
                    type="range"
                    min="20"
                    max="20000"
                    step="1"
                    value={frequency}
                    onChange={(event) =>
                      setFrequency(event.target.valueAsNumber)
                    }
                  />
                </label>
                <label
                  htmlFor={numberId}
                  className="block text-sm text-muted-foreground"
                >
                  Exact frequency
                  <input
                    id={numberId}
                    className="tool-field mt-2 w-full"
                    type="number"
                    min="20"
                    max="20000"
                    value={frequency}
                    onChange={(event) =>
                      setFrequency(
                        clampFrequency(event.target.valueAsNumber || frequency),
                      )
                    }
                  />
                </label>
                <button
                  type="button"
                  className="tool-button w-full"
                  onClick={() => toggleChannel(channel)}
                >
                  {playing[channel] ? `Pause ${channel}` : `Play ${channel}`}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <aside className="tool-panel-lg space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Master output</h2>
          <Volume2 className="h-4 w-4 text-primary" aria-hidden="true" />
        </div>
        <div className="tool-subpanel space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Binaural offset</span>
            <strong>{formatFrequency(difference)} Hz</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Output level</span>
            <strong>{Math.round(volume * 100)}%</strong>
          </div>
        </div>
        <label
          htmlFor="tone-volume"
          className="block text-sm text-muted-foreground"
        >
          Volume
          <input
            id="tone-volume"
            className="mt-2 w-full accent-primary"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(event) => setVolume(event.target.valueAsNumber)}
          />
        </label>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Use headphones and start at a low level. Increase volume gradually.
        </p>
        <button
          type="button"
          className="tool-button-secondary w-full"
          onClick={toggleBoth}
        >
          {playing.left && playing.right
            ? "Pause both channels"
            : "Play both channels"}
        </button>
      </aside>
    </div>
  );
}
