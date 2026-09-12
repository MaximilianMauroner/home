import { Download, ImagePlus, LoaderCircle, Maximize2, Minimize2, Package, Pause, Play, Route, RotateCcw, SkipBack, SkipForward, Upload, Video, X } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isValidUtcOffsetMinutes, parseOffsetMinutes, readPhoto, revokePhoto, sortPhotos } from "./metadata";
import { acceptFiles, digestFile, expandJourneyArchives, filesEqual, isArchiveFile, MAX_GPX_BYTES, MAX_GPX_POINTS, MAX_GPX_TOTAL_BYTES } from "./ingestion";
import { mergeTracks, parseGpx, trackStats } from "./gpx";
import { buildBundle, buildScopedBundle, exportJourney, formatDistance, journeySummary, type ExportFormat } from "./journey-data";
import { ALL_DAYS, dayLabel, deriveJourneyDays, filterTrackToDay, normalizeTimezone, photoDayKey, scopedPhotos, UNDATED_DAY, type DayScope } from "./days";
import JourneyStage from "./JourneyStage";
import Inspector from "./Inspector";
import StopList from "./StopList";
import RecordingList from "./RecordingList";
import type { MapMode } from "./JourneyMap";
import { journeyStops, overlappingRecordingIds, placementSummary, resolvePlacementsForRecordings, type PlacementChoice } from "./track";
import { usePlayback, useReducedMotion } from "./usePlayback";
import type { JourneyPhoto, JourneyRecording } from "./types";
import "./photo-journey.css";

