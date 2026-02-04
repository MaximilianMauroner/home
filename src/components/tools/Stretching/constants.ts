import type { StretchRoutine } from "./types";
import { STRETCH_IMAGES } from "./images";

export const DEFAULT_ROUTINES: StretchRoutine[] = [
  {
    "id": "routine_1",
    "name": "Posture Reset Routine (Desk Worker)",
    "goal": "Reverses forward-shoulder and hip flexion posture from sitting.",
    "totalDuration": 540,
    "category": "posture-correction",
    "difficulty": "beginner",
    "tags": ["desk-worker", "office", "daily"],
    "stretches": [
      {
        "id": "1",
        "name": "Standing Chest Opener (Wall or Doorway)",
        "description": "Opens pectorals and front shoulders to reverse rounded posture.",
        "duration": 30,
        "repetitions": 2,
        "image": STRETCH_IMAGES["posture-reset"]["standing-chest-opener"],
        "how": "Stand at a doorway, place forearm and elbow at 90° on frame, step through slightly until you feel a stretch across chest and shoulders. Hold 30s each side.",
        "lookFor": "Chest opens, shoulders retract, no elbow or neck tension.",
        "targetAreas": ["chest", "front shoulders", "pectorals"]
      },
      {
        "id": "2",
        "name": "Seated Thoracic Extension (Chair Back Support)",
        "description": "Improves mid-back extension and posture alignment.",
        "duration": 45,
        "repetitions": 1,
        "image": STRETCH_IMAGES["posture-reset"]["seated-thoracic-extension"],
        "how": "Sit upright with mid-back aligned with chair backrest. Place hands behind head and arch gently over chair. Hold 3s, return—repeat for 45s total.",
        "lookFor": "Extension through mid-spine only, neck relaxed.",
        "targetAreas": ["thoracic spine", "mid-back"]
      },
      {
        "id": "3",
        "name": "Half-Kneeling Hip Flexor Stretch (Arms Overhead)",
        "description": "Opens hip flexors and counteracts sitting posture.",
        "duration": 30,
        "repetitions": 2,
        "image": STRETCH_IMAGES["posture-reset"]["half-kneeling-hip-flexor-arms-overhead"],
        "how": "In half-kneeling, tuck pelvis under, extend arms overhead, and shift hips forward until stretch in front of hip. Hold 30s, switch legs.",
        "lookFor": "Front of hip open, core engaged, spine vertical.",
        "targetAreas": ["hip flexors", "psoas", "quads"]
      },
      {
        "id": "4",
        "name": "Standing Forward Fold with Arm Cross",
        "description": "Releases hamstrings and decompresses spine.",
        "duration": 60,
        "repetitions": 1,
        "image": STRETCH_IMAGES["posture-reset"]["standing-forward-fold-arm-cross"],
        "how": "Feet hip-width, hinge at hips, fold forward letting arms cross and hang. Minimal knee bend if tight. Hold 60s breathing deep.",
        "lookFor": "Hamstring length, spine decompressed, neck relaxed.",
        "targetAreas": ["hamstrings", "spine", "lower back"]
      },
      {
        "id": "5",
        "name": "Child's Pose with Side Reach",
        "description": "Releases lower back and lats.",
        "duration": 30,
        "repetitions": 2,
        "image": STRETCH_IMAGES["posture-reset"]["childs-pose-side-reach"],
        "how": "From all fours, sit hips back toward heels and reach arms forward; walk hands slightly to one side for 30s stretch per side.",
        "lookFor": "Gentle side-body stretch, hips heavy, even breathing.",
        "targetAreas": ["lower back", "lats", "obliques"]
      }
    ]
  },
  {
    "id": "routine_2",
    "name": "Lower Body Mobility Flow (Leg-Day Prep)",
    "goal": "Prepares hips, knees, and ankles for squats or leg workouts.",
    "totalDuration": 570,
    "category": "warm-up",
    "difficulty": "intermediate",
    "tags": ["workout-prep", "leg-day", "dynamic"],
    "stretches": [
      {
        "id": "1",
        "name": "90/90 Hip Rotation Stretch",
        "description": "Improves internal and external hip rotation for deeper squats.",
        "duration": 45,
        "repetitions": 1,
        "image": STRETCH_IMAGES["lower-body-mobility"]["90-90-hip-rotation-stretch"],
        "how": "Sit with one leg in front, one behind at 90°. Lean forward over front shin, then rotate chest toward back leg. Alternate 3 reps each.",
        "lookFor": "Hips rotate smoothly without twisting spine.",
        "targetAreas": ["hip rotators", "glutes", "hip capsule"]
      },
      {
        "id": "2",
        "name": "World's Greatest Stretch (Dynamic Lunge Rotation)",
        "description": "Full-body movement improving hip and thoracic mobility.",
        "duration": 30,
        "repetitions": 2,
        "image": STRETCH_IMAGES["lower-body-mobility"]["worlds-greatest-stretch"],
        "how": "From plank, step one foot outside both hands, drop opposite knee, rotate chest toward front leg, reach arm up. Hold briefly; switch sides.",
        "lookFor": "Chest open, hips low, smooth rotation.",
        "targetAreas": ["hip flexors", "thoracic spine", "groin", "hamstrings"]
      },
      {
        "id": "3",
        "name": "Deep Squat Hold with Knee Pulses",
        "description": "Dynamic hip and ankle opener for squat prep.",
        "duration": 45,
        "repetitions": 1,
        "image": STRETCH_IMAGES["lower-body-mobility"]["deep-squat-hold"],
        "how": "Sink into deep squat, chest tall, elbows inside knees. Pulse knees out gently 8–10 times, hold bottom 15s.",
        "lookFor": "Heels stay planted, knees track over toes.",
        "targetAreas": ["hips", "ankles", "adductors"]
      },
      {
        "id": "4",
        "name": "Half-Kneeling Ankle Dorsiflexion Drill",
        "description": "Improves ankle dorsiflexion for squat depth and balance.",
        "duration": 30,
        "repetitions": 2,
        "image": STRETCH_IMAGES["lower-body-mobility"]["half-kneeling-ankle-dorsiflexion"],
        "how": "From half-kneel, push front knee forward over toes keeping heel down. Return slow. 10 reps each side.",
        "lookFor": "Smooth ankle bend, no heel lift or pronation.",
        "targetAreas": ["ankles", "calves", "achilles"]
      },
      {
        "id": "5",
        "name": "Standing Hamstring Sweep",
        "description": "Dynamic hamstring warm-up using gliding hinge.",
        "duration": 45,
        "repetitions": 1,
        "image": STRETCH_IMAGES["lower-body-mobility"]["standing-hamstring-sweep"],
        "how": "Step forward on one heel, toes up. Sweep both hands toward toe as hips hinge, then return up. Alternate 8–10 reps each leg.",
        "lookFor": "Neutral back, stretch shifts through hamstring gently.",
        "targetAreas": ["hamstrings", "glutes"]
      }
    ]
  },
  {
    "id": "routine_3",
    "name": "Full Split Progression Routine",
    "goal": "Develops both front and middle split flexibility under control.",
    "totalDuration": 600,
    "category": "flexibility",
    "difficulty": "advanced",
    "tags": ["splits", "flexibility", "advanced"],
    "stretches": [
      {
        "id": "1",
        "name": "Half-Split Hamstring Stretch (Front Leg Straight)",
        "description": "Lengthens hamstrings, foundation for front splits.",
        "duration": 40,
        "repetitions": 2,
        "image": STRETCH_IMAGES["split-progression"]["half-split-hamstring-stretch"],
        "how": "From kneeling lunge, straighten front leg and hinge forward keeping spine long. Hold 40s per leg.",
        "lookFor": "Hamstring stretch only, spine long, pelvis square.",
        "targetAreas": ["hamstrings"]
      },
      {
        "id": "2",
        "name": "Half-Kneeling Wall-Assisted Couch Stretch (Rear Leg Elevated)",
        "description": "Stretches rear leg hip flexor and quad.",
        "duration": 30,
        "repetitions": 2,
        "image": STRETCH_IMAGES["split-progression"]["wall-assisted-couch-stretch"],
        "how": "Back foot on wall, front foot forward, tuck pelvis, squeeze glute, push hips forward. Hold 30s each leg.",
        "lookFor": "Front hip opening, back glute engaged, no lumbar arch.",
        "targetAreas": ["hip flexors", "quads", "rectus femoris"]
      },
      {
        "id": "3",
        "name": "Elevated Assisted Front Split with Yoga Blocks",
        "description": "Front split development using blocks for height control.",
        "duration": 30,
        "repetitions": 2,
        "image": STRETCH_IMAGES["split-progression"]["elevated-assisted-front-split"],
        "how": "From half-split, slide front heel forward and rear knee back slowly. Use blocks for balance, stop at firm tension. Hold 30s per side.",
        "lookFor": "Equal weight on both hips, torso upright.",
        "targetAreas": ["hamstrings", "hip flexors", "quads"]
      },
      {
        "id": "4",
        "name": "Seated Straddle Forward Fold (Middle Split Prep)",
        "description": "Improves adductor flexibility for middle split.",
        "duration": 45,
        "repetitions": 1,
        "image": STRETCH_IMAGES["split-progression"]["seated-straddle-forward-fold"],
        "how": "Sit with legs wide, toes up. Keep spine long, hinge forward until firm stretch. Hold 45s.",
        "lookFor": "Inner thigh stretch, straight spine, relaxed breathing.",
        "targetAreas": ["adductors", "inner thighs", "hamstrings"]
      },
      {
        "id": "5",
        "name": "Frog Stretch (Adductor Opener)",
        "description": "Targets inner thighs for middle split range.",
        "duration": 45,
        "repetitions": 1,
        "image": STRETCH_IMAGES["split-progression"]["frog-stretch"],
        "how": "On all fours, move knees wide inline with ankles. Lower hips back until stretch in groin. Hold 45s.",
        "lookFor": "Deep inner thigh stretch, no knee pressure.",
        "targetAreas": ["adductors", "groin", "inner thighs"]
      }
    ]
  },
  {
    "id": "routine_4",
    "name": "Morning Mobility & Alignment Flow",
    "goal": "Gentle 8-minute reset routine to wake up joints and posture.",
    "totalDuration": 480,
    "category": "mobility",
    "difficulty": "beginner",
    "tags": ["morning", "gentle", "daily", "quick"],
    "stretches": [
      {
        "id": "1",
        "name": "Standing Side Reach Stretch",
        "description": "Opens torso and lateral chain during morning reset.",
        "duration": 45,
        "repetitions": 1,
        "image": STRETCH_IMAGES["morning-mobility"]["standing-side-reach"],
        "how": "Stand tall, interlace fingers overhead, stretch upward, then lean side to side 3 slow repetitions each.",
        "lookFor": "Long ribs to hips, no forward bend.",
        "targetAreas": ["obliques", "lats", "intercostals"]
      },
      {
        "id": "2",
        "name": "Cat–Cow (Quadruped Thoracic Mobilization)",
        "description": "Moves spine through flexion-extension for mobility.",
        "duration": 45,
        "repetitions": 1,
        "image": STRETCH_IMAGES["morning-mobility"]["cat-pose"],
        "how": "On hands and knees, inhale arch back (cow), exhale round (cat). Perform gentle 8–10 reps.",
        "lookFor": "Even movement down spine, rhythmic breath.",
        "targetAreas": ["spine", "back muscles", "core"]
      },
      {
        "id": "3",
        "name": "Downward Dog (Posterior Chain Activation)",
        "description": "Engages calves, hamstrings, and shoulders.",
        "duration": 60,
        "repetitions": 1,
        "image": STRETCH_IMAGES["morning-mobility"]["downward-dog"],
        "how": "From plank, lift hips to inverted V, press heels to floor alternating lightly for 60s.",
        "lookFor": "Length in spine, gentle posterior-chain tension.",
        "targetAreas": ["calves", "hamstrings", "shoulders", "spine"]
      },
      {
        "id": "4",
        "name": "Kneeling Thoracic Rotation (Hand Behind Head)",
        "description": "Mobilizes thoracic spine and posture rotation.",
        "duration": 30,
        "repetitions": 2,
        "image": STRETCH_IMAGES["morning-mobility"]["kneeling-thoracic-rotation"],
        "how": "Quadruped, one hand behind head. Rotate elbow toward ceiling, then back to floor. 8–10 reps per side.",
        "lookFor": "Rotation from thoracic spine, steady hips.",
        "targetAreas": ["thoracic spine", "obliques"]
      },
      {
        "id": "5",
        "name": "Lunge-to-Hamstring Flow",
        "description": "Alternates between hip flexor and hamstring stretch dynamically.",
        "duration": 30,
        "repetitions": 2,
        "image": STRETCH_IMAGES["morning-mobility"]["lunge-to-hamstring-flow"],
        "how": "From half-lunge, exhale straighten front leg (half-split), inhale return to lunge. Repeat 6–8 transitions each side.",
        "lookFor": "Controlled flow, no jerky shifts.",
        "targetAreas": ["hip flexors", "hamstrings"]
      },
      {
        "id": "6",
        "name": "Chest Expansion with Clasped Hands",
        "description": "Opens shoulders and chest for upright posture.",
        "duration": 45,
        "repetitions": 1,
        "image": STRETCH_IMAGES["morning-mobility"]["chest-expansion"],
        "how": "Stand tall, clasp hands behind back, straighten elbows, gently lift arms. Hold 45s steady.",
        "lookFor": "Stretch across chest, shoulders down, neck neutral.",
        "targetAreas": ["chest", "shoulders", "biceps"]
      }
    ]
  },
  {
    "id": "routine_5",
    "name": "Daily Stretch Routine (Detailed)",
    "goal": "Balanced full-body mobility routine for daily flexibility and posture.",
    "totalDuration": 540,
    "category": "flexibility",
    "difficulty": "beginner",
    "tags": ["daily", "full-body", "balanced"],
    "stretches": [
      {
        "id": "1",
        "name": "Cat–Cow Stretch",
        "description": "Spinal flexion–extension improving mobility.",
        "duration": 60,
        "repetitions": 1,
        "image": STRETCH_IMAGES["daily-stretch"]["cat-cow"],
        "how": "On all fours, inhale arching spine (cow), exhale rounding spine (cat). 8–10 slow cycles.",
        "lookFor": "Smooth spinal articulation with matching breath.",
        "targetAreas": ["spine", "back", "core"]
      },
      {
        "id": "2",
        "name": "Child's Pose",
        "description": "Releases hips, back, and shoulders.",
        "duration": 60,
        "repetitions": 1,
        "image": STRETCH_IMAGES["daily-stretch"]["childs-pose"],
        "how": "Kneel, sit hips back to heels, extend arms forward, chest down. Hold 60s calming breath.",
        "lookFor": "Back lengthening, hips lowering toward heels.",
        "targetAreas": ["hips", "lower back", "shoulders"]
      },
      {
        "id": "3",
        "name": "World's Greatest Stretch",
        "description": "Compound mobility stretch for hips and thoracic spine.",
        "duration": 30,
        "repetitions": 2,
        "image": STRETCH_IMAGES["daily-stretch"]["worlds-greatest-stretch"],
        "how": "From lunge, rotate toward front leg reaching arm up. Hold 30s per side.",
        "lookFor": "Chest twists open, hip flexor stretch felt deeply.",
        "targetAreas": ["hip flexors", "thoracic spine", "groin"]
      },
      {
        "id": "4",
        "name": "Half-Kneeling Hip Flexor Stretch",
        "description": "Targets hip flexors and quads.",
        "duration": 30,
        "repetitions": 2,
        "image": STRETCH_IMAGES["daily-stretch"]["half-kneeling-hip-flexor"],
        "how": "Half-kneel, tuck pelvis, squeeze glute of back leg, move hips forward gently. Hold 30s each.",
        "lookFor": "Front of hip stretch, core steady, torso vertical.",
        "targetAreas": ["hip flexors", "quads", "psoas"]
      },
      {
        "id": "5",
        "name": "Standing Hamstring Forward Fold",
        "description": "Lengthens hamstrings and back chain.",
        "duration": 60,
        "repetitions": 1,
        "image": STRETCH_IMAGES["daily-stretch"]["standing-hamstring-forward-fold"],
        "how": "Hinge at hips, fold forward, arms relaxed toward ground. Hold 60s breathing deep.",
        "lookFor": "Hamstring traction, back length, no pulling on lumbar.",
        "targetAreas": ["hamstrings", "lower back", "calves"]
      },
      {
        "id": "6",
        "name": "Shoulder Opener Against Wall",
        "description": "Opens lats, shoulders, and chest.",
        "duration": 60,
        "repetitions": 1,
        "image": STRETCH_IMAGES["daily-stretch"]["shoulder-opener-wall"],
        "how": "Face wall, hands overhead on wall, push chest downward keeping arms extended. Hold 60s.",
        "lookFor": "Stretch through armpits and chest, ribs remain tucked.",
        "targetAreas": ["lats", "shoulders", "chest"]
      },
      {
        "id": "7",
        "name": "Lying Spinal Twist",
        "description": "Releases lower back and obliques.",
        "duration": 30,
        "repetitions": 2,
        "image": STRETCH_IMAGES["daily-stretch"]["lying-spinal-twist"],
        "how": "Lie on back, bring one knee over to opposite side. Extend arms wide, gaze opposite. Hold 30s per side.",
        "lookFor": "Both shoulders grounded, rib cage expands laterally.",
        "targetAreas": ["lower back", "obliques", "spine"]
      }
    ]
  },
  // NEW THERAPEUTIC ROUTINES
  {
    "id": "routine_apt",
    "name": "Anterior Pelvic Tilt Correction",
    "goal": "Corrects anterior pelvic tilt through targeted hip flexor and core work.",
    "totalDuration": 600,
    "category": "posture-correction",
    "difficulty": "intermediate",
    "tags": ["posture", "apt", "hip-flexors", "core"],
    "stretches": [
      {
        "id": "1",
        "name": "Kneeling Hip Flexor Stretch (APT Focus)",
        "description": "Deep hip flexor stretch with emphasis on posterior pelvic tilt.",
        "duration": 60,
        "repetitions": 2,
        "image": STRETCH_IMAGES["apt-correction"]["kneeling-hip-flexor-apt"],
        "how": "In half-kneeling, strongly tuck your tailbone under (posterior pelvic tilt). Squeeze the glute of your back leg and shift hips forward slightly. You should feel an intense stretch in the front of your hip. Hold 60s each side.",
        "lookFor": "Strong posterior pelvic tilt maintained, no lumbar arch, glute engaged on back leg.",
        "targetAreas": ["hip flexors", "psoas", "iliacus"]
      },
      {
        "id": "2",
        "name": "Rectus Femoris Stretch (Couch Stretch)",
        "description": "Targets the quad and hip flexor that crosses both hip and knee.",
        "duration": 45,
        "repetitions": 2,
        "image": STRETCH_IMAGES["apt-correction"]["couch-stretch-apt"],
        "how": "Place back shin against a wall or couch with knee on ground. Front foot flat forward in lunge. Maintain strong posterior pelvic tilt (tuck tailbone under). You should feel stretch in front thigh and hip. Hold 45s each side.",
        "lookFor": "Posterior pelvic tilt maintained throughout, no arching back. Stretch in quad and hip flexor of back leg.",
        "targetAreas": ["rectus femoris", "hip flexors", "quads"]
      },
      {
        "id": "3",
        "name": "Glute Bridge Hold with Posterior Tilt",
        "description": "Strengthens glutes while training posterior pelvic tilt pattern.",
        "duration": 45,
        "repetitions": 2,
        "image": STRETCH_IMAGES["apt-correction"]["glute-bridge-posterior-tilt"],
        "how": "Lie on back, knees bent, feet flat. Squeeze glutes hard and lift hips into bridge. At the top, tuck tailbone under (flatten lower back). Hold with maximum glute squeeze. Lower with control. Hold 45s total, lower briefly if needed.",
        "lookFor": "Glutes fully engaged, no lumbar hyperextension at top. Lower back should feel flat, not arched.",
        "targetAreas": ["glutes", "hamstrings", "core"]
      },
      {
        "id": "4",
        "name": "Dead Bug Core Activation",
        "description": "Trains core to maintain neutral spine and prevent anterior tilt.",
        "duration": 60,
        "repetitions": 1,
        "image": STRETCH_IMAGES["apt-correction"]["dead-bug"],
        "how": "Lie on back, arms toward ceiling, knees bent at 90° above hips. Press lower back firmly into floor. Slowly extend opposite arm and leg without letting lower back arch. Return and switch. Continue alternating for 60s.",
        "lookFor": "Lower back stays pressed into floor throughout. If back arches, reduce range of motion.",
        "targetAreas": ["core", "transverse abdominis", "hip flexors"]
      },
      {
        "id": "5",
        "name": "Standing Posterior Pelvic Tilt Practice",
        "description": "Teaches correct standing posture with neutral pelvis.",
        "duration": 30,
        "repetitions": 1,
        "image": STRETCH_IMAGES["apt-correction"]["standing-posterior-pelvic-tilt"],
        "how": "Stand against wall with heels, butt, upper back, and head touching. Notice gap at lower back. Gently tuck tailbone to flatten lower back toward wall. Hold this position, engaging core lightly. Practice finding this neutral position.",
        "lookFor": "Minimal gap between lower back and wall. Core lightly engaged. Shoulders relaxed.",
        "targetAreas": ["core", "pelvis alignment"]
      },
      {
        "id": "6",
        "name": "Standing Hamstring Stretch (APT Focus)",
        "description": "Stretches often-tight hamstrings that accompany APT.",
        "duration": 45,
        "repetitions": 2,
        "image": STRETCH_IMAGES["apt-correction"]["standing-hamstring-apt"],
        "how": "Place one foot on a low surface, keeping standing leg straight. Hinge forward at hips with a FLAT back (not rounded). Lead with chest, not head. Hold until you feel hamstring stretch. 45s each leg.",
        "lookFor": "Flat back maintained, stretch in back of thigh. No rounding of lower back.",
        "targetAreas": ["hamstrings"]
      }
    ]
  },
  {
    "id": "routine_lower_back",
    "name": "Lower Back Pain Relief",
    "goal": "Gentle routine to relieve lower back tension and discomfort.",
    "totalDuration": 480,
    "category": "pain-relief",
    "difficulty": "beginner",
    "tags": ["back-pain", "relief", "gentle", "therapeutic"],
    "stretches": [
      {
        "id": "1",
        "name": "Cat-Cow Flow",
        "description": "Gently mobilizes the spine and relieves back tension.",
        "duration": 60,
        "repetitions": 1,
        "image": STRETCH_IMAGES["lower-back-relief"]["cat-cow-flow"],
        "how": "On hands and knees, alternate between arching back up (cat - round spine, tuck chin) and dropping belly down (cow - lift head, tailbone up). Move slowly with breath. Inhale for cow, exhale for cat. Continue for 60s.",
        "lookFor": "Smooth, pain-free movement through full range. Each vertebra should move.",
        "targetAreas": ["spine", "lower back", "mid-back"]
      },
      {
        "id": "2",
        "name": "Child's Pose",
        "description": "Resting pose that gently stretches the lower back.",
        "duration": 60,
        "repetitions": 1,
        "image": STRETCH_IMAGES["lower-back-relief"]["childs-pose"],
        "how": "Kneel and sit hips back toward heels. Extend arms forward on floor, rest forehead down. Let your lower back round naturally. Breathe deeply into your back. Hold 60s.",
        "lookFor": "Gentle stretch in lower back, relaxed shoulders, slow breathing.",
        "targetAreas": ["lower back", "hips", "shoulders"]
      },
      {
        "id": "3",
        "name": "Knee-to-Chest Stretch",
        "description": "Releases lower back by flexing the lumbar spine.",
        "duration": 30,
        "repetitions": 2,
        "image": STRETCH_IMAGES["lower-back-relief"]["knee-to-chest"],
        "how": "Lie on back with legs extended. Hug one knee to chest, clasping hands below the knee. Keep other leg flat or slightly bent. Gently pull knee closer. Hold 30s each side.",
        "lookFor": "Lower back pressing gently into floor, relaxed breathing. No straining.",
        "targetAreas": ["lower back", "glutes", "hip flexors"]
      },
      {
        "id": "4",
        "name": "Supine Spinal Twist",
        "description": "Rotational stretch for lower back and obliques.",
        "duration": 30,
        "repetitions": 2,
        "image": STRETCH_IMAGES["lower-back-relief"]["supine-spinal-twist"],
        "how": "Lie on back, arms out to sides. Bend both knees, then drop them to one side while keeping shoulders flat. Turn head opposite direction. Let gravity do the work - don't force. Hold 30s each side.",
        "lookFor": "Both shoulders stay on ground, gentle rotation through spine. Relaxed, not forced.",
        "targetAreas": ["lower back", "obliques", "spine"]
      },
      {
        "id": "5",
        "name": "Piriformis/Figure-4 Stretch",
        "description": "Releases piriformis which can contribute to lower back and sciatic pain.",
        "duration": 45,
        "repetitions": 2,
        "image": STRETCH_IMAGES["lower-back-relief"]["figure-4-stretch"],
        "how": "Lie on back, cross one ankle over opposite knee (making a '4' shape). Thread hands behind the uncrossed thigh and pull gently toward chest. Keep head down. Hold 45s each side.",
        "lookFor": "Stretch in outer hip/glute area of crossed leg. No strain on lower back or neck.",
        "targetAreas": ["piriformis", "glutes", "hip rotators"]
      },
      {
        "id": "6",
        "name": "Pelvic Tilts (Lying)",
        "description": "Gentle movement to mobilize lower back and relieve tension.",
        "duration": 45,
        "repetitions": 1,
        "image": STRETCH_IMAGES["lower-back-relief"]["pelvic-tilts"],
        "how": "Lie on back, knees bent, feet flat. Alternate between gently pressing lower back into floor (posterior tilt) and creating a small arch (anterior tilt). Move slowly and smoothly. Continue for 45s.",
        "lookFor": "Small, controlled movements. Pain-free range of motion. Breath stays relaxed.",
        "targetAreas": ["lower back", "pelvis", "core"]
      }
    ]
  },
  {
    "id": "routine_neck_shoulder",
    "name": "Neck & Shoulder Tension Release",
    "goal": "Relieves neck and shoulder tension from stress and desk work.",
    "totalDuration": 420,
    "category": "pain-relief",
    "difficulty": "beginner",
    "tags": ["neck", "shoulders", "tension", "desk-worker", "stress-relief"],
    "stretches": [
      {
        "id": "1",
        "name": "Neck Side Tilts",
        "description": "Stretches the side of the neck and upper trapezius.",
        "duration": 30,
        "repetitions": 2,
        "image": STRETCH_IMAGES["neck-shoulder"]["neck-side-tilt"],
        "how": "Sit or stand tall. Slowly tilt right ear toward right shoulder, keeping shoulders level. For deeper stretch, gently rest right hand on left side of head (no pulling). Hold 30s each side.",
        "lookFor": "Stretch along left side of neck. Shoulders stay down and relaxed. No pain.",
        "targetAreas": ["neck", "upper trapezius", "scalenes"]
      },
      {
        "id": "2",
        "name": "Neck Rotation Stretch",
        "description": "Releases rotational tension in the neck.",
        "duration": 30,
        "repetitions": 2,
        "image": STRETCH_IMAGES["neck-shoulder"]["neck-rotation"],
        "how": "Sit tall with shoulders relaxed. Slowly turn head to look over right shoulder. Keep chin level (don't tilt up or down). Hold at comfortable end range. 30s each side.",
        "lookFor": "Even rotation, no clicking or grinding. Shoulders remain square to front.",
        "targetAreas": ["neck rotators", "sternocleidomastoid"]
      },
      {
        "id": "3",
        "name": "Upper Trapezius Stretch",
        "description": "Targets the upper trap muscle from neck to shoulder.",
        "duration": 30,
        "repetitions": 2,
        "image": STRETCH_IMAGES["neck-shoulder"]["upper-trap-stretch"],
        "how": "Sit tall. Place right hand on left side of head. Gently tilt head to right while reaching left arm down and slightly behind you. Hold 30s each side.",
        "lookFor": "Stretch from neck down into shoulder on the opposite side. No sharp pain.",
        "targetAreas": ["upper trapezius", "neck"]
      },
      {
        "id": "4",
        "name": "Levator Scapulae Stretch",
        "description": "Targets the muscle from neck to shoulder blade that causes 'knots'.",
        "duration": 30,
        "repetitions": 2,
        "image": STRETCH_IMAGES["neck-shoulder"]["levator-scapulae-stretch"],
        "how": "Sit tall. Rotate head 45° to look toward right armpit. Then tilt chin down toward right armpit. Left arm reaches down or holds seat for anchor. Hold 30s each side.",
        "lookFor": "Stretch from side of neck down toward shoulder blade. This is where 'knots' often form.",
        "targetAreas": ["levator scapulae", "neck"]
      },
      {
        "id": "5",
        "name": "Doorway Chest Stretch",
        "description": "Opens the chest and front shoulders to counter forward posture.",
        "duration": 30,
        "repetitions": 2,
        "image": STRETCH_IMAGES["neck-shoulder"]["doorway-chest-stretch"],
        "how": "Stand in doorway. Place forearms on door frame, elbows at shoulder height. Step one foot through and lean forward until chest stretch is felt. Hold 30s, switch lead foot.",
        "lookFor": "Stretch across chest and front of shoulders. No pinching in shoulders.",
        "targetAreas": ["chest", "front shoulders", "pectorals"]
      },
      {
        "id": "6",
        "name": "Thread the Needle",
        "description": "Rotational stretch for upper back and shoulders.",
        "duration": 30,
        "repetitions": 2,
        "image": STRETCH_IMAGES["neck-shoulder"]["thread-the-needle"],
        "how": "Start on hands and knees. Slide right arm under body to the left, lowering right shoulder and head to floor. Left hand can stay planted or reach overhead. Hold 30s each side.",
        "lookFor": "Stretch in upper back and rear shoulder. Rotation through thoracic spine.",
        "targetAreas": ["upper back", "shoulders", "thoracic spine"]
      }
    ]
  },
  {
    "id": "routine_hip_mobility",
    "name": "Hip Mobility Flow",
    "goal": "Comprehensive hip mobility routine for freedom of movement.",
    "totalDuration": 540,
    "category": "mobility",
    "difficulty": "intermediate",
    "tags": ["hips", "mobility", "comprehensive"],
    "stretches": [
      {
        "id": "1",
        "name": "90/90 Hip Stretch",
        "description": "Targets both internal and external hip rotation simultaneously.",
        "duration": 45,
        "repetitions": 2,
        "image": STRETCH_IMAGES["hip-mobility"]["90-90-hip-stretch"],
        "how": "Sit with front leg bent 90° in front (shin parallel to chest), back leg bent 90° behind. Front hip is in external rotation, back hip in internal rotation. Sit tall, then lean forward over front shin. Hold 45s, then switch sides.",
        "lookFor": "Stretch in front hip (glute area) and back hip (inner thigh/groin). Keep spine tall.",
        "targetAreas": ["hip rotators", "glutes", "adductors"]
      },
      {
        "id": "2",
        "name": "Pigeon Pose",
        "description": "Deep hip opener targeting external rotation.",
        "duration": 60,
        "repetitions": 2,
        "image": STRETCH_IMAGES["hip-mobility"]["pigeon-pose"],
        "how": "From hands and knees, bring right knee forward behind right wrist. Extend left leg straight back. Lower hips toward floor. Stay upright or fold forward for deeper stretch. Hold 60s each side.",
        "lookFor": "Stretch in outer hip and glute of front leg. Back hip flexor may also stretch. Square hips as much as possible.",
        "targetAreas": ["glutes", "piriformis", "hip flexors"]
      },
      {
        "id": "3",
        "name": "Frog Stretch",
        "description": "Opens inner thighs and groin for hip adduction mobility.",
        "duration": 60,
        "repetitions": 1,
        "image": STRETCH_IMAGES["hip-mobility"]["frog-stretch"],
        "how": "On hands and knees, slowly widen knees apart while keeping ankles in line with knees (shins parallel). Lower hips down and back. Keep spine neutral. Hold 60s.",
        "lookFor": "Stretch in inner thighs and groin. No knee pain. Go only as wide as comfortable.",
        "targetAreas": ["adductors", "groin", "inner thighs"]
      },
      {
        "id": "4",
        "name": "Butterfly Stretch",
        "description": "Classic hip opener for adductors and groin.",
        "duration": 45,
        "repetitions": 1,
        "image": STRETCH_IMAGES["hip-mobility"]["butterfly-stretch"],
        "how": "Sit with soles of feet together, knees out to sides. Hold ankles or feet. Sit tall, then gently press knees toward floor using elbows. Can hinge forward slightly. Hold 45s.",
        "lookFor": "Stretch in inner thighs. Spine stays long. Don't force knees down.",
        "targetAreas": ["adductors", "groin", "hip flexors"]
      },
      {
        "id": "5",
        "name": "Hip Flexor Lunge",
        "description": "Stretches hip flexors in a functional lunge position.",
        "duration": 30,
        "repetitions": 2,
        "image": STRETCH_IMAGES["hip-mobility"]["hip-flexor-lunge"],
        "how": "Step into a deep lunge with back knee on ground (padded). Front knee over ankle. Tuck tailbone under and shift hips forward. Reach arms overhead for added stretch. Hold 30s each side.",
        "lookFor": "Stretch in front of back hip. No lumbar arch - maintain posterior pelvic tilt.",
        "targetAreas": ["hip flexors", "psoas", "quads"]
      },
      {
        "id": "6",
        "name": "Standing Figure-4",
        "description": "Balance-challenging hip stretch for glutes and external rotators.",
        "duration": 30,
        "repetitions": 2,
        "image": STRETCH_IMAGES["hip-mobility"]["standing-figure-4"],
        "how": "Stand on left leg. Cross right ankle over left knee. Sit back into a slight squat while keeping chest up. Use wall for balance if needed. Hold 30s each side.",
        "lookFor": "Stretch in outer hip/glute of crossed leg. Maintain balance and upright posture.",
        "targetAreas": ["glutes", "piriformis", "hip rotators"]
      }
    ]
  }
];

export const STORAGE_KEY = "stretching-app-stretches";
export const ROUTINE_SELECTOR_KEY = "stretching-app-routine-selector";
export const TIME_BETWEEN_KEY = "stretching-app-time-between";
export const CUSTOM_ROUTINES_KEY = "stretching-app-custom-routines";
