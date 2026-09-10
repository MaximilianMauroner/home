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
export function usePlayback(photos: JourneyPhoto[], placements?: readonly Placement[]) {
  const positions = useMemo(
    () => placements?.map((placement) => (placement.source === "photo" || placement.source === "track" ? placement.coordinates : undefined)),
    [placements],
  );
  const timeline = useMemo(() => buildTimeline(photos, positions), [photos, positions]);
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [seekVersion, setSeekVersion] = useState(0);
  const elapsedRef = useRef(elapsed);
  elapsedRef.current = elapsed;
  const total = timeline.totalDuration;
  const state = timelineAt(elapsed, timeline);

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
    setElapsed(Math.min(total, Math.max(0, value)));
    setSeekVersion((version) => version + 1);
  }, [total]);
  const select = useCallback((index: number) => {
    const stop = timeline.stops[Math.min(timeline.stops.length - 1, Math.max(0, index))];
    if (!stop) return;
    // While playing, replay the leg into the stop. While paused, show the photo itself.
    seek(playing ? stop.start : stop.revealStart, playing);
  }, [seek, timeline, playing]);
  const pause = useCallback(() => setPlaying(false), []);
  function toggle() {
    if (!photos.length) return;
    if (elapsed >= total) {
      setElapsed(0);
      setSeekVersion((version) => version + 1);
    }
    setPlaying((value) => !value);
  }
  return { timeline, state, elapsed, total, playing, speed, seekVersion, setSpeed,
    pause, seek, select, toggle };
}