const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif,.gpx,application/gpx+xml,.zip,application/zip,application/x-zip-compressed";
function formatDuration(milliseconds: number) {
  const seconds = Math.round(milliseconds / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function downloadStem(value: string) {
  return value.trim().replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || "photo-journey";
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

function formatBytes(bytes: number) {
  if (bytes < 1e6) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return bytes >= 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${Math.round(bytes / 1e6)} MB`;
}

const ScrubberTicks = memo(function ScrubberTicks({
  stops,
  completedThrough,
  total,
}: {
  stops: ReturnType<typeof usePlayback>["timeline"]["stops"];
  completedThrough: number;
  total: number;
}) {
  return stops.map((stop) => <i key={stop.id} data-past={stop.photoIndex <= completedThrough}
    style={{ left: `${(stop.revealStart / total) * 100}%` }} />);
});

function ExportPanel({
  scopeLabel,
  summary,
  hasPhotos,
  photoBytes,
  includePhotos,
  packing,
  recordingVideo,
  busy,
  onExport,
  onIncludePhotos,
  onBundle,
  onVideo,
}: {
  scopeLabel: string;
  summary: ReturnType<typeof journeySummary>;
  hasPhotos: boolean;
  photoBytes: number;
  includePhotos: boolean;
  packing: boolean;
  recordingVideo: boolean;
  busy: boolean;
  onExport: (format: ExportFormat) => void;
  onIncludePhotos: (value: boolean) => void;
  onBundle: () => void;
  onVideo: () => void;
}) {
  return <section className="pj-panel pj-export" aria-label="Journey exports">
    <header className="pj-panel-head">
      <span className="pj-label">Export</span>
      <h2>{scopeLabel}</h2>
      <p className="pj-export-summary">
        {summary.locatedCount} photo waypoint{summary.locatedCount === 1 ? "" : "s"}
        {summary.track ? ` · ${summary.track.pointCount.toLocaleString("en")} recorded points` : ""}
        {summary.unlocatedCount ? ` · ${summary.unlocatedCount} photo${summary.unlocatedCount === 1 ? "" : "s"} without a position omitted` : ""}
      </p>
    </header>
    <div className="pj-export-actions">
      <button className="pj-pill" data-tone="accent" disabled={busy} onClick={() => onExport("gpx")}><Download size={15} aria-hidden="true" />Download GPX</button>
      <button className="pj-pill" disabled={busy} onClick={() => onExport("geojson")}>GeoJSON</button>
      <button className="pj-pill" disabled={busy} onClick={() => onExport("json")}>Metadata JSON</button>
      <button className="pj-pill" disabled={busy || packing} onClick={onBundle}><Package size={15} aria-hidden="true" />{packing ? "Packing…" : "Bundle this scope"}</button>
      <button className="pj-pill" disabled={busy || !hasPhotos} onClick={onVideo}><Video size={15} aria-hidden="true" />{recordingVideo ? "Stop and save video" : "Export video"}</button>
      {hasPhotos && <label className="pj-pill pj-toggle" data-size="sm">
        <input type="checkbox" checked={includePhotos} onChange={(event) => onIncludePhotos(event.target.checked)} />
        Include photos ({formatBytes(photoBytes)})
      </label>}
    </div>
  </section>;
}

export default function PhotoJourney() {
  const [photos, setPhotos] = useState<JourneyPhoto[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [importProgress, setImportProgress] = useState("");
  const [order, setOrder] = useState<"capture" | "manual">("capture");
  const [title, setTitle] = useState("My photo journey");
  const [mapMode, setMapMode] = useState<MapMode>("terrain");
  const [terrain, setTerrain] = useState({ loading: false, failed: false });
  const [mapDead, setMapDead] = useState(false);
  const [editingOrder, setEditingOrder] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [recordings, setRecordings] = useState<JourneyRecording[]>([]);
  const [tripTimezone, setTripTimezone] = useState(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; }
    catch { return "UTC"; }
  });
  const [selectedDay, setSelectedDay] = useState<DayScope>(ALL_DAYS);
  const [offsetMinutesByPhoto, setOffsetMinutesByPhoto] = useState<Record<string, number>>({});
  const [fallbackOffsetInput, setFallbackOffsetInput] = useState("");
  const [placementChoices, setPlacementChoices] = useState<Record<string, PlacementChoice>>({});
  const [includePhotos, setIncludePhotos] = useState(false);
  const [packing, setPacking] = useState(false);
  const [recordingVideo, setRecordingVideo] = useState(false);
  const [stageReady, setStageReady] = useState(false);
  const [waitingToPlay, setWaitingToPlay] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<MediaRecorder>();
  const captureRef = useRef<MediaStream>();
  const inputRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef(photos);
  const importing = useRef(false);
  const mounted = useRef(true);
  const nextImportOrder = useRef(0);
  const nextRecordingOrder = useRef(0);
  const pendingStart = useRef<{ fromBeginning: boolean }>();
  const track = useMemo(() => {
    const included = recordings.filter((recording) => recording.included);
    return included.length ? mergeTracks(included.map((recording) => recording.track)) : undefined;
  }, [recordings]);
  const placements = useMemo(
    () => resolvePlacementsForRecordings(photos, recordings, {
      offsetMinutesByPhoto,
      choices: placementChoices,
    }),
    [photos, recordings, offsetMinutesByPhoto, placementChoices],
  );
  const days = useMemo(() => deriveJourneyDays(photos, placements, recordings, tripTimezone), [photos, placements, recordings, tripTimezone]);
  const scopedEntries = useMemo(() => scopedPhotos(photos, placements, selectedDay, tripTimezone), [photos, placements, selectedDay, tripTimezone]);
  const visiblePhotos = useMemo(() => scopedEntries.map((entry) => entry.photo), [scopedEntries]);
  const visiblePlacements = useMemo(() => scopedEntries.map((entry) => entry.placement), [scopedEntries]);
  const scopedTrack = useMemo(() => filterTrackToDay(track, selectedDay, tripTimezone), [track, selectedDay, tripTimezone]);
  const stops = useMemo(() => journeyStops(visiblePlacements), [visiblePlacements]);
  const stats = useMemo(() => (scopedTrack ? trackStats(scopedTrack) : undefined), [scopedTrack]);
  const summary = useMemo(() => journeySummary(visiblePhotos, visiblePlacements, stats, tripTimezone, scopedTrack), [visiblePhotos, visiblePlacements, stats, tripTimezone, scopedTrack]);
  const placed = useMemo(() => placementSummary(visiblePlacements), [visiblePlacements]);
  const overlappingIds = useMemo(() => overlappingRecordingIds(recordings), [recordings]);
  const photoBytes = useMemo(() => visiblePhotos.reduce((sum, photo) => sum + photo.file.size, 0), [visiblePhotos]);
  const trackNote = useMemo(() => {
    if (!stats) return undefined;
    const plural = (count: number) => (count === 1 ? "" : "s");
    return [
      `${formatDistance(stats.distanceKm)} recorded`,
      overlappingIds.size ? "sum of included recordings; overlaps may be counted twice" : undefined,
      stats.ascentM >= 20 ? `${Math.round(stats.ascentM).toLocaleString("en")} m ascent` : undefined,
      placed.fromTrack ? `${placed.fromTrack} photo${plural(placed.fromTrack)} placed from a recording` : undefined,
      placed.correctedCount ? `${placed.correctedCount} photo${plural(placed.correctedCount)} differ from camera GPS` : undefined,
    ].filter(Boolean).join(" · ");
  }, [stats, placed, overlappingIds]);
  const timelineDayKeys = useMemo(() => visiblePhotos.map((photo, index) => photoDayKey(photo, visiblePlacements[index], tripTimezone) ?? UNDATED_DAY), [visiblePhotos, visiblePlacements, tripTimezone]);
  const timelineDayLabels = useMemo(() => timelineDayKeys.map((key) => key ? dayLabel(days, key) : undefined), [timelineDayKeys, days]);
  const playback = usePlayback(visiblePhotos, visiblePlacements, { dayKeys: timelineDayKeys, dayLabels: timelineDayLabels });
  const reducedMotion = useReducedMotion();
  const activeIndex = playback.state.photoIndex;
  const completedThrough = playback.state.phase === "outro" || playback.state.phase === "complete"
    ? visiblePhotos.length - 1
    : playback.state.phase === "reveal" || playback.state.phase === "hold" || playback.state.phase === "departure"
      ? playback.state.checkpointPhotoIndex
      : playback.state.checkpointPhotoIndex - 1;
  const activePhoto = visiblePhotos[activeIndex];
  const finished = playback.elapsed >= playback.total;
  const stopVideoExport = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder?.state === "recording") recorder.stop();
    captureRef.current?.getTracks().forEach((captureTrack) => captureTrack.stop());
  }, []);

  useEffect(() => {
    if (recordingVideo && finished) stopVideoExport();
  }, [finished, recordingVideo, stopVideoExport]);

  const cancelPendingStart = useCallback(() => {
    pendingStart.current = undefined;
    setWaitingToPlay(false);
  }, []);
  const pausePlayback = useCallback(() => {
    cancelPendingStart();
    playback.pause();
  }, [cancelPendingStart, playback.pause]);
  const requestPlaybackStart = useCallback((fromBeginning = false) => {
    if (stageReady) {
      cancelPendingStart();
      playback.play(fromBeginning);
      return;
    }
    pendingStart.current = { fromBeginning };
    setWaitingToPlay(true);
  }, [cancelPendingStart, playback.play, stageReady]);
  useEffect(() => {
    const pending = pendingStart.current;
    if (!stageReady || !pending) return;
    pendingStart.current = undefined;
    setWaitingToPlay(false);
    playback.play(pending.fromBeginning);
  }, [playback.play, stageReady]);

  useEffect(() => { photosRef.current = photos; }, [photos]);
  useEffect(() => {
    if (selectedDay !== ALL_DAYS && !days.some((entry) => entry.key === selectedDay)) setSelectedDay(ALL_DAYS);
  }, [days, selectedDay]);
  const previousDayRef = useRef<DayScope>(ALL_DAYS);
  useEffect(() => {
    if (previousDayRef.current !== selectedDay && visiblePhotos.length) {
      cancelPendingStart();
      playback.restart();
    }
    previousDayRef.current = selectedDay;
  }, [cancelPendingStart, playback.restart, selectedDay, visiblePhotos.length]);
  useEffect(() => {
    if (order !== "capture" || photos.length < 2) return;
    const sorted = sortPhotos(photos, placements.map((placement) => placement.instant));
    if (sorted.some((photo, index) => photo.id !== photos[index]?.id)) setPhotos(sorted);
  }, [order, photos, placements]);
  // The stage is sized to the window, so bringing it into view shows the whole frame and controls.
  function revealStage(block: ScrollLogicalPosition) {
    stageRef.current?.scrollIntoView({ block, behavior: reducedMotion ? "auto" : "smooth" });
  }
  function togglePlay() {
    if (playback.playing || waitingToPlay) {
      pausePlayback();
      return;
    }
    revealStage("nearest");
    requestPlaybackStart(finished);
  }
  const hasPhotos = visiblePhotos.length > 0;
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

  async function exportVideo() {
    if (recordingVideo) {
      stopVideoExport();
      return;
    }
    if (!navigator.mediaDevices?.getDisplayMedia || typeof MediaRecorder === "undefined") {
      setErrors(["Video export is unavailable in this browser."]);
      return;
    }
    try {
      pausePlayback();
      setErrors([]);
      revealStage("start");
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: false,
        // Chromium uses these hints to put this tab first in the capture picker.
        preferCurrentTab: true,
        selfBrowserSurface: "include",
      } as DisplayMediaStreamOptions);
      const mimeType = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]
        .find((type) => MediaRecorder.isTypeSupported(type));
      const chunks: Blob[] = [];
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      captureRef.current = stream;
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = () => {
        if (chunks.length) {
          save(new Blob(chunks, { type: recorder.mimeType || "video/webm" }), `${downloadStem(title)}.webm`);
        }
        stream.getTracks().forEach((captureTrack) => captureTrack.stop());
        recorderRef.current = undefined;
        captureRef.current = undefined;
        setRecordingVideo(false);
        pausePlayback();
      };
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (recorder.state === "recording") recorder.stop();
      }, { once: true });
      recorder.start(1000);
      setRecordingVideo(true);
      requestPlaybackStart(true);
    } catch (error) {
      captureRef.current?.getTracks().forEach((captureTrack) => captureTrack.stop());
      setRecordingVideo(false);
      if ((error as DOMException)?.name !== "NotAllowedError") {
        setErrors([`The video could not be recorded: ${error instanceof Error ? error.message : "unknown error"}`]);
      }
    }
  }

  function onKey(event: KeyboardEvent) {
    const target = event.target;
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey ||
      (target instanceof HTMLElement && (target.isContentEditable || target.closest("input,textarea,select,button,a")))) return;
    if (!hasPhotos) return;
    if (event.code === "Space") { event.preventDefault(); togglePlay(); }
    else if (event.key === "ArrowLeft") { event.preventDefault(); playback.select(activeIndex - 1); }
    else if (event.key === "ArrowRight") { event.preventDefault(); playback.select(activeIndex + 1); }
    else if (event.key.toLowerCase() === "f") { event.preventDefault(); void toggleFullscreen(); }
    else if (event.key === "Escape" && fullscreen) void toggleFullscreen();
  }
  // The clock renders this component on every frame, so the listener is bound once and
  // reads the current handler instead of being replaced sixty times a second.
  const keyHandler = useRef(onKey);
  keyHandler.current = onKey;
  useEffect(() => {
    const listener = (event: KeyboardEvent) => keyHandler.current(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  async function addFiles(files: File[]) {
    if (importing.current || !files.length) return;
    importing.current = true;
    setBusy(true);
    pausePlayback();
    setErrors([]);
    const archives = files.filter(isArchiveFile);
    let flatFiles = files.filter((file) => !isArchiveFile(file));
    const failures: string[] = [];
    if (archives.length) {
      setImportProgress(`Unpacking ${archives.length} ZIP${archives.length === 1 ? "" : "s"}…`);
      try {
        const { expanded, skipped } = await expandJourneyArchives(archives);
        flatFiles = [...flatFiles, ...expanded.files];
        for (const { file, reason } of skipped) failures.push(`${file.name}: ${reason}`);
        if (expanded.bundleTitle && photosRef.current.length === 0 && recordings.length === 0) {
          setTitle(expanded.bundleTitle);
        }
      } catch {
        for (const archive of archives) failures.push(`${archive.name}: could not be read as a ZIP`);
      }
    }
    const { accepted, tracks, skipped } = acceptFiles(flatFiles, photosRef.current);
    failures.push(...skipped.map(({ file, reason }) => `${file.name}: ${reason}`));
    const existingDigests = new Set(recordings.map((recording) => recording.digest));
    let recordingBytes = recordings.reduce((sum, recording) => sum + recording.file.size, 0);
    let recordingPoints = recordings.reduce((sum, recording) => sum + recording.track.points.length, 0);
    const loadedRecordings: JourneyRecording[] = [];
    if (tracks.length) {
      for (const file of tracks) {
        if (file.size > MAX_GPX_BYTES) { failures.push(`${file.name}: GPX exceeds the ${Math.round(MAX_GPX_BYTES / 1024 / 1024)} MB limit`); continue; }
        if (recordingBytes + file.size > MAX_GPX_TOTAL_BYTES) { failures.push(`${file.name}: GPX sources exceed the ${Math.round(MAX_GPX_TOTAL_BYTES / 1024 / 1024)} MB total limit`); continue; }
        try {
          const digest = await digestFile(file);
          if (existingDigests.has(digest)) {
            const possibleDuplicates = [...recordings, ...loadedRecordings].filter((recording) => recording.digest === digest);
            let duplicate = false;
            for (const recording of possibleDuplicates) {
              if (await filesEqual(file, recording.file)) { duplicate = true; break; }
            }
            if (duplicate) { failures.push(`${file.name}: this GPX is already imported`); continue; }
          }
          const parsed = parseGpx(await file.text());
          if (recordingPoints + parsed.points.length > MAX_GPX_POINTS) { failures.push(`${file.name}: recordings exceed the ${MAX_GPX_POINTS.toLocaleString("en")} point limit`); continue; }
          const importOrder = nextRecordingOrder.current++;
          const warnings: string[] = [];
          if (parsed.parts && parsed.parts.length > 1) warnings.push(`${parsed.parts.length} recorded tracks in this file`);
          const untimed = parsed.points.length - parsed.points.filter((point) => point.time !== undefined).length;
          if (untimed) warnings.push(`${untimed.toLocaleString("en")} point${untimed === 1 ? "" : "s"} have no time and stay under Undated`);
          loadedRecordings.push({
            id: `gpx-${digest.slice(0, 16)}-${importOrder}`,
            file,
            name: parsed.name ?? file.name.replace(/\.gpx$/i, ""),
            digest,
            track: parsed,
            importOrder,
            included: true,
            warnings,
          });
          existingDigests.add(digest);
          recordingBytes += file.size;
          recordingPoints += parsed.points.length;
        } catch (error) {
          failures.push(`${file.name}: ${error instanceof Error ? error.message : "could not be read"}`);
        }
      }
      if (loadedRecordings.length) setRecordings((current) => [...current, ...loadedRecordings]);
    }
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

  const { seek } = playback;
  const removePhoto = useCallback((id: string) => {
    const removed = photos.find((photo) => photo.id === id);
    if (removed) revokePhoto(removed);
    setPhotos(photos.filter((photo) => photo.id !== id));
    seek(0);
  }, [photos, seek]);
  const toggleRecording = useCallback((id: string) => {
    setRecordings((current) => current.map((recording) => recording.id === id ? { ...recording, included: !recording.included } : recording));
    setPlacementChoices((current) => {
      const affected = new Set(placements.filter((placement) => placement.recordingId === id).map((placement) => placement.photoId));
      return Object.fromEntries(Object.entries(current).filter(([photoId, choice]) => {
        const boundToRemoved = typeof choice === "object" && choice.source === "track" && choice.recordingId === id;
        return !boundToRemoved && (choice !== "track" || !affected.has(photoId));
      }));
    });
    seek(0);
  }, [placements, seek]);
  const removeRecording = useCallback((id: string) => {
    setRecordings((current) => current.filter((recording) => recording.id !== id));
    setPlacementChoices((current) => {
      const affected = new Set(placements.filter((placement) => placement.recordingId === id).map((placement) => placement.photoId));
      return Object.fromEntries(Object.entries(current).filter(([photoId, choice]) => {
        const boundToRemoved = typeof choice === "object" && choice.source === "track" && choice.recordingId === id;
        return !boundToRemoved && (choice !== "track" || !affected.has(photoId));
      }));
    });
    seek(0);
  }, [placements, seek]);
  const choosePlacement = useCallback((photoId: string, choice: PlacementChoice | undefined) => {
    setPlacementChoices((current) => {
      const next = { ...current };
      if (choice) next[photoId] = choice;
      else delete next[photoId];
      return next;
    });
    seek(0);
  }, [seek]);
  const setPhotoOffset = useCallback((photoId: string, minutes: number | undefined) => {
    if (minutes !== undefined && !isValidUtcOffsetMinutes(minutes)) return;
    setOffsetMinutesByPhoto((current) => {
      const next = { ...current };
      if (minutes === undefined) delete next[photoId];
      else next[photoId] = minutes;
      return next;
    });
    seek(0);
  }, [seek]);
  const downloadOriginal = useCallback((recording: JourneyRecording) => {
    save(recording.file, recording.file.name);
  }, []);
  const movePhoto = useCallback((index: number, direction: -1 | 1) => {
    const photo = visiblePhotos[index];
    const targetPhoto = visiblePhotos[index + direction];
    const sourceIndex = photo ? photos.findIndex((entry) => entry.id === photo.id) : -1;
    if (sourceIndex < 0 || !targetPhoto) return;
    const day = photoDayKey(photo, visiblePlacements[index], tripTimezone) ?? UNDATED_DAY;
    const positions = photos.flatMap((entry, entryIndex) =>
      (photoDayKey(entry, placements[entryIndex], tripTimezone) ?? UNDATED_DAY) === day ? [entryIndex] : [],
    );
    const dayIndex = positions.indexOf(sourceIndex);
    const target = positions[dayIndex + direction];
    if (dayIndex < 0 || target === undefined) return;
    const next = [...photos];
    [next[sourceIndex], next[target]] = [next[target], next[sourceIndex]];
    setPhotos(next);
    setOrder("manual");
    seek(0);
  }, [photos, placements, seek, tripTimezone, visiblePhotos, visiblePlacements]);
  const canMovePhoto = useCallback((index: number, direction: -1 | 1) => {
    if (!editingOrder) return false;
    const targetPhoto = visiblePhotos[index + direction];
    if (!targetPhoto) return false;
    const currentDay = photoDayKey(visiblePhotos[index], visiblePlacements[index], tripTimezone);
    const targetDay = photoDayKey(targetPhoto, visiblePlacements[index + direction], tripTimezone);
    return currentDay === targetDay;
  }, [editingOrder, tripTimezone, visiblePhotos, visiblePlacements]);
  const download = useCallback((format: ExportFormat) => {
    const result = exportJourney(visiblePhotos, format, title, visiblePlacements, scopedTrack, tripTimezone);
    const suffix = selectedDay === ALL_DAYS ? "journey" : selectedDay;
    save(new Blob([result.content], { type: result.mime }), `${downloadStem(title)}-${suffix}.${result.extension}`);
  }, [title, scopedTrack, selectedDay, visiblePhotos, visiblePlacements, tripTimezone]);
  const downloadBundle = useCallback(async () => {
    setPacking(true);
    try {
      const blob = await buildBundle(visiblePhotos, { title, includePhotos, track: scopedTrack, placements: visiblePlacements, timezone: tripTimezone, scopeLabel: dayLabel(days, selectedDay) });
      save(blob, `${downloadStem(title)}-${selectedDay === ALL_DAYS ? "journey" : selectedDay}.zip`);
    } catch (error) {
      setErrors([`The download could not be built: ${error instanceof Error ? error.message : "unknown error"}`]);
    } finally {
      setPacking(false);
    }
  }, [title, selectedDay, includePhotos, scopedTrack, visiblePhotos, visiblePlacements, tripTimezone, days]);
  const downloadScopedBundle = useCallback(async () => {
    setPacking(true);
    try {
      const blob = await buildScopedBundle({
        title,
        timezone: tripTimezone,
        photos,
        placements,
        recordings,
        track,
        includePhotos,
      });
      save(blob, "photo-journey-scopes.zip");
    } catch (error) {
      setErrors([`The scope archive could not be built: ${error instanceof Error ? error.message : "unknown error"}`]);
    } finally {
      setPacking(false);
    }
  }, [title, tripTimezone, photos, placements, recordings, track, includePhotos]);

  const hasJourney = photos.length > 0 || recordings.length > 0;
  return <div className="photo-journey" data-dragging={dragging}
    onDragOver={(event) => { if (event.dataTransfer.types.includes("Files")) { event.preventDefault(); setDragging(true); } }}
    onDragLeave={(event) => { if (!event.relatedTarget || !event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }}
    onDrop={(event) => { event.preventDefault(); setDragging(false); void addFiles([...event.dataTransfer.files]); }}>
    <input ref={inputRef} type="file" accept={ACCEPT} multiple hidden onChange={(event) => {
      void addFiles([...(event.target.files ?? [])]); event.target.value = "";
    }} />
    {!hasJourney ? <section className="pj-upload" aria-busy={busy}>
      <div className="pj-upload-icon">{busy ? <LoaderCircle className="pj-spinner" size={22} aria-hidden="true" /> : <Upload size={22} aria-hidden="true" />}</div>
      <h2 role={busy ? "status" : undefined}>{busy ? `Reading files ${importProgress}` : "Drop your photos, GPX, or journey ZIP here"}</h2>
      <p>JPEG, PNG, WebP, HEIC, GPX, or an exported journey ZIP. Add all days together, or add more later. Files stay in this tab; place names come from a bundled offline list.</p>
      <button className="pj-pill" data-tone="accent" disabled={busy} onClick={() => inputRef.current?.click()}>{busy ? <LoaderCircle className="pj-spinner" size={16} aria-hidden="true" /> : <ImagePlus size={16} aria-hidden="true" />}{busy ? "Loading…" : "Add photos, GPX, or ZIP"}</button>
    </section> : <>
      <div className="pj-bar">
        <input className="pj-title" aria-label="Journey title" value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} />
        <div className="pj-bar-actions">
          <label className="pj-day-select">
            <span>Show</span>
            <select aria-label="Journey day" value={selectedDay} onChange={(event) => setSelectedDay(event.target.value)}>
              <option value={ALL_DAYS}>All days</option>
              {days.map((entry) => <option key={entry.key} value={entry.key}>{entry.label}{entry.photoIds.length ? ` · ${entry.photoIds.length} photo${entry.photoIds.length === 1 ? "" : "s"}` : " · recording only"}</option>)}
            </select>
          </label>
          <button className="pj-pill pj-import-button" data-tone="accent" disabled={busy} onClick={() => inputRef.current?.click()}><ImagePlus size={16} />{busy ? `Reading ${importProgress}` : "Add photos, GPX, or ZIP"}</button>
        </div>
      </div>
      <div className="pj-stage" ref={stageRef} data-recording={recordingVideo}>
        <JourneyStage photos={visiblePhotos} stops={stops} track={scopedTrack} placements={visiblePlacements} summary={summary} activeIndex={activeIndex} state={playback.state}
          timeline={playback.timeline} playing={playback.playing}
          reducedMotion={reducedMotion} mapMode={mapMode} title={title} timezone={tripTimezone} speed={playback.speed} seekVersion={playback.seekVersion}
          onTerrainState={setTerrain} onEngineFailed={() => setMapDead(true)} onPlaybackReady={setStageReady} onPause={pausePlayback}
          onSelect={playback.select} onContinue={() => requestPlaybackStart()} />
        <div className="pj-controls">
          <div className="pj-transport">
            <button disabled={!hasPhotos || activeIndex === 0} onClick={() => playback.select(activeIndex - 1)} aria-label="Previous photo"><SkipBack /></button>
            <button className="pj-play" disabled={!hasPhotos} onClick={togglePlay} aria-label={playback.playing || waitingToPlay ? "Pause journey" : finished ? "Replay journey" : "Play journey"}>
              {waitingToPlay ? <LoaderCircle className="pj-spinner" /> : finished ? <RotateCcw /> : playback.playing ? <Pause /> : <Play />}</button>
            <button disabled={!hasPhotos || activeIndex >= visiblePhotos.length - 1} onClick={() => playback.select(activeIndex + 1)} aria-label="Next photo"><SkipForward /></button>
          </div>
          <div className="pj-scrub">
            <div className="pj-scrub-track" aria-hidden="true">
              <div className="pj-scrub-fill" style={{ transform: `scaleX(${playback.total ? playback.elapsed / playback.total : 0})` }} />
              <ScrubberTicks stops={playback.timeline.stops} completedThrough={completedThrough} total={playback.total} />
            </div>
            <input disabled={!hasPhotos} type="range" min={0} max={playback.total} value={playback.elapsed} onChange={(event) => playback.seek(Number(event.target.value))} aria-label="Journey progress" />
          </div>
          <span className="pj-time">{formatDuration(playback.elapsed)} <span>/ {formatDuration(playback.total)}</span></span>
          <select className="pj-speed" disabled={!hasPhotos} value={playback.speed} onChange={(event) => playback.setSpeed(Number(event.target.value))} aria-label="Playback speed">
            <option value={0.75}>0.75×</option><option value={1}>1×</option><option value={1.5}>1.5×</option><option value={2}>2×</option></select>
          <button onClick={() => void toggleFullscreen()} aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}>{fullscreen ? <Minimize2 /> : <Maximize2 />}</button>
        </div>
      </div>
      <div className="pj-notes">
        {selectedDay !== ALL_DAYS && !hasPhotos && scopedTrack
          ? <p className="pj-track-note"><Route size={14} aria-hidden="true" />No photos for this day; the recorded route is still available.</p>
          : stats ? <p className="pj-track-note"><Route size={14} aria-hidden="true" />{trackNote}</p>
          : <p>Add a <strong>.gpx</strong> file to follow the recorded route. A recording also provides the map when no photos have GPS.</p>}
        {mapDead
          ? <p>The 3D map is unavailable here. The journey still plays as a slideshow.</p>
          : mapMode === "offline"
            ? <p>Offline map. No map requests leave this tab; the bundled outline has no street-level detail.</p>
            : mapMode === "online"
              ? <p>OpenStreetMap receives requests for the areas shown.</p>
              : terrain.failed
                ? <p>Terrain tiles failed to load, so the map stays flat. Tile requests still reveal the areas shown.</p>
                : terrain.loading
                  ? <p>Loading terrain… OpenStreetMap and elevation tiles reveal the areas shown.</p>
                  : <p>Terrain on. OpenStreetMap and elevation tiles reveal the areas shown.</p>}
        <p className="pj-keys"><kbd>Space</kbd> play <kbd>←</kbd><kbd>→</kbd> stops <kbd>F</kbd> fullscreen</p>
      </div>
      <details className="pj-edit-journey">
        <summary className="pj-pill">Edit journey</summary>
        <div className="pj-edit-journey-content">
          <div className="pj-bar-actions">
            <details className="pj-view-settings">
              <summary className="pj-pill">View settings</summary>
              <div className="pj-view-popover">
                <Segmented label="Map" value={mapMode} onChange={setMapMode}
                  options={[{ value: "offline", label: "Offline" }, { value: "online", label: "OpenStreetMap" }, { value: "terrain", label: "Terrain" }]} />
                <Segmented label="Order" value={order} disabled={busy} onChange={(value) => {
                  setOrder(value); if (value === "capture") setPhotos(sortPhotos(photos, placements.map((placement) => placement.instant))); playback.seek(0);
                }} options={[{ value: "capture", label: "By time" }, { value: "manual", label: "Manual" }]} />
              </div>
            </details>
            <button className="pj-pill" data-active={editingOrder} disabled={busy} onClick={() => {
              setEditingOrder((value) => !value);
              if (!editingOrder) setOrder("manual");
            }}>{editingOrder ? "Done editing" : "Edit order"}</button>
            <label className="pj-timezone">
              <span>Trip timezone</span>
              <input aria-label="Trip timezone" list="pj-timezones" value={tripTimezone} onChange={(event) => setTripTimezone(event.target.value)} onBlur={() => setTripTimezone((value) => normalizeTimezone(value))} placeholder="UTC" />
              <datalist id="pj-timezones"><option value="UTC" /><option value="Europe/Rome" /><option value="Europe/Berlin" /><option value="America/New_York" /><option value="America/Los_Angeles" /><option value="Asia/Tokyo" /></datalist>
            </label>
            <button className="pj-pill" disabled={busy || packing} onClick={() => void downloadScopedBundle()}>Export trip scopes</button>
          </div>
          {visiblePhotos.some((photo) => photo.metadata.capturedAtWallClock && photo.metadata.utcOffsetMinutes === undefined) && (
        <section className="pj-time-controls" aria-label="Photo clock settings">
          <div>
            <strong>Some camera clocks have no timezone</strong>
            <p>Choose an offset only if you know what the camera used. This applies to untagged photos and can be cleared.</p>
          </div>
          <label>
            <span>UTC offset, minutes east</span>
            <input type="number" min={-720} max={840} step={15} value={fallbackOffsetInput} placeholder="e.g. 120" onChange={(event) => setFallbackOffsetInput(event.target.value)} aria-invalid={Boolean(fallbackOffsetInput && parseOffsetMinutes(fallbackOffsetInput) === undefined)} />
          </label>
          <button className="pj-pill" data-tone="accent" disabled={parseOffsetMinutes(fallbackOffsetInput) === undefined} onClick={() => {
            const value = parseOffsetMinutes(fallbackOffsetInput);
            if (value !== undefined) {
              setOffsetMinutesByPhoto((current) => {
                const next = { ...current };
                for (const photo of visiblePhotos) if (photo.metadata.utcOffsetMinutes === undefined && photo.metadata.capturedAtWallClock) next[photo.id] = value;
                return next;
              });
            }
          }}>Apply</button>
          {visiblePhotos.some((photo) => offsetMinutesByPhoto[photo.id] !== undefined) && <button className="pj-pill" onClick={() => {
            setOffsetMinutesByPhoto((current) => {
              const next = { ...current };
              for (const photo of visiblePhotos) delete next[photo.id];
              return next;
            });
            setFallbackOffsetInput("");
          }}>Clear</button>}
        </section>
          )}
          <ExportPanel scopeLabel={dayLabel(days, selectedDay)} summary={summary} hasPhotos={hasPhotos} photoBytes={photoBytes} includePhotos={includePhotos} packing={packing} recordingVideo={recordingVideo} busy={busy}
            onExport={download} onIncludePhotos={setIncludePhotos} onBundle={downloadBundle} onVideo={() => void exportVideo()} />
          <div className="pj-workspace">
          <RecordingList recordings={recordings} overlappingIds={overlappingIds} busy={busy} timezone={tripTimezone} onToggle={toggleRecording} onRemove={removeRecording} onDownload={downloadOriginal} />
        {hasPhotos && <StopList photos={visiblePhotos} placements={visiblePlacements} summary={summary} activeIndex={activeIndex} busy={busy} editingOrder={editingOrder} dayKeys={timelineDayKeys} dayLabels={timelineDayLabels}
          onSelect={playback.select} onMove={movePhoto} canMove={canMovePhoto} onRemove={removePhoto} />}
        <Inspector photo={activePhoto} placement={visiblePlacements[activeIndex]} index={activeIndex} recordings={recordings} choice={activePhoto ? placementChoices[activePhoto.id] : undefined} offsetMinutes={activePhoto ? offsetMinutesByPhoto[activePhoto.id] : undefined} onSetOffset={setPhotoOffset} onChoosePlacement={choosePlacement} />
          </div>
        </div>
      </details>
    </>}
    {errors.length > 0 && <div className="pj-errors" role="status">
      <button onClick={() => setErrors([])} aria-label="Dismiss messages"><X size={14} /></button>
      {errors.map((error, index) => <p key={index}>{error}</p>)}
    </div>}
  </div>;
}
