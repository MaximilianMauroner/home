import { useState, useEffect, useRef } from "react";

interface Stretch {
  id: string;
  name: string;
  description: string;
  duration: number; // in seconds
  repetitions: number; // how many times to repeat this stretch (e.g., 2 for left/right leg)
  image?: string; // URL to image
  how: string; // How to do it
  lookFor: string; // What to look for
}

interface StretchRoutine {
  id: string;
  name: string;
  goal: string;
  totalDuration: number;
  stretches: Stretch[];
}

const ORIGINAL_ROUTINE: StretchRoutine = {
  id: "routine_0",
  name: "General Flexibility Routine",
  goal: "Comprehensive flexibility and mobility training for splits and posture.",
  totalDuration: 480,
  stretches: [
  {
    id: "1",
    name: "Dynamic warm-up",
    description: "60s total: 30s march/high knees → 30s leg swings front→back (15s per leg).",
    duration: 60,
    repetitions: 1,
    image: "",
    how: "30s march/high knees (fast but controlled). Immediately 30s leg swings front→back (15s per leg). Leg swings: ~12-15 slow reps per leg, swing to full range without bouncing, keep torso upright.",
    lookFor: "Increased pulse, blood flow to legs, ankle/knee loosen, hip socket freer.",
  },
  {
    id: "2",
    name: "Cat-Cow (thoracic emphasis)",
    description: "Slow thoracic mobilization to open mid/upper back.",
    duration: 45,
    repetitions: 1,
    image: "https://www.shutterstock.com/image-vector/man-doing-yoga-cat-cow-600w-2255772797.jpg",
    how: "On all fours. Inhale (cow) 3s: lift chest and gaze, initiate motion from mid-back. Exhale (cat) 3s: round thoracic spine, tuck chin. Repeat ~8 cycles, pause briefly at end range.",
    lookFor: "Smooth movement through mid/upper spine, chest opening, scapula movement — minimal low-back-only motion.",
  },
  {
    id: "3",
    name: "Wall T-Spine / Open-Book (side-lying)",
    description: "Thoracic rotation drill to improve upper-back rotation.",
    duration: 60,
    repetitions: 2,
    image:"https://thumbs.dreamstime.com/b/basic-rgb-267925708.jpg",
    how: "Side-lying with knees bent. Top hand behind head, rotate chest up and reach thumb toward the wall behind you, then return. 6-8 reps each side, tempo ~2s open / 2s close.",
    lookFor: "Rotation from thoracic area, chest facing up more each rep, lumbar stays neutral.",
  },
  {
    id: "4",
    name: "Standing Active Hamstring Hinge",
    description: "Active hip hinge to lengthen hamstrings while training straight-leg control.",
    duration: 60,
    repetitions: 1,
    image: "https://thumbs.dreamstime.com/b/basic-rgb-220571865.jpg",
    how: "Feet hip-width. Hinge at hips keeping spine long, reach toward ankle/floor with toes dorsiflexed. Actively engage quads to keep knees straight. Do 8-10 controlled reps, tempo 2s down / 2s up.",
    lookFor: "True hip hinge (pelvis moves back), hamstring lengthening, no low-back rounding; quad engagement protecting knee.",
  },
  {
    id: "5",
    name: "Half-Split / Runner's Half Split (active)",
    description: "Straight-leg hamstring length with spine vertical — prepares for front split.",
    duration: 80,
    repetitions: 2,
    image:"https://www.shutterstock.com/shutterstock/photos/1987921937/display_1500/stock-vector-half-split-yoga-pose-young-woman-practicing-yoga-exercise-woman-workout-fitness-aerobic-and-1987921937.jpg",
    how: "From a lunge, straighten front leg and shift hips back over it. Use blocks under hands. Keep spine long, chest tall, toes dorsiflexed. Hold 40s each side, micro-adjust every 10s.",
    lookFor: "Long front hamstring, pelvis neutral, minimal lumbar rounding; chest stays upright.",
  },
  {
    id: "6",
    name: "Couch Stretch (hip flexor + quad)",
    description: "Deep anterior hip/quad opener to allow posterior tilt and split positioning.",
    duration: 60,
    repetitions: 2,
    how: "Back knee on wall/couch, front foot planted. Posteriorly tilt pelvis, squeeze back glute, drive hips forward gently. Hold 30s each side. If lumbar arches, reduce depth and increase posterior tilt.",
    lookFor: "Front-of-hip and quad stretch without low-back arching; glute engaged.",
  },
  {
    id: "7",
    name: "Assisted Front-Split Slide",
    description: "Controlled split practice using blocks/towel to progress range safely.",
    duration: 60,
    repetitions: 2,
    how: "From half-split with hands on blocks, slowly slide front foot forward and back knee back to a firm stretch. Option A: slow 3s descent / 3s ascent × 4-5 reps. Option B: hold a controlled depth 30s and perform 3 × 5 small pulses. Toes dorsiflexed, front quad lightly active.",
    lookFor: "Even tension in front hamstring and back hip, hips squared, pelvis neutral. If front hip tilts forward, raise blocks or reduce range.",
  },
  {
    id: "8",
    name: "Ankle Dorsiflexion Wall Drill (knee-over-toes practice)",
    description: "Improve ankle dorsiflexion and teach controlled knee-over-toes movement.",
    duration: 30,
    repetitions: 2,
    image: "https://upload.wikimedia.org/wikipedia/commons/4/45/Ankle_dorsiflexion_against_wall.jpg",
    how: "Face wall. Place toes ~5 cm from wall. Bend knee to touch wall with knee (controlled), then return. Do ~10 controlled reps per leg. Progress foot further from wall (10-15 cm) only when movement is smooth and pain-free.",
    lookFor: "Smooth ankle dorsiflexion, controlled knee tracking forward, no sharp patellar pain or valgus collapse.",
  },
],
};

