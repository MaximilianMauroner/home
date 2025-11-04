export interface Stretch {
  id: string;
  name: string;
  description: string;
  duration: number; // in seconds
  repetitions: number; // how many times to repeat this stretch (e.g., 2 for left/right leg)
  image?: string; // URL to image
  how: string; // How to do it
  lookFor: string; // What to look for
}

export interface StretchRoutine {
  id: string;
  name: string;
  goal: string;
  totalDuration: number;
  stretches: Stretch[];
}

