import {
  Check,
  CircleAlert,
  Mic,
  Radio,
  RotateCcw,
  Square,
  TriangleAlert,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MIN_DBFS, nearestNote } from "./audioMetrics";
import {
  MicrophoneAnalyzer,
  type AnalyzerMetrics,
  type AnalyzerVisualFrame,
} from "./microphoneAnalyzer";
import ToneGenerator from "./ToneGenerator";

type AnalyzerStatus = "idle" | "requesting" | "running" | "error" | "ended";
type ActiveTab = "analyzer" | "generator";

const EMPTY_METRICS: AnalyzerMetrics = {
  rmsDbfs: MIN_DBFS,
  peakDbfs: MIN_DBFS,
  peakHoldDbfs: MIN_DBFS,
  clipCount: 0,
  dominantFrequency: null,
};

function formatDbfs(value: number) {
  return value <= MIN_DBFS ? "−∞" : value.toFixed(1).replace("-", "−");
}

function formatFrequency(value: number | null) {
  if (value === null) {
    return "No stable tone";
  }
  return `${value >= 1000 ? value.toFixed(0) : value.toFixed(1)} Hz`;
}

function prepareCanvas(canvas: HTMLCanvasElement) {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const bounds = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(bounds.width * ratio));
  const height = Math.max(1, Math.round(bounds.height * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const context = canvas.getContext("2d");
  context?.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { context, width: bounds.width, height: bounds.height };
}

function drawGrid(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#050505";
  context.fillRect(0, 0, width, height);
  context.strokeStyle = "#1b1b1b";
  context.lineWidth = 1;
  for (let index = 1; index < 4; index += 1) {
    const y = (height * index) / 4;
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }
}

function drawWaveform(canvas: HTMLCanvasElement | null, samples: Float32Array) {
  if (!canvas || samples.length === 0) {
    return;
  }
  const { context, width, height } = prepareCanvas(canvas);
  if (!context) {
    return;
  }
  drawGrid(context, width, height);
  context.strokeStyle = "#63ee9a";
  context.lineWidth = 2;
  context.beginPath();
  const stride = Math.max(1, Math.floor(samples.length / width));
  for (let x = 0; x < width; x += 1) {
    const sample = samples[Math.min(samples.length - 1, x * stride)];
    const y = height / 2 - sample * height * 0.44;
    if (x === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }
  context.stroke();
}

function drawSpectrum(
  canvas: HTMLCanvasElement | null,
  frequencyData: Float32Array,
  sampleRate: number,
) {
  if (!canvas || frequencyData.length === 0) {
    return;
  }
  const { context, width, height } = prepareCanvas(canvas);
  if (!context) {
    return;
  }
  drawGrid(context, width, height);
  const bands = Math.max(24, Math.min(64, Math.floor(width / 10)));
  const nyquist = sampleRate / 2;
  const gap = 2;
  const barWidth = Math.max(1, width / bands - gap);
  context.fillStyle = "#70d9ff";
  for (let band = 0; band < bands; band += 1) {
    const frequency =
      20 * (Math.min(20_000, nyquist) / 20) ** (band / (bands - 1));
    const index = Math.min(
      frequencyData.length - 1,
      Math.round((frequency / nyquist) * frequencyData.length),
    );
    const normalized = Math.max(
      0,
      Math.min(1, (frequencyData[index] + 100) / 80),
    );
    const barHeight = Math.max(2, normalized * height);
    context.globalAlpha = 0.35 + normalized * 0.65;
    context.fillRect(
      band * (barWidth + gap),
      height - barHeight,
      barWidth,
      barHeight,
    );
  }
  context.globalAlpha = 1;
}

function describeMicrophoneError(error: unknown) {
  if (!(error instanceof DOMException)) {
    return "The microphone could not be started. Check the connected input and try again.";
  }
  if (error.name === "NotAllowedError" || error.name === "SecurityError") {
    return "Microphone access was denied. Allow access in your browser settings, then try again.";
  }
  if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
    return "No microphone was found. Connect an input device, then try again.";
  }
  if (error.name === "NotReadableError" || error.name === "TrackStartError") {
    return "The microphone is busy or unavailable. Close other audio apps, then try again.";
  }
  return "The microphone could not be started. Check the connected input and try again.";
}

export default function MicrophoneTester() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("analyzer");
  const [status, setStatus] = useState<AnalyzerStatus>("idle");
  const [statusMessage, setStatusMessage] = useState(
    "Ready to test your microphone.",
  );
  const [metrics, setMetrics] = useState(EMPTY_METRICS);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [trackSettings, setTrackSettings] = useState<MediaTrackSettings | null>(
    null,
  );
  const waveformCanvas = useRef<HTMLCanvasElement | null>(null);
  const spectrumCanvas = useRef<HTMLCanvasElement | null>(null);
  const analyzer = useRef<MicrophoneAnalyzer | null>(null);

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      return;
    }
    const available = (await navigator.mediaDevices.enumerateDevices()).filter(
      (device) => device.kind === "audioinput",
    );
    setDevices(available);
  }, []);

  useEffect(() => {
    analyzer.current = new MicrophoneAnalyzer({
      onMetrics: setMetrics,
      onVisualFrame: ({
        timeData,
        frequencyData,
        sampleRate,
      }: AnalyzerVisualFrame) => {
        drawWaveform(waveformCanvas.current, timeData);
        drawSpectrum(spectrumCanvas.current, frequencyData, sampleRate);
      },
      onEnded: () => {
        setStatus("ended");
        setTrackSettings(null);
        setStatusMessage(
          "The input device disconnected. Choose another microphone and try again.",
        );
      },
    });

    const handleVisibility = () => analyzer.current?.setPaused(document.hidden);
    const handleDeviceChange = () => void refreshDevices();
    document.addEventListener("visibilitychange", handleVisibility);
    navigator.mediaDevices?.addEventListener?.(
      "devicechange",
      handleDeviceChange,
    );

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      navigator.mediaDevices?.removeEventListener?.(
        "devicechange",
        handleDeviceChange,
      );
      analyzer.current?.stop();
      analyzer.current = null;
    };
  }, [refreshDevices]);

  const stopTest = useCallback(() => {
    analyzer.current?.stop();
    setStatus("idle");
    setTrackSettings(null);
    setStatusMessage("Microphone stopped. No audio is being captured.");
  }, []);

  const startTest = useCallback(
    async (deviceId = selectedDeviceId) => {
      if (
        !navigator.mediaDevices?.getUserMedia ||
        typeof AudioContext === "undefined"
      ) {
        setStatus("error");
        setStatusMessage(
          "This browser does not support live microphone analysis.",
        );
        return;
      }
      if (!analyzer.current) {
        setStatus("error");
        setStatusMessage(
          "The microphone analyzer is still loading. Try again.",
        );
        return;
      }

      setStatus("requesting");
      setStatusMessage("Waiting for microphone permission.");
      try {
        await analyzer.current?.start(deviceId || undefined);
        await refreshDevices();
        const settings = analyzer.current?.getTrackSettings() ?? null;
        setTrackSettings(settings);
        setSelectedDeviceId(settings?.deviceId ?? deviceId);
        setStatus("running");
        setStatusMessage("Microphone test is running locally in your browser.");
      } catch (error) {
        analyzer.current?.stop();
        setTrackSettings(null);
        setStatus("error");
        setStatusMessage(describeMicrophoneError(error));
      }
    },
    [refreshDevices, selectedDeviceId],
  );

  const selectTab = (tab: ActiveTab) => {
    if (tab === "generator" && status === "running") {
      stopTest();
    }
    setActiveTab(tab);
  };

  const resetPeak = () => {
    analyzer.current?.resetPeak();
    setMetrics((current) => ({
      ...current,
      peakHoldDbfs: MIN_DBFS,
      clipCount: 0,
    }));
  };

  const note = nearestNote(metrics.dominantFrequency);
  const signalHealthy = metrics.rmsDbfs > -50 && metrics.peakDbfs < -1;
  const meterPercent = Math.max(
    0,
    Math.min(100, ((metrics.rmsDbfs + 60) / 60) * 100),
  );
  const peakPercent = Math.max(
    0,
    Math.min(100, ((metrics.peakHoldDbfs + 60) / 60) * 100),
  );
  const activeDevice = useMemo(
    () => devices.find((device) => device.deviceId === selectedDeviceId),
    [devices, selectedDeviceId],
  );

  return (
    <div className="tools-shell flex max-w-6xl flex-col gap-6">
      <section className="tool-panel-lg space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Microphone tester
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Check input level, peaks, clipping, waveform, and dominant
              frequency. Audio stays on this device.
            </p>
          </div>
          {status === "running" && (
            <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-primary">
              <span
                className="h-2 w-2 rounded-full bg-primary"
                aria-hidden="true"
              />{" "}
              Input active
            </div>
          )}
        </div>

        <div
          className="inline-flex rounded-full border border-border bg-background p-1"
          role="tablist"
          aria-label="Microphone tester modes"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "analyzer"}
            onClick={() => selectTab("analyzer")}
            className={`rounded-full px-4 py-2 text-sm font-medium ${activeTab === "analyzer" ? "bg-foreground text-background" : "text-muted-foreground"}`}
          >
            Microphone analyzer
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "generator"}
            onClick={() => selectTab("generator")}
            className={`rounded-full px-4 py-2 text-sm font-medium ${activeTab === "generator" ? "bg-foreground text-background" : "text-muted-foreground"}`}
          >
            Tone generator
          </button>
        </div>
      </section>

      {activeTab === "generator" ? (
        <ToneGenerator />
      ) : (
        <>
          <div className="sr-only" aria-live="polite">
            {statusMessage}
          </div>

          {status !== "running" && (
            <section className="tool-panel-lg grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-background text-primary">
                  {status === "error" || status === "ended" ? (
                    <CircleAlert className="h-5 w-5" />
                  ) : (
                    <Mic className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">
                    {status === "requesting"
                      ? "Waiting for permission"
                      : status === "error" || status === "ended"
                        ? "Microphone unavailable"
                        : "Ready for a local mic check"}
                  </h2>
                  <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                    {statusMessage}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Nothing is recorded, uploaded, or saved.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="tool-button min-w-40"
                disabled={status === "requesting"}
                onClick={() => void startTest()}
              >
                {status === "requesting"
                  ? "Requesting access…"
                  : status === "error" || status === "ended"
                    ? "Try again"
                    : "Start mic test"}
              </button>
            </section>
          )}

          <section
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
            aria-label="Microphone test status"
          >
            <StatusCard
              label="Input"
              value={status === "running" ? "Connected" : "Stopped"}
              healthy={status === "running"}
            />
            <StatusCard
              label="Signal"
              value={
                status === "running"
                  ? signalHealthy
                    ? "Healthy"
                    : "Adjust level"
                  : "Waiting"
              }
              healthy={status === "running" && signalHealthy}
            />
            <StatusCard
              label="Frequency"
              value={
                metrics.dominantFrequency === null
                  ? "No stable tone"
                  : "Detected"
              }
              healthy={metrics.dominantFrequency !== null}
            />
            <StatusCard
              label="Peak test"
              value={
                status !== "running"
                  ? "Waiting"
                  : metrics.clipCount > 0
                    ? `${metrics.clipCount} clip${metrics.clipCount === 1 ? "" : "s"}`
                    : "No clipping"
              }
              healthy={status === "running" && metrics.clipCount === 0}
              warning={metrics.clipCount > 0}
            />
          </section>

          <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="tool-panel-lg space-y-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="tool-label">Live input level</p>
                  <p className="mt-1 font-mono text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                    {formatDbfs(metrics.rmsDbfs)}{" "}
                    <span className="text-base text-muted-foreground">
                      dBFS
                    </span>
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p className="text-muted-foreground">Dominant frequency</p>
                  <p className="font-mono font-semibold text-foreground">
                    {formatFrequency(metrics.dominantFrequency)}
                  </p>
                  {note && (
                    <p className="text-xs text-primary">
                      {note.label} {note.cents >= 0 ? "+" : ""}
                      {note.cents}¢
                    </p>
                  )}
                </div>
              </div>

              <div>
                <div
                  className="relative h-4 overflow-hidden rounded-full border border-border bg-background"
                  aria-label={`Input level ${formatDbfs(metrics.rmsDbfs)} dBFS`}
                  role="meter"
                  aria-valuemin={-60}
                  aria-valuemax={0}
                  aria-valuenow={Math.max(-60, metrics.rmsDbfs)}
                >
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary via-primary to-destructive transition-[width] duration-100"
                    style={{ width: `${meterPercent}%` }}
                  />
                  <span
                    className="absolute inset-y-0 w-0.5 bg-foreground"
                    style={{ left: `${peakPercent}%` }}
                    aria-hidden="true"
                  />
                </div>
                <div className="mt-2 flex justify-between font-mono text-[0.65rem] text-muted-foreground">
                  <span>−60</span>
                  <span>−48</span>
                  <span>−36</span>
                  <span>−24</span>
                  <span>−12</span>
                  <span>0</span>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <Metric
                  label="Instant peak"
                  value={`${formatDbfs(metrics.peakDbfs)} dBFS`}
                />
                <Metric
                  label="Peak hold"
                  value={`${formatDbfs(metrics.peakHoldDbfs)} dBFS`}
                />
                <Metric
                  label="Clipping"
                  value={
                    metrics.clipCount > 0
                      ? `Detected · ${metrics.clipCount}`
                      : "None detected"
                  }
                  warning={metrics.clipCount > 0}
                />
              </div>

              <div className="tool-subpanel space-y-2">
                <div className="flex justify-between font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  <span>Waveform</span>
                  <span>Live signal</span>
                </div>
                <canvas
                  ref={waveformCanvas}
                  className="h-44 w-full rounded-md border border-border bg-background"
                  role="img"
                  aria-label="Live microphone waveform. Numeric levels are shown above."
                />
              </div>
            </div>

            <aside className="tool-panel-lg space-y-5">
              <div>
                <p className="tool-label">What we found</p>
                <Finding
                  healthy={status === "running"}
                  title={
                    status === "running"
                      ? "Your microphone is working"
                      : "Start the test to check input"
                  }
                  detail={
                    status === "running"
                      ? `Audio is arriving from ${activeDevice?.label || "the selected microphone"}.`
                      : "The browser will ask for microphone permission."
                  }
                />
                <Finding
                  healthy={signalHealthy}
                  title={
                    signalHealthy
                      ? "Speech level looks healthy"
                      : "Speak at your normal volume"
                  }
                  detail={
                    status === "running"
                      ? `Current RMS is ${formatDbfs(metrics.rmsDbfs)} dBFS.`
                      : "We will check the incoming level."
                  }
                />
                <Finding
                  healthy={metrics.dominantFrequency !== null}
                  title={
                    metrics.dominantFrequency !== null
                      ? "Frequency detection works"
                      : "No stable tone detected"
                  }
                  detail={
                    metrics.dominantFrequency !== null
                      ? `Stable energy near ${formatFrequency(metrics.dominantFrequency)}.`
                      : "Speech and noise may not have one stable pitch."
                  }
                />
                <Finding
                  healthy={status === "running" && metrics.clipCount === 0}
                  warning={metrics.clipCount > 0}
                  title={
                    status !== "running"
                      ? "Peak test is waiting"
                      : metrics.clipCount > 0
                        ? `${metrics.clipCount} clipped peak${metrics.clipCount === 1 ? "" : "s"}`
                        : "No clipped peaks"
                  }
                  detail={
                    status !== "running"
                      ? "Start the microphone to monitor peak level."
                      : metrics.clipCount > 0
                        ? "Lower microphone gain and retry the peak test."
                        : "Peak hold has stayed below full scale."
                  }
                />
              </div>

              {status === "running" && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="tool-button flex-1"
                    onClick={stopTest}
                  >
                    <Square className="mr-2 inline h-3.5 w-3.5" />
                    Stop test
                  </button>
                  <button
                    type="button"
                    className="tool-button-secondary flex-1"
                    onClick={resetPeak}
                  >
                    <RotateCcw className="mr-2 inline h-3.5 w-3.5" />
                    Reset peak
                  </button>
                </div>
              )}
            </aside>
          </section>

          <section className="grid gap-6 lg:grid-cols-[1fr_340px]">
            <div className="tool-panel-lg space-y-3">
              <div className="flex justify-between font-mono text-xs uppercase tracking-wider text-muted-foreground">
                <span>Frequency spectrum</span>
                <span>20 Hz to 20 kHz</span>
              </div>
              <canvas
                ref={spectrumCanvas}
                className="h-48 w-full rounded-md border border-border bg-background"
                role="img"
                aria-label="Live microphone frequency spectrum. Dominant frequency is shown as text above."
              />
              <div className="flex justify-between font-mono text-[0.65rem] text-muted-foreground">
                <span>20 Hz</span>
                <span>100 Hz</span>
                <span>1 kHz</span>
                <span>10 kHz</span>
                <span>20 kHz</span>
              </div>
            </div>

            <aside className="tool-panel-lg space-y-4">
              <div>
                <label htmlFor="microphone-device" className="tool-label">
                  Input device
                </label>
                <select
                  id="microphone-device"
                  className="tool-field mt-2 w-full"
                  disabled={status !== "running" || devices.length === 0}
                  value={selectedDeviceId}
                  onChange={(event) => {
                    const deviceId = event.target.value;
                    setSelectedDeviceId(deviceId);
                    void startTest(deviceId);
                  }}
                >
                  {devices.length === 0 && (
                    <option value="">Default microphone</option>
                  )}
                  {devices.map((device, index) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Microphone ${index + 1}`}
                    </option>
                  ))}
                </select>
              </div>
              <dl className="tool-subpanel space-y-3 text-sm">
                <Detail
                  label="Sample rate"
                  value={
                    trackSettings?.sampleRate
                      ? `${trackSettings.sampleRate.toLocaleString()} Hz`
                      : "Unavailable"
                  }
                />
                <Detail
                  label="Channels"
                  value={
                    trackSettings?.channelCount?.toString() ?? "Unavailable"
                  }
                />
                <Detail
                  label="Auto gain"
                  value={
                    trackSettings?.autoGainControl === undefined
                      ? "Browser controlled"
                      : trackSettings.autoGainControl
                        ? "On"
                        : "Off"
                  }
                />
                <Detail
                  label="Noise suppression"
                  value={
                    trackSettings?.noiseSuppression === undefined
                      ? "Browser controlled"
                      : trackSettings.noiseSuppression
                        ? "On"
                        : "Off"
                  }
                />
                <Detail
                  label="Echo cancellation"
                  value={
                    trackSettings?.echoCancellation === undefined
                      ? "Browser controlled"
                      : trackSettings.echoCancellation
                        ? "On"
                        : "Off"
                  }
                />
              </dl>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Levels are digital dBFS, not calibrated sound pressure. Browser
                and device processing can change readings.
              </p>
            </aside>
          </section>
        </>
      )}
    </div>
  );
}

function StatusCard({
  label,
  value,
  healthy,
  warning = false,
}: {
  label: string;
  value: string;
  healthy: boolean;
  warning?: boolean;
}) {
  return (
    <div
      className={`tool-panel border-t-2 ${warning ? "border-t-destructive" : healthy ? "border-t-primary" : "border-t-border"}`}
    >
      <p className="tool-label">{label}</p>
      <p
        className={`mt-2 font-mono text-base font-semibold ${warning ? "text-destructive" : "text-foreground"}`}
      >
        {value}
      </p>
    </div>
  );
}

function Metric({
  label,
  value,
  warning = false,
}: {
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <div className="tool-subpanel">
      <p className="tool-label">{label}</p>
      <p
        className={`mt-2 font-mono text-lg font-semibold ${warning ? "text-destructive" : "text-foreground"}`}
      >
        {value}
      </p>
    </div>
  );
}

function Finding({
  healthy,
  warning = false,
  title,
  detail,
}: {
  healthy: boolean;
  warning?: boolean;
  title: string;
  detail: string;
}) {
  const Icon = warning ? TriangleAlert : healthy ? Check : Radio;
  return (
    <div className="flex gap-3 border-t border-border py-4 first:border-t-0">
      <span
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${warning ? "border-destructive/50 text-destructive" : healthy ? "border-primary/50 text-primary" : "border-border text-muted-foreground"}`}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {detail}
        </p>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  );
}
