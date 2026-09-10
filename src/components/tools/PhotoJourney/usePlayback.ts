import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { buildTimeline, timelineAt } from "./timeline";
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

export function usePlayback(photos: JourneyPhoto[]) {
  const timeline = useMemo(() => buildTimeline(photos), [photos]);
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

  function seek(value: number, keepPlaying = false) {
    if (!keepPlaying) setPlaying(false);
    setElapsed(Math.min(total, Math.max(0, value)));
    setSeekVersion((version) => version + 1);
  }
  function select(index: number) {
    const stop = timeline.stops[Math.min(photos.length - 1, Math.max(0, index))];
    if (!stop) return;
    // While playing, replay the leg into the stop. While paused, show the photo itself.
    seek(playing ? stop.start : stop.revealStart, playing);
  }
  function toggle() {
    if (!photos.length) return;
    if (elapsed >= total) {
      setElapsed(0);
      setSeekVersion((version) => version + 1);
    }
    setPlaying((value) => !value);
  }
  return { timeline, state, elapsed, total, playing, speed, seekVersion, setSpeed,
    pause: () => setPlaying(false), seek, select, toggle };
}
