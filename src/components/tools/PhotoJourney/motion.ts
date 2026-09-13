import { BURST_HOLD_DURATION, BURST_TRANSITION_DURATION, type TimelineState } from "./timeline";

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const PHOTO_CROSSFADE_DURATION = 420;

/** Zero velocity at both ends keeps arrival, departure and seeking continuous. */
export function smoothProgress(value: number) {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
}

/** Pull back to frame a photo-only leg, then arrive at the same zoom as the hold. */
export function journeyTravelZoom(progress: number, stopZoom: number, legZoom: number) {
  const arc = Math.sin(Math.PI * clamp(progress)) ** 2;
  return stopZoom + (Math.min(stopZoom, legZoom) - stopZoom) * arc;
}

/** Presentation is sampled from the playback clock; no CSS or wall-clock timers to drift. */
export function journeyMotion(state: TimelineState, reducedMotion: boolean) {
  const elapsed = state.phaseDuration * state.phaseProgress;
  const approach = state.phase === "approach";
  const departure = state.phase === "departure";
  const atCheckpoint = approach || state.phase === "reveal" || state.phase === "hold" || departure;
  const drawer = approach
    ? 1
    : departure
      ? 1
      : state.phase === "reveal"
        ? 1
        : state.drawerProgress;
  const image = approach
    ? 1
    : state.phase === "reveal"
      ? smoothProgress((state.phaseProgress - 0.12) / 0.88)
      : state.imageProgress;
  let card = 1;
  if (state.phase === "intro") card = smoothProgress(state.phaseRemaining / 350);
  if (state.phase === "outro") card = smoothProgress(elapsed / 500);
  if (state.phase === "day") card = smoothProgress(elapsed / 250) * smoothProgress(state.phaseRemaining / 300);
  return {
    drawer: !atCheckpoint ? 0 : reducedMotion ? 1 : drawer,
    image: reducedMotion ? 1 : image,
    photoTransition: reducedMotion || state.phase !== "reveal"
      ? 1
      : smoothProgress(elapsed / PHOTO_CROSSFADE_DURATION),
    checkpoint: reducedMotion ? Number(atCheckpoint) : departure
      ? 1 - smoothProgress(state.phaseProgress) : smoothProgress(state.checkpointProgress),
    // Route distance is the motion clock. Easing every photo-to-photo leg makes the camera
    // brake and accelerate at every checkpoint, so recorded travel stays linear.
    leg: state.currentLegProgress,
    card: reducedMotion ? 1 : card,
    cardBackdrop: reducedMotion ? 1 : state.phase === "day" ? smoothProgress(state.phaseRemaining / 300) : card,
  };
}

export function burstPhotoProgress(state: TimelineState, photoOffset: number, reducedMotion: boolean) {
  if (reducedMotion || state.phase !== "hold" || photoOffset <= 0) return 1;
  const elapsed = state.phaseDuration * state.phaseProgress;
  return smoothProgress((elapsed - photoOffset * BURST_HOLD_DURATION) / BURST_TRANSITION_DURATION);
}
