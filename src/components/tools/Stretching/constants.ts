import type { StretchRoutine } from "./types";

export const DEFAULT_ROUTINES: StretchRoutine[] = [
  {
    "id": "routine_1",
    "name": "Posture Reset Routine (Desk Worker)",
    "goal": "Reverses forward-shoulder and hip flexion posture from sitting.",
    "totalDuration": 540,
    "stretches": [
      {
        "id": "1",
        "name": "Standing Chest Opener (Wall or Doorway)",
        "description": "Opens pectorals and front shoulders to reverse rounded posture.",
        "duration": 30,
        "repetitions": 2,
        "image": "https://www.shutterstock.com/image-photo/woman-doing-doorway-chest-stretch-600w-2234713499.jpg",
        "how": "Stand at a doorway, place forearm and elbow at 90° on frame, step through slightly until you feel a stretch across chest and shoulders. Hold 30s each side.",
        "lookFor": "Chest opens, shoulders retract, no elbow or neck tension."
      },
      {
        "id": "2",
        "name": "Seated Thoracic Extension (Chair Back Support)",
        "description": "Improves mid-back extension and posture alignment.",
        "duration": 45,
        "repetitions": 1,
        "image": "https://www.shutterstock.com/image-photo/office-worker-doing-thoracic-extension-chair-600w-2159005877.jpg",
        "how": "Sit upright with mid-back aligned with chair backrest. Place hands behind head and arch gently over chair. Hold 3s, return—repeat for 45s total.",
        "lookFor": "Extension through mid-spine only, neck relaxed."
      },
      {
        "id": "3",
        "name": "Half-Kneeling Hip Flexor Stretch (Arms Overhead)",
        "description": "Opens hip flexors and counteracts sitting posture.",
        "duration": 30,
        "repetitions": 2,
        "image": "https://www.shutterstock.com/image-photo/hip-flexor-stretch-600w-2227365345.jpg",
        "how": "In half-kneeling, tuck pelvis under, extend arms overhead, and shift hips forward until stretch in front of hip. Hold 30s, switch legs.",
        "lookFor": "Front of hip open, core engaged, spine vertical."
      },
      {
        "id": "4",
        "name": "Standing Forward Fold with Arm Cross",
        "description": "Releases hamstrings and decompresses spine.",
        "duration": 60,
        "repetitions": 1,
        "image": "https://www.shutterstock.com/image-photo/woman-doing-standing-forward-fold-yoga-600w-523409676.jpg",
        "how": "Feet hip-width, hinge at hips, fold forward letting arms cross and hang. Minimal knee bend if tight. Hold 60s breathing deep.",
        "lookFor": "Hamstring length, spine decompressed, neck relaxed."
      },
      {
        "id": "5",
        "name": "Child's Pose with Side Reach",
        "description": "Releases lower back and lats.",
        "duration": 30,
        "repetitions": 2,
        "image": "https://www.shutterstock.com/image-photo/woman-doing-yoga-childs-pose-600w-711265969.jpg",
        "how": "From all fours, sit hips back toward heels and reach arms forward; walk hands slightly to one side for 30s stretch per side.",
        "lookFor": "Gentle side-body stretch, hips heavy, even breathing."
      }
    ]
  },
  {
    "id": "routine_2",
    "name": "Lower Body Mobility Flow (Leg-Day Prep)",
    "goal": "Prepares hips, knees, and ankles for squats or leg workouts.",
    "totalDuration": 570,
    "stretches": [
      {
        "id": "1",
        "name": "90/90 Hip Rotation Stretch",
        "description": "Improves internal and external hip rotation for deeper squats.",
        "duration": 45,
        "repetitions": 1,
        "image": "https://www.shutterstock.com/image-photo/woman-doing-9090-hip-stretch-600w-2149765733.jpg",
        "how": "Sit with one leg in front, one behind at 90°. Lean forward over front shin, then rotate chest toward back leg. Alternate 3 reps each.",
        "lookFor": "Hips rotate smoothly without twisting spine."
      },
      {
        "id": "2",
        "name": "World's Greatest Stretch (Dynamic Lunge Rotation)",
        "description": "Full-body movement improving hip and thoracic mobility.",
        "duration": 30,
        "repetitions": 2,
        "image": "https://www.shutterstock.com/image-photo/athletic-man-performing-worlds-greatest-stretch-600w-2158768426.jpg",
        "how": "From plank, step one foot outside both hands, drop opposite knee, rotate chest toward front leg, reach arm up. Hold briefly; switch sides.",
        "lookFor": "Chest open, hips low, smooth rotation."
      },
      {
        "id": "3",
        "name": "Deep Squat Hold with Knee Pulses",
        "description": "Dynamic hip and ankle opener for squat prep.",
        "duration": 45,
        "repetitions": 1,
        "image": "https://www.shutterstock.com/image-photo/yoga-garland-pose-malasanachelasana-600w-1519976209.jpg",
        "how": "Sink into deep squat, chest tall, elbows inside knees. Pulse knees out gently 8–10 times, hold bottom 15s.",
        "lookFor": "Heels stay planted, knees track over toes."
      },
      {
        "id": "4",
        "name": "Half-Kneeling Ankle Dorsiflexion Drill",
        "description": "Improves ankle dorsiflexion for squat depth and balance.",
        "duration": 30,
        "repetitions": 2,
        "image": "https://upload.wikimedia.org/wikipedia/commons/4/45/Ankle_dorsiflexion_against_wall.jpg",
        "how": "From half-kneel, push front knee forward over toes keeping heel down. Return slow. 10 reps each side.",
        "lookFor": "Smooth ankle bend, no heel lift or pronation."
      },
      {
        "id": "5",
        "name": "Standing Hamstring Sweep",
        "description": "Dynamic hamstring warm-up using gliding hinge.",
        "duration": 45,
        "repetitions": 1,
        "image": "https://www.shutterstock.com/image-photo/woman-doing-dynamic-hamstring-sweep-exercise-600w-1734879231.jpg",
        "how": "Step forward on one heel, toes up. Sweep both hands toward toe as hips hinge, then return up. Alternate 8–10 reps each leg.",
        "lookFor": "Neutral back, stretch shifts through hamstring gently."
      }
    ]
  },
  {
    "id": "routine_3",
    "name": "Full Split Progression Routine",
    "goal": "Develops both front and middle split flexibility under control.",
    "totalDuration": 600,
    "stretches": [
      {
        "id": "1",
        "name": "Half-Split Hamstring Stretch (Front Leg Straight)",
        "description": "Lengthens hamstrings, foundation for front splits.",
        "duration": 40,
        "repetitions": 2,
        "image": "https://www.shutterstock.com/shutterstock/photos/1987921937/display_1500/stock-vector-half-split-yoga-pose-young-woman-practicing-yoga-exercise-woman-workout-fitness-aerobic-and-1987921937.jpg",
        "how": "From kneeling lunge, straighten front leg and hinge forward keeping spine long. Hold 40s per leg.",
        "lookFor": "Hamstring stretch only, spine long, pelvis square."
      },
      {
        "id": "2",
        "name": "Half-Kneeling Wall-Assisted Couch Stretch (Rear Leg Elevated)",
        "description": "Stretches rear leg hip flexor and quad.",
        "duration": 30,
        "repetitions": 2,
        "image": "https://thumbs.dreamstime.com/b/young-woman-doing-couch-stretch-exercise-286655680.jpg",
        "how": "Back foot on wall, front foot forward, tuck pelvis, squeeze glute, push hips forward. Hold 30s each leg.",
        "lookFor": "Front hip opening, back glute engaged, no lumbar arch."
      },
      {
        "id": "3",
        "name": "Elevated Assisted Front Split with Yoga Blocks",
        "description": "Front split development using blocks for height control.",
        "duration": 30,
        "repetitions": 2,
        "image": "https://www.shutterstock.com/shutterstock/photos/1848492465/display_1500/stock-photo-woman-doing-front-split-yoga-pose-on-her-mat-1848492465.jpg",
        "how": "From half-split, slide front heel forward and rear knee back slowly. Use blocks for balance, stop at firm tension. Hold 30s per side.",
        "lookFor": "Equal weight on both hips, torso upright."
      },
      {
        "id": "4",
        "name": "Seated Straddle Forward Fold (Middle Split Prep)",
        "description": "Improves adductor flexibility for middle split.",
        "duration": 45,
        "repetitions": 1,
        "image": "https://www.shutterstock.com/image-photo/young-woman-doing-seated-straddle-forward-fold-600w-2165021217.jpg",
        "how": "Sit with legs wide, toes up. Keep spine long, hinge forward until firm stretch. Hold 45s.",
        "lookFor": "Inner thigh stretch, straight spine, relaxed breathing."
      },
      {
        "id": "5",
        "name": "Frog Stretch (Adductor Opener)",
        "description": "Targets inner thighs for middle split range.",
        "duration": 45,
        "repetitions": 1,
        "image": "https://www.shutterstock.com/image-photo/frog-stretch-yoga-pose-600w-2110049267.jpg",
        "how": "On all fours, move knees wide inline with ankles. Lower hips back until stretch in groin. Hold 45s.",
        "lookFor": "Deep inner thigh stretch, no knee pressure."
      }
    ]
  },
  {
    "id": "routine_4",
    "name": "Morning Mobility & Alignment Flow",
    "goal": "Gentle 8-minute reset routine to wake up joints and posture.",
    "totalDuration": 480,
    "stretches": [
      {
        "id": "1",
        "name": "Standing Side Reach Stretch",
        "description": "Opens torso and lateral chain during morning reset.",
        "duration": 45,
        "repetitions": 1,
        "image": "https://www.shutterstock.com/image-photo/woman-doing-side-reach-stretch-600w-1391061341.jpg",
        "how": "Stand tall, interlace fingers overhead, stretch upward, then lean side to side 3 slow repetitions each.",
        "lookFor": "Long ribs to hips, no forward bend."
      },
      {
        "id": "2",
        "name": "Cat–Cow (Quadruped Thoracic Mobilization)",
        "description": "Moves spine through flexion-extension for mobility.",
        "duration": 45,
        "repetitions": 1,
        "image": "https://www.shutterstock.com/image-vector/man-doing-yoga-cat-cow-600w-2255772797.jpg",
        "how": "On hands and knees, inhale arch back (cow), exhale round (cat). Perform gentle 8–10 reps.",
        "lookFor": "Even movement down spine, rhythmic breath."
      },
      {
        "id": "3",
        "name": "Downward Dog (Posterior Chain Activation)",
        "description": "Engages calves, hamstrings, and shoulders.",
        "duration": 60,
        "repetitions": 1,
        "image": "https://www.shutterstock.com/image-photo/woman-doing-downward-dog-yoga-pose-600w-2344106301.jpg",
        "how": "From plank, lift hips to inverted V, press heels to floor alternating lightly for 60s.",
        "lookFor": "Length in spine, gentle posterior-chain tension."
      },
      {
        "id": "4",
        "name": "Kneeling Thoracic Rotation (Hand Behind Head)",
        "description": "Mobilizes thoracic spine and posture rotation.",
        "duration": 30,
        "repetitions": 2,
        "image": "https://www.shutterstock.com/image-photo/woman-doing-thoracic-rotation-stretch-on-knees-600w-2063054696.jpg",
        "how": "Quadruped, one hand behind head. Rotate elbow toward ceiling, then back to floor. 8–10 reps per side.",
        "lookFor": "Rotation from thoracic spine, steady hips."
      },
      {
        "id": "5",
        "name": "Lunge-to-Hamstring Flow",
        "description": "Alternates between hip flexor and hamstring stretch dynamically.",
        "duration": 30,
        "repetitions": 2,
        "image": "https://www.shutterstock.com/image-photo/woman-doing-lunge-hamstring-stretch-flow-600w-2289641707.jpg",
        "how": "From half-lunge, exhale straighten front leg (half-split), inhale return to lunge. Repeat 6–8 transitions each side.",
        "lookFor": "Controlled flow, no jerky shifts."
      },
      {
        "id": "6",
        "name": "Chest Expansion with Clasped Hands",
        "description": "Opens shoulders and chest for upright posture.",
        "duration": 45,
        "repetitions": 1,
        "image": "https://www.shutterstock.com/image-photo/woman-doing-chest-opener-stretch-clasped-hands-600w-1730998938.jpg",
        "how": "Stand tall, clasp hands behind back, straighten elbows, gently lift arms. Hold 45s steady.",
        "lookFor": "Stretch across chest, shoulders down, neck neutral."
      }
    ]
  },
  {
    "id": "routine_5",
    "name": "Daily Stretch Routine (Detailed)",
    "goal": "Balanced full-body mobility routine for daily flexibility and posture.",
    "totalDuration": 540,
    "stretches": [
      {
        "id": "1",
        "name": "Cat–Cow Stretch",
        "description": "Spinal flexion–extension improving mobility.",
        "duration": 60,
        "repetitions": 1,
        "image": "https://www.shutterstock.com/image-vector/man-doing-yoga-cat-cow-600w-2255772797.jpg",
        "how": "On all fours, inhale arching spine (cow), exhale rounding spine (cat). 8–10 slow cycles.",
        "lookFor": "Smooth spinal articulation with matching breath."
      },
      {
        "id": "2",
        "name": "Child's Pose",
        "description": "Releases hips, back, and shoulders.",
        "duration": 60,
        "repetitions": 1,
        "image": "https://www.shutterstock.com/image-photo/woman-doing-yoga-childs-pose-600w-711265969.jpg",
        "how": "Kneel, sit hips back to heels, extend arms forward, chest down. Hold 60s calming breath.",
        "lookFor": "Back lengthening, hips lowering toward heels."
      },
      {
        "id": "3",
        "name": "World's Greatest Stretch",
        "description": "Compound mobility stretch for hips and thoracic spine.",
        "duration": 30,
        "repetitions": 2,
        "image": "https://www.shutterstock.com/image-photo/athletic-man-performing-worlds-greatest-stretch-600w-2158768426.jpg",
        "how": "From lunge, rotate toward front leg reaching arm up. Hold 30s per side.",
        "lookFor": "Chest twists open, hip flexor stretch felt deeply."
      },
      {
        "id": "4",
        "name": "Half-Kneeling Hip Flexor Stretch",
        "description": "Targets hip flexors and quads.",
        "duration": 30,
        "repetitions": 2,
        "image": "https://www.shutterstock.com/image-photo/hip-flexor-stretch-600w-2227365345.jpg",
        "how": "Half-kneel, tuck pelvis, squeeze glute of back leg, move hips forward gently. Hold 30s each.",
        "lookFor": "Front of hip stretch, core steady, torso vertical."
      },
      {
        "id": "5",
        "name": "Standing Hamstring Forward Fold",
        "description": "Lengthens hamstrings and back chain.",
        "duration": 60,
        "repetitions": 1,
        "image": "https://www.shutterstock.com/image-photo/woman-doing-standing-forward-fold-yoga-600w-523409676.jpg",
        "how": "Hinge at hips, fold forward, arms relaxed toward ground. Hold 60s breathing deep.",
        "lookFor": "Hamstring traction, back length, no pulling on lumbar."
      },
      {
        "id": "6",
        "name": "Shoulder Opener Against Wall",
        "description": "Opens lats, shoulders, and chest.",
        "duration": 60,
        "repetitions": 1,
        "image": "https://www.shutterstock.com/image-photo/man-doing-wall-shoulder-stretch-600w-1872980467.jpg",
        "how": "Face wall, hands overhead on wall, push chest downward keeping arms extended. Hold 60s.",
        "lookFor": "Stretch through armpits and chest, ribs remain tucked."
      },
      {
        "id": "7",
        "name": "Lying Spinal Twist",
        "description": "Releases lower back and obliques.",
        "duration": 30,
        "repetitions": 2,
        "image": "https://www.shutterstock.com/image-photo/woman-performing-supine-spinal-twist-yoga-600w-2156430471.jpg",
        "how": "Lie on back, bring one knee over to opposite side. Extend arms wide, gaze opposite. Hold 30s per side.",
        "lookFor": "Both shoulders grounded, rib cage expands laterally."
      }
    ]
  }
];

export const STORAGE_KEY = "stretching-app-stretches";
export const ROUTINE_SELECTOR_KEY = "stretching-app-routine-selector";
export const TIME_BETWEEN_KEY = "stretching-app-time-between";
export const CUSTOM_ROUTINES_KEY = "stretching-app-custom-routines";