const DEFAULT_ROUTINES: StretchRoutine[] = [
  ORIGINAL_ROUTINE,
  {
    id: "routine_1",
    name: "Posture Reset Routine (Desk Worker)",
    goal: "Reverses forward-shoulder and hip flexion posture from sitting.",
    totalDuration: 600,
    stretches: [
      {
        id: "1",
        name: "Standing Chest Opener (Wall or Doorway)",
        description: "Opens pectorals and front shoulders to reverse rounded posture.",
        duration: 60,
        repetitions: 1,
        image: "https://www.shutterstock.com/image-photo/woman-doing-doorway-chest-stretch-600w-2234713499.jpg",
        how: "Stand at a doorway, place forearm and elbow at 90° on frame, step through slightly until you feel a stretch across chest and shoulder. Hold 60s each side.",
        lookFor: "Chest opens, shoulders retract, no elbow pain or neck tension.",
      },
      {
        id: "2",
        name: "Seated Thoracic Extension (Chair Back Support)",
        description: "Improves mid-back extension and posture alignment.",
        duration: 60,
        repetitions: 1,
        image: "https://www.shutterstock.com/image-photo/office-worker-doing-thoracic-extension-chair-600w-2159005877.jpg",
        how: "Sit upright with upper back aligned against chair backrest. Place hands behind head and gently arch over chair. Hold 3s, return, repeat 8 reps.",
        lookFor: "Extension through middle spine, not lower back. Minimal neck strain.",
      },
      {
        id: "3",
        name: "Half-Kneeling Hip Flexor Stretch (Arms Overhead)",
        description: "Opens hip flexors and counteracts sitting posture.",
        duration: 60,
        repetitions: 2,
        image: "https://www.shutterstock.com/image-photo/hip-flexor-stretch-600w-2227365345.jpg",
        how: "In half-kneeling, tuck pelvis under (posterior tilt), raise arms overhead, drive hips forward gently until stretch in front of hip. Hold 30s each side.",
        lookFor: "Stretch at front of hip, tall spine, glute engaged on rear leg.",
      },
      {
        id: "4",
        name: "Standing Forward Fold with Arm Cross",
        description: "Releases hamstrings and decompresses spine.",
        duration: 60,
        repetitions: 1,
        image: "https://www.shutterstock.com/image-photo/woman-doing-standing-forward-fold-yoga-600w-523409676.jpg",
        how: "Feet hip-width, hinge at hips, fold forward letting arms cross and hang. Slight knee bend if needed. Hold 60s with relaxed breathing.",
        lookFor: "Length through spine, gentle hamstring tension, neck relaxed.",
      },
      {
        id: "5",
        name: "Child's Pose with Side Reach",
        description: "Releases lower back and lats.",
        duration: 60,
        repetitions: 1,
        image: "https://www.shutterstock.com/image-photo/woman-doing-yoga-childs-pose-600w-711265969.jpg",
        how: "From all fours, sit hips back to heels, arms extended forward. Walk hands slightly to one side to stretch opposite lat. Hold 30s per side.",
        lookFor: "Side body expansion, relaxed shoulders, steady breathing.",
      },
    ],
  },
  {
    id: "routine_2",
    name: "Lower Body Mobility Flow (Leg-Day Prep)",
    goal: "Prepares hips, knees, and ankles for squats or leg workouts.",
    totalDuration: 540,
    stretches: [
      {
        id: "1",
        name: "90/90 Hip Rotation Stretch",
        description: "Improves internal and external hip rotation for deeper squats.",
        duration: 60,
        repetitions: 1,
        image: "https://www.shutterstock.com/image-photo/woman-doing-9090-hip-stretch-600w-2149765733.jpg",
        how: "Sit with one leg in front at 90°, the other leg behind at 90°. Chest toward front shin to feel external rotation stretch, then rotate torso toward rear leg for internal rotation. Alternate 3 reps each direction.",
        lookFor: "Hips rotate smoothly without spinal twisting. Keep sit bones grounded.",
      },
      {
        id: "2",
        name: "World's Greatest Stretch (Dynamic Lunge Rotation)",
        description: "Full-body movement improving hip flexor, hamstring, and thoracic mobility.",
        duration: 90,
        repetitions: 2,
        image: "https://www.shutterstock.com/image-photo/athletic-man-performing-worlds-greatest-stretch-600w-2158768426.jpg",
        how: "From plank, step right foot outside both hands, drop opposite knee. Rotate torso toward front leg, reaching arm up. Return to plank, switch sides.",
        lookFor: "Hips stay low, chest open, smooth torso rotation.",
      },
      {
        id: "3",
        name: "Deep Squat Hold with Knee Pulses",
        description: "Opens hips, adductors, and ankles dynamically.",
        duration: 60,
        repetitions: 1,
        image: "https://www.shutterstock.com/image-photo/yoga-garland-pose-malasanachelasana-600w-1519976209.jpg",
        how: "Descend into deep squat. Use elbows inside knees to push them gently outward. Pulse 10–12 times, then hold bottom position 20s.",
        lookFor: "Heels grounded, chest upright, knees track in line with toes.",
      },
      {
        id: "4",
        name: "Half-Kneeling Ankle Dorsiflexion Drill",
        description: "Improves ankle flexibility critical for squat depth.",
        duration: 45,
        repetitions: 2,
        image: "https://upload.wikimedia.org/wikipedia/commons/4/45/Ankle_dorsiflexion_against_wall.jpg",
        how: "From half-kneeling, drive front knee forward over toes keeping heel down. Return controlled. 10–12 reps each side.",
        lookFor: "Smooth ankle bend, no heel lift or foot collapse.",
      },
      {
        id: "5",
        name: "Standing Hamstring Sweep",
        description: "Dynamic hamstring warm-up with gliding hinge motion.",
        duration: 45,
        repetitions: 1,
        image: "https://www.shutterstock.com/image-photo/woman-doing-dynamic-hamstring-sweep-exercise-600w-1734879231.jpg",
        how: "Step forward on one heel, toes up. Sweep both hands past leg as you hinge, then stand tall. Alternate every rep, 8–10 per side.",
        lookFor: "Hinged back, hamstring activation, controlled sweep—avoid bouncing.",
      },
    ],
  },
  {
    id: "routine_3",
    name: "Full Split Progression Routine",
    goal: "Develops both front and middle split flexibility in controlled stages.",
    totalDuration: 660,
    stretches: [
      {
        id: "1",
        name: "Half-Split Hamstring Stretch (Front Leg Straight)",
        description: "Lengthens hamstrings, foundation for front splits.",
        duration: 80,
        repetitions: 2,
        image: "https://www.shutterstock.com/shutterstock/photos/1987921937/display_1500/stock-vector-half-split-yoga-pose-young-woman-practicing-yoga-exercise-woman-workout-fitness-aerobic-and-1987921937.jpg",
        how: "From kneeling lunge, straighten front leg and hinge forward with long spine. Hold 40s each side.",
        lookFor: "Front leg straight, neutral pelvis, hamstring tension—no rounding.",
      },
      {
        id: "2",
        name: "Half-Kneeling Wall-Assisted Couch Stretch (Rear Leg Elevated)",
        description: "Releases hip flexor and quad for rear leg of front split.",
        duration: 60,
        repetitions: 2,
        image: "https://thumbs.dreamstime.com/b/young-woman-doing-couch-stretch-exercise-286655680.jpg",
        how: "Back foot on wall, front foot forward, pelvis tucked. Drive hips forward gently, torso upright. Hold 30s each side.",
        lookFor: "Anterior hip stretch, glutes active, no lumbar arch.",
      },
      {
        id: "3",
        name: "Elevated Assisted Front Split with Yoga Blocks",
        description: "Controlled front split using blocks for safety.",
        duration: 60,
        repetitions: 2,
        image: "https://www.shutterstock.com/shutterstock/photos/1848492465/display_1500/stock-photo-woman-doing-front-split-yoga-pose-on-her-mat-1848492465.jpg",
        how: "From half-split, slide feet apart slowly, hips square. Engage quads, hold or do 3×5 micro pulses.",
        lookFor: "Evenly distributed stretch between legs, chin tall, hips level.",
      },
      {
        id: "4",
        name: "Seated Straddle Forward Fold (Middle Split Prep)",
        description: "Improves adductor length for middle split.",
        duration: 60,
        repetitions: 1,
        image: "https://www.shutterstock.com/image-photo/young-woman-doing-seated-straddle-forward-fold-600w-2165021217.jpg",
        how: "Sit legs wide, toes up. Keep spine long, hinge forward gradually. Hold 60s breathing evenly.",
        lookFor: "Inner thighs stretch evenly; avoid rounding spine.",
      },
      {
        id: "5",
        name: "Frog Stretch (Adductor Opener)",
        description: "Targets inner thighs for middle split range.",
        duration: 60,
        repetitions: 1,
        image: "https://www.shutterstock.com/image-photo/frog-stretch-yoga-pose-600w-2110049267.jpg",
        how: "On all fours, spread knees wide inline with ankles. Sit hips back. Hold 60s.",
        lookFor: "Deep adductor stretch without knee pain, spine neutral.",
      },
    ],
  },
  {
    id: "routine_4",
    name: "Morning Mobility & Alignment Flow",
    goal: "Gentle 8-minute reset routine to wake up joints and posture.",
    totalDuration: 480,
    stretches: [
      {
        id: "1",
        name: "Standing Side Reach Stretch",
        description: "Opens torso and lateral chains to wake upper body.",
        duration: 45,
        repetitions: 1,
        image: "https://www.shutterstock.com/image-photo/woman-doing-side-reach-stretch-600w-1391061341.jpg",
        how: "Stand tall, interlace fingers overhead, stretch up then lean right and left. Alternate slowly 3 each.",
        lookFor: "Length through ribs and torso, no torso rotation.",
      },
      {
        id: "2",
        name: "Cat–Cow (Quadruped Thoracic Mobilization)",
        description: "Moves spine through flexion/extension to activate mobility.",
        duration: 45,
        repetitions: 1,
        image: "https://www.shutterstock.com/image-vector/man-doing-yoga-cat-cow-600w-2255772797.jpg",
        how: "On hands and knees, inhale to arch back, exhale to round. Perform slow 8–10 reps.",
        lookFor: "Even motion through spine, shoulders stable, relaxed breathing.",
      },
      {
        id: "3",
        name: "Downward Dog (Posterior Chain Activation)",
        description: "Engages calves, hamstrings, and shoulders.",
        duration: 60,
        repetitions: 1,
        image: "https://www.shutterstock.com/image-photo/woman-doing-downward-dog-yoga-pose-600w-2344106301.jpg",
        how: "From plank, lift hips upward forming inverted V shape. Press heels down alternating left/right. Hold 60s.",
        lookFor: "Spine long, shoulders open, hamstrings responsive but not painful.",
      },
      {
        id: "4",
        name: "Kneeling Thoracic Rotation (Hand Behind Head)",
        description: "Mobilizes thoracic spine and improves posture rotation.",
        duration: 45,
        repetitions: 2,
        image: "https://www.shutterstock.com/image-photo/woman-doing-thoracic-rotation-stretch-on-knees-600w-2063054696.jpg",
        how: "From quadruped, one hand behind head. Rotate elbow toward ceiling then back to wrist. Do 8–10 controlled reps per side.",
        lookFor: "Mid-back rotation, hips stable, no neck strain.",
      },
      {
        id: "5",
        name: "Lunge-to-Hamstring Flow",
        description: "Dynamic movement alternating between hip flexor and hamstring positions.",
        duration: 60,
        repetitions: 2,
        image: "https://www.shutterstock.com/image-photo/woman-doing-lunge-hamstring-stretch-flow-600w-2289641707.jpg",
        how: "From half-kneeling lunge, exhale straighten front leg (half-split), inhale back to lunge. Perform 6–8 transitions per side.",
        lookFor: "Fluid transitions, even hip loading, continuous breathing.",
      },
      {
        id: "6",
        name: "Chest Expansion with Clasped Hands",
        description: "Opens shoulders and front of chest.",
        duration: 45,
        repetitions: 1,
        image: "https://www.shutterstock.com/image-photo/woman-doing-chest-opener-stretch-clasped-hands-600w-1730998938.jpg",
        how: "Stand tall, clasp hands behind, straighten elbows and raise arms slightly while lifting chest. Hold 45s.",
        lookFor: "Stretch across chest without arching lumbar spine.",
      },
    ],
  },
];

