import {
  MIN_DBFS,
  calculateTimeDomainMetrics,
  findDominantFrequency,
} from "./audioMetrics";

export interface AnalyzerMetrics {
  rmsDbfs: number;
  peakDbfs: number;
  peakHoldDbfs: number;
  clipCount: number;
  dominantFrequency: number | null;
}

export interface AnalyzerVisualFrame {
  timeData: Float32Array;
  frequencyData: Float32Array;
  sampleRate: number;
}

interface AnalyzerCallbacks {
  onMetrics: (metrics: AnalyzerMetrics) => void;
  onVisualFrame: (frame: AnalyzerVisualFrame) => void;
  onEnded: () => void;
}

const EMPTY_METRICS: AnalyzerMetrics = {
  rmsDbfs: MIN_DBFS,
  peakDbfs: MIN_DBFS,
  peakHoldDbfs: MIN_DBFS,
  clipCount: 0,
  dominantFrequency: null,
};

export class MicrophoneAnalyzer {
  private audioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private animationFrame: number | null = null;
  private timeData = new Float32Array(0);
  private frequencyData = new Float32Array(0);
  private peakHoldDbfs = MIN_DBFS;
  private clipCount = 0;
  private wasClipping = false;
  private lastVisualAt = 0;
  private lastMetricsAt = 0;
  private paused = false;
  private readonly callbacks: AnalyzerCallbacks;

  constructor(callbacks: AnalyzerCallbacks) {
    this.callbacks = callbacks;
  }

  async start(deviceId?: string) {
    this.stop();

    const audioConstraints: MediaTrackConstraints = {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
    };
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: audioConstraints,
      video: false,
    });

    try {
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 4096;
      analyser.smoothingTimeConstant = 0.72;
      source.connect(analyser);

      this.stream = stream;
      this.audioContext = audioContext;
      this.source = source;
      this.analyser = analyser;
      this.timeData = new Float32Array(analyser.fftSize);
      this.frequencyData = new Float32Array(analyser.frequencyBinCount);
      this.peakHoldDbfs = MIN_DBFS;
      this.clipCount = 0;
      this.wasClipping = false;
      stream.getAudioTracks()[0]?.addEventListener("ended", this.handleEnded);
      this.startLoop();
    } catch (error) {
      for (const track of stream.getTracks()) {
        track.stop();
      }
      throw error;
    }
  }

  stop() {
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    const track = this.stream?.getAudioTracks()[0];
    track?.removeEventListener("ended", this.handleEnded);
    this.source?.disconnect();
    this.analyser?.disconnect();
    for (const streamTrack of this.stream?.getTracks() ?? []) {
      streamTrack.stop();
    }
    if (this.audioContext && this.audioContext.state !== "closed") {
      void this.audioContext.close();
    }

    this.stream = null;
    this.audioContext = null;
    this.source = null;
    this.analyser = null;
    this.timeData = new Float32Array(0);
    this.frequencyData = new Float32Array(0);
    this.callbacks.onMetrics(EMPTY_METRICS);
  }

  resetPeak() {
    this.peakHoldDbfs = MIN_DBFS;
    this.clipCount = 0;
    this.wasClipping = false;
  }

  setPaused(paused: boolean) {
    this.paused = paused;
    if (paused && this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    } else if (!paused && this.analyser) {
      this.startLoop();
    }
  }

  getTrackSettings() {
    return this.stream?.getAudioTracks()[0]?.getSettings() ?? null;
  }

  private readonly handleEnded = () => {
    this.stop();
    this.callbacks.onEnded();
  };

  private startLoop() {
    if (this.paused || !this.analyser || this.animationFrame !== null) {
      return;
    }

    const update = (timestamp: number) => {
      this.animationFrame = null;
      if (!this.analyser || !this.audioContext || this.paused) {
        return;
      }

      if (timestamp - this.lastVisualAt >= 1000 / 30) {
        this.analyser.getFloatTimeDomainData(this.timeData);
        this.analyser.getFloatFrequencyData(this.frequencyData);
        this.callbacks.onVisualFrame({
          timeData: this.timeData,
          frequencyData: this.frequencyData,
          sampleRate: this.audioContext.sampleRate,
        });
        this.lastVisualAt = timestamp;
      }

      if (timestamp - this.lastMetricsAt >= 100) {
        const metrics = calculateTimeDomainMetrics(this.timeData);
        this.peakHoldDbfs = Math.max(this.peakHoldDbfs, metrics.peakDbfs);
        if (metrics.clipped && !this.wasClipping) {
          this.clipCount += 1;
        }
        this.wasClipping = metrics.clipped;
        this.callbacks.onMetrics({
          ...metrics,
          peakHoldDbfs: this.peakHoldDbfs,
          clipCount: this.clipCount,
          dominantFrequency: findDominantFrequency(
            this.frequencyData,
            this.audioContext.sampleRate,
            this.analyser.fftSize,
            metrics.rmsDbfs,
          ),
        });
        this.lastMetricsAt = timestamp;
      }

      this.animationFrame = requestAnimationFrame(update);
    };

    this.animationFrame = requestAnimationFrame(update);
  }
}
