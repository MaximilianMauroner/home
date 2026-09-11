import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { buildTimeline, timelineAt } from "./timeline";
import type { Placement } from "./track";
import type { JourneyPhoto } from "./types";

const motionQuery = "(prefers-reduced-motion: reduce)";
function subscribeMotion(notify: () => void) {
  const query = window.matchMedia(motionQuery);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
}
export function useReducedMotion() {
  return useSyncExternalStore(subscribeMotion, () => window.matchMedia(motionQuery).matches, () => false);
}

/** `placements` decide where each stop sits, so a track correction also retimes its approach. */
export function usePlayback(
  photos: JourneyPhoto[],
  placements?: readonly Placement[],
  dayOptions?: {
    dayKeys?: ReadonlyArray<string | undefined>;
    dayLabels?: ReadonlyArray<string | undefined>;
  },
) {
  const positions = useMemo(
    () => placements?.map((placement) => (placement.source === "photo" || placement.source === "track" ? placement.coordinates : undefined)),
    [placements],
  );
  const instants = useMemo(
    () => placements?.map((placement) => placement.instant),
    [placements],
  );
  const timeline = useMemo(
    () => buildTimeline(photos, positions, instants, dayOptions),
    [photos, positions, instants, dayOptions?.dayKeys, dayOptions?.dayLabels],
  );
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [seekVersion, setSeekVersion] = useState(0);
  const [activePhotoId, setActivePhotoId] = useState<string>();
  const previousIdsRef = useRef<string[]>([]);
  const previousSignatureRef = useRef("");
  const elapsedRef = useRef(elapsed);
  elapsedRef.current = elapsed;
  const total = timeline.totalDuration;
  const activeIndex = useMemo(() => {
    if (!photos.length) return 0;
    const index = activePhotoId ? photos.findIndex((photo) => photo.id === activePhotoId) : -1;
    return index >= 0 ? index : 0;
  }, [photos, activePhotoId]);
  const state = timelineAt(elapsed, timeline);

  // The active stop is an identity, not an array position. Filtering a day, changing order, or
  // removing a photo therefore keeps the same photo selected whenever it still exists.
  const photoSignature = photos.map((photo) => photo.id).join("\u0000");
  useEffect(() => {
    if (photoSignature === previousSignatureRef.current) return;
    const previousIds = previousIdsRef.current;
    const initial = previousSignatureRef.current === "" && previousIds.length === 0;
    const previousIndex = activePhotoId ? previousIds.indexOf(activePhotoId) : 0;
    const retainedIndex = activePhotoId ? photos.findIndex((photo) => photo.id === activePhotoId) : -1;
    const nextIndex = retainedIndex >= 0
      ? retainedIndex
      : Math.min(Math.max(previousIndex, 0), Math.max(0, photos.length - 1));
    const nextId = photos[nextIndex]?.id;
    setActivePhotoId(nextId);
    // Keep the opening card on the first import. Later changes need a paused, visible stop so a
    // day filter, reorder, or removal never leaves the clock pointing at an old array position.
    if (!initial) {
      setElapsed(timeline.stops[nextIndex]?.revealStart ?? 0);
      setPlaying(false);
      setSeekVersion((version) => version + 1);
    }
    previousIdsRef.current = photos.map((photo) => photo.id);
    previousSignatureRef.current = photoSignature;
  }, [photoSignature, photos, activePhotoId, timeline]);

  useEffect(() => {
    // Playback advances by timeline index; mirror that index back to the stable identity before
    // a later reorder/filter can occur.
    if (!playing && elapsed < total) return;
    const id = photos[state.photoIndex]?.id;
    if (id && id !== activePhotoId) setActivePhotoId(id);
  }, [activePhotoId, elapsed, photos, playing, state.photoIndex, total]);

  useEffect(() => {
    if (!playing) return;
    const start = performance.now();
    const offset = elapsedRef.current;
    let frame: number;
    function tick(now: number) {
      const next = Math.min(total, offset + (now - start) * speed);
      setElapsed(next);
      if (next >= total) setPlaying(false);
      else frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, speed, total, seekVersion]);

  useEffect(() => {
    function onVisibility() { if (document.hidden) setPlaying(false); }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // The clock re-renders this hook's consumer on every frame. Stable callbacks let the
  // photo list and the inspector skip those renders.
  const seek = useCallback((value: number, keepPlaying = false) => {
    if (!keepPlaying) setPlaying(false);
    const nextElapsed = Math.min(total, Math.max(0, value));
    setElapsed(nextElapsed);
    // A paused scrub still changes the visible stop. Keep the identity in sync with the
    // timeline so the map, caption and inspector do not show the previous photo.
    const nextIndex = timelineAt(nextElapsed, timeline).photoIndex;
    setActivePhotoId(photos[nextIndex]?.id);
    setSeekVersion((version) => version + 1);
  }, [photos, timeline, total]);
  const select = useCallback((index: number) => {
    const safeIndex = Math.min(timeline.stops.length - 1, Math.max(0, index));
    const stop = timeline.stops[safeIndex];
    if (!stop) return;
    setActivePhotoId(photos[safeIndex]?.id);
    // While playing, replay the leg into the stop. While paused, show the photo itself.
    seek(playing ? stop.start : stop.revealStart, playing);
  }, [photos, seek, timeline, playing]);
  const pause = useCallback(() => setPlaying(false), []);
  function toggle() {
    if (!photos.length) return;
    if (elapsed >= total) {
      setElapsed(0);
      setActivePhotoId(photos[0]?.id);
      setSeekVersion((version) => version + 1);
    }
    setPlaying((value) => !value);
  }
  return { timeline, state, elapsed, total, playing, speed, seekVersion, activeIndex, activePhotoId, setSpeed,
    pause, seek, select, toggle };
}
