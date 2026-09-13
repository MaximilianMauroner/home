import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { Track } from "./gpx";
import { buildRouteStory } from "./route-progress";
import { buildTimeline, photoHoldTime, placementLegEligibility, timelineAt } from "./timeline";
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
  track?: Track,
) {
  const positions = useMemo(
    () => placements?.map((placement) => (placement.source === "photo" || placement.source === "track" ? placement.coordinates : undefined)),
    [placements],
  );
  const instants = useMemo(
    () => placements?.map((placement) => placement.instant),
    [placements],
  );
  const structuralEligibility = useMemo(
    () => placementLegEligibility(placements, dayOptions?.dayKeys),
    [placements, dayOptions?.dayKeys],
  );
  const routeStory = useMemo(
    () => track ? buildRouteStory(track, placements, structuralEligibility) : undefined,
    [placements, structuralEligibility, track],
  );
  const legEligibility = useMemo(
    () => routeStory ? routeStory.legs.map(Boolean) : structuralEligibility,
    [routeStory, structuralEligibility],
  );
  const timeline = useMemo(
    () => buildTimeline(photos, positions, instants, {
      ...dayOptions,
      legEligibility,
      recordingIds: placements?.map((placement) => placement.recordingId),
      recordingSegmentIds: placements?.map((placement) => placement.recordingSegmentId),
      recordingDistancesKm: placements?.map((placement) => placement.recordingDistanceKm),
      recordedLegDistancesKm: routeStory?.legs.map((leg) => leg?.distanceKm),
      located: placements?.map((placement) => placement.source === "photo" || placement.source === "track"),
    }),
    [photos, positions, instants, dayOptions?.dayKeys, dayOptions?.dayLabels, legEligibility, placements, routeStory],
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
  const photoSignature = useMemo(
    () => photos.map((photo) => photo.id).join("\u0000"),
    [photos],
  );
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
    const stillAtOpening = elapsedRef.current === 0 && !playing;
    if (!initial && !stillAtOpening) {
      const retainedStop = timeline.stops.find((stop) => stop.photoIndices.includes(nextIndex));
      setElapsed(retainedStop ? photoHoldTime(retainedStop, nextIndex) : 0);
      setPlaying(false);
      setSeekVersion((version) => version + 1);
    }
    previousIdsRef.current = photos.map((photo) => photo.id);
    previousSignatureRef.current = photoSignature;
  }, [photoSignature, photos, activePhotoId, playing, timeline]);

  useEffect(() => {
    // Playback advances by timeline index; mirror that index back to the stable identity before
    // a later reorder/filter can occur.
    if (!playing && elapsed < total) return;
    const id = photos[state.photoIndex]?.id;
    if (id && id !== activePhotoId) setActivePhotoId(id);
  }, [activePhotoId, elapsed, photos, playing, state.photoIndex, total]);

  useEffect(() => {
    if (!playing) return;
    let previousFrame = performance.now();
    let frame: number;
    function tick(now: number) {
      // A delayed frame means the browser was busy or throttled. Advancing by the entire wall
      // clock gap would skip the very animation the user was waiting to see.
      const delta = Math.min(100, Math.max(0, now - previousFrame));
      previousFrame = now;
      const next = Math.min(total, elapsedRef.current + delta * speed);
      elapsedRef.current = next;
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
    const safeIndex = Math.min(photos.length - 1, Math.max(0, index));
    const stop = timeline.stops.find((entry) => entry.photoIndices.includes(safeIndex));
    if (!stop) return;
    setActivePhotoId(photos[safeIndex]?.id);
    seek(photoHoldTime(stop, safeIndex));
  }, [photos, seek, timeline]);
  const pause = useCallback(() => setPlaying(false), []);
  const play = useCallback((fromBeginning = false) => {
    if (!photos.length) return;
    if (fromBeginning || elapsedRef.current >= total) {
      setElapsed(0);
      setActivePhotoId(photos[0]?.id);
      setSeekVersion((version) => version + 1);
    }
    setPlaying(true);
  }, [photos, total]);
  const restart = useCallback(() => {
    setPlaying(false);
    setElapsed(0);
    setActivePhotoId(photos[0]?.id);
    setSeekVersion((version) => version + 1);
  }, [photos]);
  const toggle = useCallback(() => {
    if (playing) pause();
    else play();
  }, [pause, play, playing]);
  return { timeline, routeStory, state, elapsed, total, playing, speed, seekVersion, activeIndex, activePhotoId, setSpeed,
    pause, play, restart, seek, select, toggle };
}
