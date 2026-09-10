import { ChevronDown, ChevronUp, Download, ImagePlus, Maximize2, Minimize2, Pause, Play, RotateCcw, SkipBack, SkipForward, Trash2, Upload, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { readPhoto, revokePhoto, sortPhotos } from "./metadata";
import { acceptFiles } from "./ingestion";
import { exportJourney, formatDistance, journeySummary } from "./journey-data";
import JourneyStage from "./JourneyStage";
import Inspector from "./Inspector";
import { usePlayback, useReducedMotion } from "./usePlayback";
import type { JourneyPhoto } from "./types";
import "./photo-journey.css";

const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";
function formatDuration(milliseconds: number) {
  const seconds = Math.round(milliseconds / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function Segmented<T extends string>({ label, value, options, disabled, onChange }: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  disabled?: boolean;
  onChange: (value: T) => void;
}) {
  return <fieldset className="pj-segmented" disabled={disabled}>
    <legend>{label}</legend>
    {options.map((option) => <label key={option.value}>
      <input type="radio" name={`pj-${label}`} checked={value === option.value} onChange={() => onChange(option.value)} />
      <span>{option.label}</span>
    </label>)}
  </fieldset>;
}

export default function PhotoJourney() {
  const [photos, setPhotos] = useState<JourneyPhoto[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [importProgress, setImportProgress] = useState("");
  const [order, setOrder] = useState<"capture" | "manual">("capture");
  const [title, setTitle] = useState("My photo journey");
  const [offline, setOffline] = useState(true);
  const [kenBurns, setKenBurns] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef(photos);
  const importing = useRef(false);
  const mounted = useRef(true);
  const nextImportOrder = useRef(0);
  const playback = usePlayback(photos);
  const reducedMotion = useReducedMotion();
  const activeIndex = playback.state.photoIndex;
  const activePhoto = photos[activeIndex];
  const summary = useMemo(() => journeySummary(photos), [photos]);
  const finished = playback.elapsed >= playback.total;

  useEffect(() => { photosRef.current = photos; }, [photos]);
  // The stage is sized to the window, so bringing it into view shows the whole frame and controls.
  function revealStage(block: ScrollLogicalPosition) {
    stageRef.current?.scrollIntoView({ block, behavior: reducedMotion ? "auto" : "smooth" });
  }
  function togglePlay() {
    if (!playback.playing) revealStage("nearest");
    playback.toggle();
  }
  const hasPhotos = photos.length > 0;
  useEffect(() => { if (hasPhotos) revealStage("start"); }, [hasPhotos]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; photosRef.current.forEach(revokePhoto); };
  }, []);
  useEffect(() => {
    const update = () => setFullscreen(document.fullscreenElement === stageRef.current);
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement === stageRef.current) await document.exitFullscreen();
      else await stageRef.current?.requestFullscreen();
    } catch { setErrors(["Fullscreen is unavailable in this browser."]); }
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target;
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey ||
        (target instanceof HTMLElement && (target.isContentEditable || target.closest("input,textarea,select,button,a")))) return;
      if (!photos.length) return;
      if (event.code === "Space") { event.preventDefault(); togglePlay(); }
      else if (event.key === "ArrowLeft") { event.preventDefault(); playback.select(activeIndex - 1); }
      else if (event.key === "ArrowRight") { event.preventDefault(); playback.select(activeIndex + 1); }
      else if (event.key.toLowerCase() === "f") { event.preventDefault(); void toggleFullscreen(); }
      else if (event.key === "Escape" && fullscreen) void toggleFullscreen();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  async function addFiles(files: File[]) {
    if (importing.current || !files.length) return;
    importing.current = true;
    setBusy(true);
    playback.pause();
    setErrors([]);
    const { accepted, skipped } = acceptFiles(files, photosRef.current);
    const failures = skipped.map(({ file, reason }) => `${file.name}: ${reason}`);
    const loaded: JourneyPhoto[] = [];
    // Decode one original at a time so a large folder does not exhaust memory.
    for (const [index, file] of accepted.entries()) {
      if (!mounted.current) break;
      setImportProgress(`${index + 1} / ${accepted.length}`);
      try { loaded.push(await readPhoto(file, nextImportOrder.current++)); }
      catch (error) { failures.push(`${file.name}: ${error instanceof Error ? error.message : "Could not read this image."}`); }
    }
    if (!mounted.current) { loaded.forEach(revokePhoto); importing.current = false; return; }
    setPhotos((current) => order === "capture" ? sortPhotos([...current, ...loaded]) : [...current, ...loaded]);
    setErrors(failures);
    setBusy(false);
    setImportProgress("");
    importing.current = false;
    playback.seek(0);
  }

  function removePhoto(id: string) {
    const removed = photos.find((photo) => photo.id === id);
    if (removed) revokePhoto(removed);
    setPhotos(photos.filter((photo) => photo.id !== id));
    playback.seek(0);
  }
  function movePhoto(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= photos.length) return;
    const next = [...photos];
    [next[index], next[target]] = [next[target], next[index]];
    setPhotos(next);
    setOrder("manual");
    playback.seek(0);
  }
  function download(format: "gpx" | "geojson" | "json") {
    const result = exportJourney(photos, format, title);
    const url = URL.createObjectURL(new Blob([result.content], { type: result.mime }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `photo-journey.${result.extension}`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <div className="photo-journey">
    <input ref={inputRef} type="file" accept={ACCEPT} multiple hidden onChange={(event) => {
      void addFiles([...(event.target.files ?? [])]); event.target.value = "";
    }} />
    {!photos.length ? <section className="pj-upload" data-dragging={dragging}
      onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => { event.preventDefault(); setDragging(false); void addFiles([...event.dataTransfer.files]); }}>
      <div className="pj-upload-icon"><Upload size={22} /></div>
      <h2>{busy ? `Reading photos ${importProgress}` : "Drop your journey photos here"}</h2>
      <p>JPEG, PNG, WebP, or HEIC. Up to 100 photos and 500 MB. Photos stay in this tab, and place names come from a bundled offline list.</p>
      <button className="pj-pill" data-tone="accent" disabled={busy} onClick={() => inputRef.current?.click()}><ImagePlus size={16} />Choose photos</button>
    </section> : <>
      <div className="pj-bar">
        <input className="pj-title" aria-label="Journey title" value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} />
        <div className="pj-bar-actions">
          <Segmented label="Map" value={offline ? "offline" : "online"} onChange={(value) => setOffline(value === "offline")}
            options={[{ value: "offline", label: "Offline" }, { value: "online", label: "OpenStreetMap" }]} />
          <Segmented label="Order" value={order} disabled={busy} onChange={(value) => {
            setOrder(value); if (value === "capture") setPhotos(sortPhotos(photos)); playback.seek(0);
          }} options={[{ value: "capture", label: "By time" }, { value: "manual", label: "Manual" }]} />
          <label className="pj-pill pj-toggle" data-disabled={reducedMotion}>
            <input type="checkbox" checked={kenBurns && !reducedMotion} disabled={reducedMotion} onChange={(event) => setKenBurns(event.target.checked)} />
            Slow zoom
          </label>
          <button className="pj-pill" data-tone="accent" disabled={busy} onClick={() => inputRef.current?.click()}><ImagePlus size={16} />{busy ? `Reading ${importProgress}` : "Add photos"}</button>
        </div>
      </div>
      <div className="pj-stage" ref={stageRef}>
        <JourneyStage photos={photos} activeIndex={activeIndex} state={playback.state} timeline={playback.timeline} playing={playback.playing}
          reducedMotion={reducedMotion} offline={offline} kenBurns={kenBurns} title={title} speed={playback.speed} seekVersion={playback.seekVersion} />
        <div className="pj-controls">
          <div className="pj-transport">
            <button disabled={activeIndex === 0} onClick={() => playback.select(activeIndex - 1)} aria-label="Previous photo"><SkipBack /></button>
            <button className="pj-play" onClick={togglePlay} aria-label={playback.playing ? "Pause journey" : finished ? "Replay journey" : "Play journey"}>
              {finished ? <RotateCcw /> : playback.playing ? <Pause /> : <Play />}</button>
            <button disabled={activeIndex >= photos.length - 1} onClick={() => playback.select(activeIndex + 1)} aria-label="Next photo"><SkipForward /></button>
          </div>
          <div className="pj-scrub">
            <div className="pj-scrub-track" aria-hidden="true">
              <div className="pj-scrub-fill" style={{ transform: `scaleX(${playback.total ? playback.elapsed / playback.total : 0})` }} />
              {playback.timeline.stops.map((stop) => <i key={stop.photoIndex} data-past={playback.elapsed >= stop.revealStart}
                style={{ left: `${(stop.revealStart / playback.total) * 100}%` }} />)}
            </div>
            <input type="range" min={0} max={playback.total} value={playback.elapsed} onChange={(event) => playback.seek(Number(event.target.value))} aria-label="Journey progress" />
          </div>
          <span className="pj-time">{formatDuration(playback.elapsed)} <span>/ {formatDuration(playback.total)}</span></span>
          <select className="pj-speed" value={playback.speed} onChange={(event) => playback.setSpeed(Number(event.target.value))} aria-label="Playback speed">
            <option value={0.75}>0.75×</option><option value={1}>1×</option><option value={1.5}>1.5×</option><option value={2}>2×</option></select>
          <button onClick={() => void toggleFullscreen()} aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}>{fullscreen ? <Minimize2 /> : <Maximize2 />}</button>
        </div>
      </div>
      <div className="pj-notes">
        <p>{offline ? "Offline map. No map requests leave this tab." : "OpenStreetMap receives requests for the areas shown."}</p>
        <p className="pj-keys"><kbd>Space</kbd> play <kbd>←</kbd><kbd>→</kbd> stops <kbd>F</kbd> fullscreen</p>
      </div>
      <div className="pj-workspace">
        <section className="pj-panel pj-stops" aria-label="Journey order">
          <header className="pj-panel-head">
            <span className="pj-label">{summary.photoCount} photos · {summary.locatedCount} located · {formatDistance(summary.distanceKm)}</span>
            <h2>Stops</h2>
            <div className="pj-exports" aria-label="Export journey">
              <Download size={14} aria-hidden="true" />
              {(["gpx", "geojson", "json"] as const).map((format) =>
                <button key={format} className="pj-pill" data-size="sm" onClick={() => download(format)}>{format === "geojson" ? "GeoJSON" : format.toUpperCase()}</button>)}
            </div>
          </header>
          <ol className="pj-stop-list">{photos.map((photo, index) => <li key={photo.id} data-selected={index === activeIndex}>
            <button className="pj-stop" aria-current={index === activeIndex ? "step" : undefined} onClick={() => playback.select(index)}>
              <img src={photo.thumbnailUrl} alt="" loading="lazy" />
              <span className="pj-stop-index">{String(index + 1).padStart(2, "0")}</span>
              <span className="pj-stop-text">
                <strong>{photo.name}</strong>
                <small data-located={Boolean(photo.metadata.coordinates)}>{photo.metadata.place ?? "No GPS"}{photo.metadata.capturedAtLabel ? ` · ${photo.metadata.capturedAtLabel}` : ""}</small>
              </span>
            </button>
            <div className="pj-stop-actions">
              <button disabled={busy || index === 0} onClick={() => movePhoto(index, -1)} aria-label={`Move ${photo.name} earlier`}><ChevronUp /></button>
              <button disabled={busy || index === photos.length - 1} onClick={() => movePhoto(index, 1)} aria-label={`Move ${photo.name} later`}><ChevronDown /></button>
              <button disabled={busy} onClick={() => removePhoto(photo.id)} aria-label={`Remove ${photo.name}`}><Trash2 /></button>
            </div>
          </li>)}</ol>
        </section>
        <Inspector photo={activePhoto} index={activeIndex} />
      </div>
    </>}
    {errors.length > 0 && <div className="pj-errors" role="status">
      <button onClick={() => setErrors([])} aria-label="Dismiss messages"><X size={14} /></button>
      {errors.map((error, index) => <p key={index}>{error}</p>)}
    </div>}
  </div>;
}
