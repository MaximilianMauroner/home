export type RoutineCategory =
  | 'posture-correction'
  | 'pain-relief'
  | 'mobility'
  | 'flexibility'
  | 'warm-up'
  | 'recovery';

export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced';

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
