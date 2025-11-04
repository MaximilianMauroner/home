// Utility functions
export const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

// Audio utilities - using a shared audio context that gets resumed
let audioContext: AudioContext | null = null;

const getAudioContext = async () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  // Resume if suspended (browser autoplay policy)
  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }
  return audioContext;
};

export const playTickSound = async () => {
  try {
    const ctx = await getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.value = 800; // Higher pitch for tick
    oscillator.type = "sine";

    gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.05);
  } catch (e) {
    // Fallback if audio context is not available
    console.log("Audio not available", e);
  }
};

export const playEndSound = async () => {
  try {
    const ctx = await getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Play a pleasant notification sound (two-tone chime)
    oscillator.frequency.value = 523.25; // C5 note
    oscillator.type = "sine";

    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.3);

    // Second tone
    setTimeout(async () => {
      try {
        const ctx2 = await getAudioContext();
        const oscillator2 = ctx2.createOscillator();
        const gainNode2 = ctx2.createGain();

        oscillator2.connect(gainNode2);
        gainNode2.connect(ctx2.destination);

        oscillator2.frequency.value = 659.25; // E5 note
        oscillator2.type = "sine";

        gainNode2.gain.setValueAtTime(0.3, ctx2.currentTime);
        gainNode2.gain.exponentialRampToValueAtTime(0.01, ctx2.currentTime + 0.3);

        oscillator2.start(ctx2.currentTime);
        oscillator2.stop(ctx2.currentTime + 0.3);
      } catch (e) {
        console.log("Audio error in second tone", e);
      }
    }, 150);
  } catch (e) {
    console.log("Audio not available", e);
  }
};

