import { BURST_HOLD_DURATION, BURST_TRANSITION_DURATION, type TimelineState } from "./timeline";

const clamp = (value: number) => Math.max(0, Math.min(1, value));

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
  const departure = state.phase === "departure";
  const atCheckpoint = state.phase === "reveal" || state.phase === "hold" || departure;
  const drawer = departure
    ? 1 - smoothProgress(state.phaseProgress)
    : state.phase === "reveal" ? 1 - (1 - clamp((elapsed - 300) / 550)) ** 3 : state.drawerProgress;
  const image = state.phase === "reveal" ? smoothProgress((elapsed - 480) / 470) : state.imageProgress;
  let card = 1;
  if (state.phase === "intro") card = smoothProgress(state.phaseRemaining / 350);
  if (state.phase === "outro") card = smoothProgress(elapsed / 500);
  if (state.phase === "day") card = smoothProgress(elapsed / 250) * smoothProgress(state.phaseRemaining / 300);
  return {
    drawer: !atCheckpoint ? 0 : reducedMotion ? 1 : drawer,
    image: reducedMotion ? 1 : image,
    checkpoint: reducedMotion ? Number(atCheckpoint) : departure
      ? 1 - smoothProgress(state.phaseProgress) : smoothProgress(state.checkpointProgress),
    leg: reducedMotion ? state.currentLegProgress : smoothProgress(state.currentLegProgress),
    card: reducedMotion ? 1 : card,
    cardBackdrop: reducedMotion ? 1 : state.phase === "day" ? smoothProgress(state.phaseRemaining / 300) : card,
    travel: reducedMotion ? 1 : smoothProgress(elapsed / 200) * smoothProgress(state.phaseRemaining / 200),
  };
}

export function burstPhotoProgress(state: TimelineState, photoOffset: number, reducedMotion: boolean) {
  if (reducedMotion || state.phase !== "hold" || photoOffset <= 0) return 1;
  const elapsed = state.phaseDuration * state.phaseProgress;
  return smoothProgress((elapsed - photoOffset * BURST_HOLD_DURATION) / BURST_TRANSITION_DURATION);
}
