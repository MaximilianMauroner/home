export type RoutineCategory =
  | 'posture-correction'
  | 'pain-relief'
  | 'mobility'
  | 'flexibility'
  | 'warm-up'
  | 'recovery';

export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced';

export type ProgressionTier = 'easier' | 'standard' | 'harder' | 'hardest';

/**
 * One rung on a stretch's difficulty ladder. A stretch stores its rungs
 * easiest first, so the array order is what tells you which way it climbs.
 */
export interface StretchProgression {
  tier: ProgressionTier;
  name: string;
  detail: string;
}

export interface Stretch {
  id: string;
  name: string;
  description: string;
  duration: number; // in seconds
  repetitions: number; // how many times to repeat this stretch (e.g., 2 for left/right leg)
  image?: string; // URL to image
  how: string; // How to do it
  lookFor: string; // What to look for
  targetAreas?: string[]; // NEW: ['hip flexors', 'lower back']
  progressions?: StretchProgression[]; // easier and harder ways to run the same stretch
}

export interface StretchRoutine {
  id: string;
  name: string;
  goal: string;
  totalDuration: number;
  stretches: Stretch[];
  category?: RoutineCategory;      // NEW
  difficulty?: DifficultyLevel;    // NEW
  tags?: string[];                 // NEW: ['desk-worker', 'quick']
}