const STORAGE_KEY = "stretching-app-stretches";
const ROUTINE_SELECTOR_KEY = "stretching-app-routine-selector";

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

const playTickSound = async () => {
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

const playEndSound = async () => {
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

export default function Stretching() {
  const [selectedRoutineId, setSelectedRoutineId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(ROUTINE_SELECTOR_KEY);
      return stored || "routine_0";
    }
    return "routine_0";
  });

  const loadRoutineStretches = (routineId: string): Stretch[] => {
    const routine = DEFAULT_ROUTINES.find((r) => r.id === routineId);
    if (routine) {
      // Ensure each stretch has unique IDs
      return routine.stretches.map((s, idx) => ({
        ...s,
        id: `${routineId}_${s.id || idx + 1}`,
      }));
    }
    return ORIGINAL_ROUTINE.stretches;
  };

  const [stretches, setStretches] = useState<Stretch[]>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          // Check if stored stretches match a routine (basic check)
          if (parsed.length > 0) {
            return parsed;
          }
        } catch {
          // Fall through to load routine
        }
      }
    }
    return loadRoutineStretches(selectedRoutineId);
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentRepetition, setCurrentRepetition] = useState(1);
  const [timeRemaining, setTimeRemaining] = useState(stretches[0]?.duration || 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingStretch, setEditingStretch] = useState<Stretch | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isRunningRef = useRef(false);
  const isPausedRef = useRef(false);
  const previousIndexRef = useRef<number>(0);
  const previousRepetitionRef = useRef<number>(1);
  const hasPlayedStartSoundRef = useRef(false);
  const startTimeRef = useRef<number | null>(null);
  const totalDurationRef = useRef<number>(0);

  // Calculate total duration across all stretches with repetitions
  const calculateTotalDuration = () => {
    return stretches.reduce((total, stretch) => {
      const reps = (stretch as any).repetitions || 1;
      return total + (stretch.duration * reps);
    }, 0);
  };

  // Save routine selection to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(ROUTINE_SELECTOR_KEY, selectedRoutineId);
    }
  }, [selectedRoutineId]);

  // Load routine when selected
  const loadRoutine = (routineId: string) => {
    const newStretches = loadRoutineStretches(routineId);
    setStretches(newStretches);
    setSelectedRoutineId(routineId);
    setCurrentIndex(0);
    setCurrentRepetition(1);
    setIsRunning(false);
    setIsPaused(false);
    if (newStretches[0]) {
      setTimeRemaining(newStretches[0].duration);
    }
  };

  // Save stretches to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stretches));
    }
    totalDurationRef.current = calculateTotalDuration();
  }, [stretches]);

  // Keep refs in sync with state
  useEffect(() => {
    isRunningRef.current = isRunning;
    isPausedRef.current = isPaused;
  }, [isRunning, isPaused]);

  // Update time remaining when current stretch or repetition changes
  useEffect(() => {
    if (stretches[currentIndex]) {
      setTimeRemaining(stretches[currentIndex].duration);
      // Play start sound when moving to a new stretch or repetition (if running)
      if (isRunning && !isPaused && (currentIndex !== previousIndexRef.current || currentRepetition !== previousRepetitionRef.current)) {
        playTickSound();
      }
      previousIndexRef.current = currentIndex;
      previousRepetitionRef.current = currentRepetition;
    }
  }, [currentIndex, currentRepetition, stretches, isRunning, isPaused]);

  // Play start sound when timer begins
  useEffect(() => {
    if (isRunning && !isPaused && !hasPlayedStartSoundRef.current) {
      // Only play if timer just started (wasn't running before)
      playTickSound();
      hasPlayedStartSoundRef.current = true;
      startTimeRef.current = Date.now();
    }
    // Reset flag when paused or stopped
    if (!isRunning || isPaused) {
      hasPlayedStartSoundRef.current = false;
      if (!isRunning) {
        startTimeRef.current = null;
      }
    }
  }, [isRunning, isPaused]);

  // Timer logic - use functional updates to avoid dependency on timeRemaining
  useEffect(() => {
    if (isRunning && !isPaused) {
      intervalRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          // Check if still running via refs (avoid stale closures)
          if (!isRunningRef.current || isPausedRef.current) {
            return prev;
          }
          
          if (prev <= 1) {
            // Play end sound
            playEndSound();
            // Move to next repetition or stretch when timer reaches 0
            setTimeout(() => {
              setCurrentRepetition((rep) => {
                const currentStretch = stretches[currentIndex];
                const reps = (currentStretch as any)?.repetitions || 1;
                
                if (rep < reps) {
                  // Continue to next repetition of current stretch
                  return rep + 1;
                } else {
                  // Finished all repetitions, move to next stretch
                  setCurrentIndex((currentIdx) => {
                    if (currentIdx < stretches.length - 1) {
                      return currentIdx + 1;
                    } else {
                      setIsRunning(false);
                      return currentIdx;
                    }
                  });
                  return 1; // Reset repetition for next stretch
                }
              });
            }, 0);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning, isPaused, stretches.length]);

  const start = () => {
    setIsRunning(true);
    setIsPaused(false);
    if (currentIndex === 0 && timeRemaining === stretches[0]?.duration) {
      setCurrentRepetition(1);
      startTimeRef.current = Date.now();
    }
  };

  const pause = () => {
    setIsPaused(true);
  };

  const resume = () => {
    setIsPaused(false);
  };

  const reset = () => {
    setIsRunning(false);
    setIsPaused(false);
    setCurrentIndex(0);
    setCurrentRepetition(1);
    startTimeRef.current = null;
    if (stretches[0]) {
      setTimeRemaining(stretches[0].duration);
    }
  };

  const next = () => {
    const currentStretch = stretches[currentIndex];
    const reps = (currentStretch as any)?.repetitions || 1;
    
    // If there are more repetitions of current stretch, go to next rep
    if (currentRepetition < reps) {
      setCurrentRepetition(currentRepetition + 1);
      // Reset timer for new repetition
      setTimeRemaining(currentStretch.duration);
    } 
    // Otherwise, move to next stretch (first rep)
    else if (currentIndex < stretches.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setCurrentRepetition(1);
      const nextStretch = stretches[currentIndex + 1];
      if (nextStretch) {
        setTimeRemaining(nextStretch.duration);
      }
    } 
    // Last stretch, last rep - stop
    else {
      setIsRunning(false);
    }
  };

  const previous = () => {
    // If we're not on the first repetition, go to previous rep
    if (currentRepetition > 1) {
      setCurrentRepetition(currentRepetition - 1);
      const currentStretch = stretches[currentIndex];
      setTimeRemaining(currentStretch.duration);
    }
    // Otherwise, go to previous stretch (last rep)
    else if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      const prevStretch = stretches[currentIndex - 1];
      const prevReps = (prevStretch as any)?.repetitions || 1;
      setCurrentRepetition(prevReps);
      setTimeRemaining(prevStretch.duration);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const addStretch = (stretch: Omit<Stretch, "id">) => {
    const newStretch: Stretch = {
      ...stretch,
      id: Date.now().toString(),
    };
    setStretches([...stretches, newStretch]);
    setShowNewForm(false);
  };

  const updateStretch = (id: string, updates: Partial<Stretch>) => {
    setStretches(stretches.map((s) => (s.id === id ? { ...s, ...updates } : s)));
    setEditingStretch(null);
  };

  const deleteStretch = (id: string) => {
    if (confirm("Are you sure you want to delete this stretch?")) {
      const newStretches = stretches.filter((s) => s.id !== id);
      setStretches(newStretches);
      if (currentIndex >= newStretches.length && newStretches.length > 0) {
        setCurrentIndex(newStretches.length - 1);
      } else if (newStretches.length === 0) {
        setCurrentIndex(0);
        setTimeRemaining(0);
      }
    }
  };

  const currentStretch = stretches[currentIndex];

  // Calculate progress based on elapsed time vs total duration
  const calculateProgress = () => {
    if (totalDurationRef.current === 0) return 0;
    
    // Calculate elapsed time
    let elapsed = 0;
    
    // Time from previous stretches (with their repetitions)
    for (let i = 0; i < currentIndex; i++) {
      const stretch = stretches[i];
      const reps = (stretch as any).repetitions || 1;
      elapsed += stretch.duration * reps;
    }
    
    // Time from previous repetitions of current stretch
    const currentReps = (currentStretch as any)?.repetitions || 1;
    if (currentRepetition > 1) {
      elapsed += currentStretch.duration * (currentRepetition - 1);
    }
    
    // Time elapsed in current repetition
    if (currentStretch) {
      const elapsedInCurrent = currentStretch.duration - timeRemaining;
      elapsed += Math.max(0, elapsedInCurrent);
    }
    
    const progress = (elapsed / totalDurationRef.current) * 100;
    return Math.min(100, Math.max(0, progress));
  };

  const progress = calculateProgress();

  // Calculate total time remaining
  const calculateTimeRemaining = () => {
    let remaining = 0;
    
    // Time remaining in current repetition
    remaining += timeRemaining;
    
    // Remaining repetitions of current stretch
    const currentReps = (currentStretch as any)?.repetitions || 1;
    if (currentRepetition < currentReps) {
      remaining += currentStretch.duration * (currentReps - currentRepetition);
    }
    
    // All remaining stretches
    for (let i = currentIndex + 1; i < stretches.length; i++) {
      const stretch = stretches[i];
      const reps = (stretch as any).repetitions || 1;
      remaining += stretch.duration * reps;
    }
    
    return remaining;
  };

  // Calculate steps remaining
  const calculateStepsRemaining = () => {
    let steps = 0;
    
    // Remaining repetitions of current stretch
    const currentReps = (currentStretch as any)?.repetitions || 1;
    steps += currentReps - currentRepetition;
    
    // All remaining stretches with their repetitions
    for (let i = currentIndex + 1; i < stretches.length; i++) {
      const stretch = stretches[i];
      const reps = (stretch as any).repetitions || 1;
      steps += reps;
    }
    
    return steps;
  };

  const timeRemainingTotal = calculateTimeRemaining();
  const stepsRemaining = calculateStepsRemaining();

  const currentRoutine = DEFAULT_ROUTINES.find((r) => r.id === selectedRoutineId);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4 sm:space-y-6 pb-8">
      {/* Routine Selector */}
      {!editMode && (
        <div className="bg-card rounded-2xl p-4 sm:p-6 shadow-lg border border-border/50">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Select Routine</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
              {DEFAULT_ROUTINES.map((routine) => (
                <button
                  key={routine.id}
                  onClick={() => loadRoutine(routine.id)}
                  className={`p-3 sm:p-4 rounded-xl border-2 text-left transition-all ${
                    selectedRoutineId === routine.id
                      ? "border-primary bg-primary/10 shadow-md"
                      : "border-border/50 bg-card/50 hover:border-primary/50 hover:bg-card"
                  }`}
                >
                  <div className="font-semibold text-sm sm:text-base mb-1">{routine.name}</div>
                  <div className="text-xs text-muted-foreground mb-2">{routine.goal}</div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>⏱️ {formatTime(routine.totalDuration)}</span>
                    <span>•</span>
                    <span>{routine.stretches.length} stretches</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Control Bar */}
      {!editMode && currentStretch && (
        <div className="bg-gradient-to-br from-card to-card/80 rounded-2xl p-4 sm:p-6 shadow-lg border border-border/50 space-y-4 sm:space-y-5">
          {/* Header with timer */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-xs sm:text-sm font-semibold text-primary bg-primary/10 px-2 py-1 rounded-full">
                  {currentIndex + 1} / {stretches.length}
                </span>
                {((currentStretch as any).repetitions || 1) > 1 && (
                  <span className="text-xs sm:text-sm font-semibold text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
                    Rep {currentRepetition} / {(currentStretch as any).repetitions || 1}
                  </span>
                )}
              </div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-1.5 leading-tight">{currentStretch.name}</h2>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{currentStretch.description}</p>
            </div>
            <div className="flex-shrink-0">
              <div className="bg-gradient-to-br from-primary/20 to-primary/10 rounded-2xl p-4 sm:p-5 border-2 border-primary/20">
                <div className="text-4xl sm:text-5xl md:text-6xl font-mono font-bold text-primary mb-1 tabular-nums">
                  {formatTime(timeRemaining)}
                </div>
                {isRunning && !isPaused && (
                  <div className="flex items-center justify-center gap-1.5 mt-2">
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                    <span className="text-xs font-medium text-primary">Active</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="relative">
            <div className="w-full bg-muted/50 rounded-full h-2.5 sm:h-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-primary via-primary to-primary/80 h-full rounded-full transition-all duration-300 shadow-sm"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[10px] sm:text-xs font-medium text-muted-foreground">
                {formatTime(timeRemainingTotal)} remaining • {stepsRemaining} {stepsRemaining === 1 ? 'step' : 'steps'} left
              </span>
            </div>
          </div>

          {/* Controls */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3">
            <button
              onClick={previous}
              disabled={currentIndex === 0}
              className="col-span-1 px-3 sm:px-4 py-3 min-h-[48px] bg-secondary/80 text-secondary-foreground rounded-xl disabled:opacity-40 disabled:cursor-not-allowed hover:bg-secondary active:bg-secondary/70 transition-all font-medium text-sm touch-manipulation shadow-sm"
            >
              <span className="hidden sm:inline">← </span>Prev
            </button>
            {!isRunning ? (
              <button
                onClick={start}
                className="col-span-2 sm:col-span-3 px-4 sm:px-6 py-3 min-h-[48px] bg-gradient-to-r from-primary to-primary/90 text-primary-foreground rounded-xl hover:from-primary/90 hover:to-primary/80 active:scale-[0.98] transition-all font-semibold text-base touch-manipulation shadow-lg"
              >
                ▶ Start
              </button>
            ) : isPaused ? (
              <button
                onClick={resume}
                className="col-span-2 sm:col-span-3 px-4 sm:px-6 py-3 min-h-[48px] bg-gradient-to-r from-primary to-primary/90 text-primary-foreground rounded-xl hover:from-primary/90 hover:to-primary/80 active:scale-[0.98] transition-all font-semibold text-base touch-manipulation shadow-lg"
              >
                ▶ Resume
              </button>
            ) : (
              <button
                onClick={pause}
                className="col-span-2 sm:col-span-3 px-4 sm:px-6 py-3 min-h-[48px] bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl hover:from-orange-600 hover:to-orange-700 active:scale-[0.98] transition-all font-semibold text-base touch-manipulation shadow-lg"
              >
                ⏸ Pause
              </button>
            )}
            <button
              onClick={next}
              disabled={currentIndex === stretches.length - 1}
              className="col-span-1 px-3 sm:px-4 py-3 min-h-[48px] bg-secondary/80 text-secondary-foreground rounded-xl disabled:opacity-40 disabled:cursor-not-allowed hover:bg-secondary active:bg-secondary/70 transition-all font-medium text-sm touch-manipulation shadow-sm"
            >
              Next<span className="hidden sm:inline"> →</span>
            </button>
            <button
              onClick={reset}
              className="col-span-2 sm:col-span-5 px-4 py-2.5 min-h-[40px] bg-destructive/10 text-destructive rounded-xl hover:bg-destructive/20 active:bg-destructive/30 transition-all font-medium text-sm touch-manipulation border border-destructive/20"
            >
              ↻ Reset
            </button>
          </div>
        </div>
      )}

      {/* Stretch Details */}
      {!editMode && currentStretch && (
        <div className="space-y-3 sm:space-y-4">
          {/* {currentStretch.image && (
            <div className="w-full aspect-video bg-muted rounded-2xl overflow-hidden shadow-lg border border-border/50">
              <img
                src={currentStretch.image}
                alt={currentStretch.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          )} */}
          
          {/* What to Do Card */}
          <div className="bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent rounded-2xl p-4 sm:p-6 border border-blue-500/20 shadow-sm">
            <div className="flex items-start gap-3 mb-3">
              <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <span className="text-lg sm:text-xl">📋</span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-base sm:text-lg mb-1 text-foreground">What to Do</h3>
              </div>
            </div>
            <div className="pl-0 sm:pl-12">
              <p className="text-sm sm:text-base text-foreground/90 leading-relaxed whitespace-pre-line">
                {currentStretch.how}
              </p>
            </div>
          </div>

          {/* What to Feel Card */}
          <div className="bg-gradient-to-br from-green-500/10 via-green-500/5 to-transparent rounded-2xl p-4 sm:p-6 border border-green-500/20 shadow-sm">
            <div className="flex items-start gap-3 mb-3">
              <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                <span className="text-lg sm:text-xl">✨</span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-base sm:text-lg mb-1 text-foreground">What to Feel</h3>
              </div>
            </div>
            <div className="pl-0 sm:pl-12">
              <p className="text-sm sm:text-base text-foreground/90 leading-relaxed whitespace-pre-line">
                {currentStretch.lookFor}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Edit Mode Toggle */}
      <div className="flex justify-center pt-2">
        <button
          onClick={() => {
            setEditMode(!editMode);
            setIsRunning(false);
            setIsPaused(false);
          }}
          className="px-5 py-3 min-h-[48px] bg-secondary/80 text-secondary-foreground rounded-xl hover:bg-secondary active:bg-secondary/70 transition-all font-medium text-sm touch-manipulation shadow-sm"
        >
          {editMode ? "← Exit Edit Mode" : "✏️ Edit Stretches"}
        </button>
      </div>

      {/* Edit Mode */}
      {editMode && (
        <div className="bg-card rounded-2xl p-4 sm:p-6 shadow-lg border border-border/50 space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h2 className="text-xl sm:text-2xl font-bold">Manage Stretches</h2>
            <button
              onClick={() => setShowNewForm(true)}
              className="w-full sm:w-auto px-5 py-3 min-h-[48px] bg-gradient-to-r from-primary to-primary/90 text-primary-foreground rounded-xl hover:from-primary/90 hover:to-primary/80 active:scale-[0.98] transition-all font-semibold text-sm touch-manipulation shadow-lg"
            >
              + Add New Stretch
            </button>
          </div>

          {/* New Stretch Form */}
          {showNewForm && (
            <div className="bg-muted/30 rounded-2xl p-4 sm:p-5 border border-border/50">
              <StretchForm
                stretch={null}
                onSubmit={(stretch) => {
                  addStretch(stretch);
                }}
                onCancel={() => setShowNewForm(false)}
              />
            </div>
          )}

          {/* Stretch List */}
          <div className="space-y-3 sm:space-y-4">
            {stretches.map((stretch, index) => (
              <div key={stretch.id} className="bg-gradient-to-br from-card to-card/80 rounded-xl p-4 sm:p-5 border border-border/50 shadow-sm hover:shadow-md transition-all">
                {editingStretch?.id === stretch.id ? (
                  <StretchForm
                    stretch={stretch}
                    onSubmit={(updates) => updateStretch(stretch.id, updates)}
                    onCancel={() => setEditingStretch(null)}
                  />
                ) : (
                  <>
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-3 sm:gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                            #{index + 1}
                          </span>
                          <div className="font-semibold text-base sm:text-lg">{stretch.name}</div>
                        </div>
                        <div className="text-sm text-muted-foreground mt-1 leading-relaxed">{stretch.description}</div>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className="text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-1 rounded-md">
                            ⏱️ {formatTime(stretch.duration)}
                          </span>
                          {((stretch as any).repetitions || 1) > 1 && (
                            <span className="text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-1 rounded-md">
                              🔁 {(stretch as any).repetitions || 1}x ({formatTime(stretch.duration * ((stretch as any).repetitions || 1))} total)
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto">
                        <button
                          onClick={() => setEditingStretch(stretch)}
                          className="flex-1 sm:flex-none px-4 py-2.5 min-h-[44px] bg-secondary/80 text-secondary-foreground rounded-xl text-sm hover:bg-secondary active:bg-secondary/70 transition-all touch-manipulation font-medium"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => deleteStretch(stretch.id)}
                          className="flex-1 sm:flex-none px-4 py-2.5 min-h-[44px] bg-destructive/10 text-destructive rounded-xl text-sm hover:bg-destructive/20 active:bg-destructive/30 transition-all touch-manipulation font-medium border border-destructive/20"
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
            {stretches.length === 0 && (
              <div className="text-center text-muted-foreground py-12 bg-muted/30 rounded-xl">
                <div className="text-4xl mb-2">🧘</div>
                <p className="text-sm">No stretches yet. Add one to get started!</p>
              </div>
            )}
          </div>

          {/* Reset to Defaults */}
          <div className="border-t border-border/50 pt-4 sm:pt-6">
            <button
              onClick={() => {
                if (confirm("Reset to default stretches? This will replace all current stretches.")) {
                  const routineStretches = loadRoutineStretches(selectedRoutineId);
                  setStretches(routineStretches);
                  setCurrentIndex(0);
                  setCurrentRepetition(1);
                  setTimeRemaining(routineStretches[0]?.duration || 60);
                }
              }}
              className="w-full px-5 py-3 min-h-[48px] bg-secondary/80 text-secondary-foreground rounded-xl hover:bg-secondary active:bg-secondary/70 transition-all font-medium text-sm touch-manipulation shadow-sm"
            >
              ↻ Reset to Default Stretches
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface StretchFormProps {
  stretch: Stretch | null;
  onSubmit: (stretch: Omit<Stretch, "id">) => void;
  onCancel: () => void;
}

function StretchForm({ stretch, onSubmit, onCancel }: StretchFormProps) {
  const [name, setName] = useState(stretch?.name || "");
  const [description, setDescription] = useState(stretch?.description || "");
  const [duration, setDuration] = useState(stretch?.duration || 60);
  const [repetitions, setRepetitions] = useState((stretch as any)?.repetitions || 1);
  const [image, setImage] = useState(stretch?.image || "");
  const [how, setHow] = useState(stretch?.how || "");
  const [lookFor, setLookFor] = useState(stretch?.lookFor || "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      description,
      duration,
      repetitions,
      image: image || undefined,
      how,
      lookFor,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
      <div>
        <label className="block text-sm font-semibold mb-2 text-foreground">Name *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold mb-2 text-foreground">Description *</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          rows={2}
          className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-semibold mb-2 text-foreground">Duration (seconds) *</label>
          <input
            type="number"
            value={duration}
            onChange={(e) => setDuration(parseInt(e.target.value) || 60)}
            required
            min="1"
            className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-2 text-foreground">Repetitions *</label>
          <input
            type="number"
            value={repetitions}
            onChange={(e) => setRepetitions(Math.max(1, parseInt(e.target.value) || 1))}
            required
            min="1"
            className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
          />
          <p className="text-xs text-muted-foreground mt-1">e.g., 2 for left/right leg</p>
        </div>
        <div>
          <label className="block text-sm font-semibold mb-2 text-foreground">Image URL (optional)</label>
          <input
            type="url"
            value={image}
            onChange={(e) => setImage(e.target.value)}
            placeholder="https://..."
            className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-semibold mb-2 text-foreground">What to Do *</label>
        <textarea
          value={how}
          onChange={(e) => setHow(e.target.value)}
          required
          rows={4}
          className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none"
          placeholder="Include instructions and tempo/cues..."
        />
      </div>
      <div>
        <label className="block text-sm font-semibold mb-2 text-foreground">What to Feel *</label>
        <textarea
          value={lookFor}
          onChange={(e) => setLookFor(e.target.value)}
          required
          rows={3}
          className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none"
          placeholder="What sensations and feedback to look for..."
        />
      </div>
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-2">
        <button
          type="submit"
          className="flex-1 px-5 py-3 min-h-[48px] bg-gradient-to-r from-primary to-primary/90 text-primary-foreground rounded-xl hover:from-primary/90 hover:to-primary/80 active:scale-[0.98] transition-all font-semibold text-sm touch-manipulation shadow-lg"
        >
          {stretch ? "✓ Update Stretch" : "+ Add Stretch"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 sm:flex-none px-5 py-3 min-h-[48px] bg-secondary/80 text-secondary-foreground rounded-xl hover:bg-secondary active:bg-secondary/70 transition-all font-medium text-sm touch-manipulation shadow-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}


