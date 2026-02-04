/**
 * Centralized image mapping for stretch images
 * Images are located in /public/stretches/[stretch-name].png
 */

export const PLACEHOLDER_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect fill='%23FAF7F2' width='400' height='300'/%3E%3Ctext fill='%23D4A574' font-family='system-ui' font-size='48' x='50%25' y='45%25' text-anchor='middle'%3E%F0%9F%A7%98%3C/text%3E%3Ctext fill='%239CAF88' font-family='system-ui' font-size='14' x='50%25' y='60%25' text-anchor='middle'%3EStretch Image%3C/text%3E%3C/svg%3E";

export const CATEGORY_PLACEHOLDERS: Record<string, string> = {
  "posture-correction":
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect fill='%23FAF7F2' width='400' height='300'/%3E%3Ctext fill='%23D4A574' font-family='system-ui' font-size='48' x='50%25' y='45%25' text-anchor='middle'%3E%F0%9F%A7%8D%3C/text%3E%3Ctext fill='%239CAF88' font-family='system-ui' font-size='14' x='50%25' y='60%25' text-anchor='middle'%3EPosture Correction%3C/text%3E%3C/svg%3E",
  "pain-relief":
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect fill='%23FAF7F2' width='400' height='300'/%3E%3Ctext fill='%23D4A574' font-family='system-ui' font-size='48' x='50%25' y='45%25' text-anchor='middle'%3E%F0%9F%92%86%3C/text%3E%3Ctext fill='%239CAF88' font-family='system-ui' font-size='14' x='50%25' y='60%25' text-anchor='middle'%3EPain Relief%3C/text%3E%3C/svg%3E",
  mobility:
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect fill='%23FAF7F2' width='400' height='300'/%3E%3Ctext fill='%23D4A574' font-family='system-ui' font-size='48' x='50%25' y='45%25' text-anchor='middle'%3E%F0%9F%8F%83%3C/text%3E%3Ctext fill='%239CAF88' font-family='system-ui' font-size='14' x='50%25' y='60%25' text-anchor='middle'%3EMobility%3C/text%3E%3C/svg%3E",
  flexibility:
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect fill='%23FAF7F2' width='400' height='300'/%3E%3Ctext fill='%23D4A574' font-family='system-ui' font-size='48' x='50%25' y='45%25' text-anchor='middle'%3E%F0%9F%A4%B8%3C/text%3E%3Ctext fill='%239CAF88' font-family='system-ui' font-size='14' x='50%25' y='60%25' text-anchor='middle'%3EFlexibility%3C/text%3E%3C/svg%3E",
  "warm-up":
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect fill='%23FAF7F2' width='400' height='300'/%3E%3Ctext fill='%23D4A574' font-family='system-ui' font-size='48' x='50%25' y='45%25' text-anchor='middle'%3E%F0%9F%94%A5%3C/text%3E%3Ctext fill='%239CAF88' font-family='system-ui' font-size='14' x='50%25' y='60%25' text-anchor='middle'%3EWarm-Up%3C/text%3E%3C/svg%3E",
  recovery:
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect fill='%23FAF7F2' width='400' height='300'/%3E%3Ctext fill='%23D4A574' font-family='system-ui' font-size='48' x='50%25' y='45%25' text-anchor='middle'%3E%F0%9F%8C%BF%3C/text%3E%3Ctext fill='%239CAF88' font-family='system-ui' font-size='14' x='50%25' y='60%25' text-anchor='middle'%3ERecovery%3C/text%3E%3C/svg%3E",
};

export function getStretchImage(
  imagePath: string | undefined,
  category?: string,
): string {
  if (imagePath && !imagePath.startsWith("http")) return imagePath;
  if (imagePath && imagePath.startsWith("http")) return imagePath;
  if (category && CATEGORY_PLACEHOLDERS[category])
    return CATEGORY_PLACEHOLDERS[category];
  return PLACEHOLDER_IMAGE;
}

/**
 * Image paths organized by routine
 * All images are local: /stretches/[stretch-name].png
 */
export const STRETCH_IMAGES = {
  // Routine 1: Posture Reset Routine (Desk Worker)
  "posture-reset": {
    "standing-chest-opener": "/stretches/standing-chest-opener.png",
    "seated-thoracic-extension": "/stretches/seated-thoracic-extension.png",
    "half-kneeling-hip-flexor-arms-overhead": "/stretches/half-kneeling-hip-flexor-arms-overhead.png",
    "standing-forward-fold-arm-cross": "/stretches/standing-forward-fold-arm-cross.png",
    "childs-pose-side-reach": "/stretches/childs-pose-side-reach.png",
  },

  // Routine 2: Lower Body Mobility Flow
  "lower-body-mobility": {
    "90-90-hip-rotation-stretch": "/stretches/90-90-hip-rotation-stretch.png",
    "worlds-greatest-stretch": "/stretches/worlds-greatest-stretch.png",
    "deep-squat-hold": "/stretches/deep-squat-hold.png",
    "half-kneeling-ankle-dorsiflexion": "/stretches/half-kneeling-ankle-dorsiflexion.png",
    "standing-hamstring-sweep": "/stretches/standing-hamstring-sweep.png",
  },

  // Routine 3: Full Split Progression
  "split-progression": {
    "half-split-hamstring-stretch": "/stretches/half-split-hamstring-stretch.png",
    "wall-assisted-couch-stretch": "/stretches/wall-assisted-couch-stretch.png",
    "elevated-assisted-front-split": "/stretches/elevated-assisted-front-split.png",
    "seated-straddle-forward-fold": "/stretches/seated-straddle-forward-fold.png",
    "frog-stretch": "/stretches/frog-stretch.png",
  },

  // Routine 4: Morning Mobility & Alignment
  "morning-mobility": {
    "standing-side-reach": "/stretches/standing-side-reach.png",
    "cat-pose": "/stretches/cat-pose.png",
    "cow-pose": "/stretches/cow-pose.png",
    "downward-dog": "/stretches/downward-dog.png",
    "kneeling-thoracic-rotation": "/stretches/kneeling-thoracic-rotation.png",
    "lunge-to-hamstring-flow": "/stretches/half-split-hamstring-stretch.png",
    "chest-expansion": "/stretches/chest-expansion.png",
  },

  // Routine 5: Daily Stretch Routine
  "daily-stretch": {
    "cat-cow": "/stretches/cat-pose.png",
    "childs-pose": "/stretches/childs-pose-classic.png",
    "worlds-greatest-stretch": "/stretches/worlds-greatest-stretch.png",
    "half-kneeling-hip-flexor": "/stretches/half-kneeling-hip-flexor-arms-overhead.png",
    "standing-hamstring-forward-fold": "/stretches/standing-hamstring-forward-fold.png",
    "shoulder-opener-wall": "/stretches/shoulder-opener-wall.png",
    "lying-spinal-twist": "/stretches/lying-spinal-twist.png",
  },

  // Routine 6: Anterior Pelvic Tilt Correction
  "apt-correction": {
    "kneeling-hip-flexor-apt": "/stretches/half-kneeling-hip-flexor-arms-overhead.png",
    "couch-stretch-apt": "/stretches/wall-assisted-couch-stretch.png",
    "glute-bridge-posterior-tilt": "/stretches/glute-bridge-hold.png",
    "dead-bug": "/stretches/dead-bug.png",
    "standing-posterior-pelvic-tilt": "/stretches/standing-posterior-pelvic-tilt.png",
    "standing-hamstring-apt": "/stretches/standing-hamstring-stretch-apt.png",
  },

  // Routine 7: Lower Back Pain Relief
  "lower-back-relief": {
    "cat-cow-flow": "/stretches/cat-pose.png",
    "childs-pose": "/stretches/childs-pose-classic.png",
    "knee-to-chest": "/stretches/knee-to-chest-stretch.png",
    "supine-spinal-twist": "/stretches/lying-spinal-twist.png",
    "figure-4-stretch": "/stretches/piriformis-figure-4-stretch.png",
    "pelvic-tilts": "/stretches/pelvic-tilts-lying.png",
  },

  // Routine 8: Neck & Shoulder Tension Release
  "neck-shoulder": {
    "neck-side-tilt": "/stretches/neck-side-tilts.png",
    "neck-rotation": "/stretches/neck-rotation-stretch.png",
    "upper-trap-stretch": "/stretches/upper-trapezius-stretch.png",
    "levator-scapulae-stretch": "/stretches/levator-scapulae-stretch.png",
    "doorway-chest-stretch": "/stretches/standing-chest-opener.png",
    "thread-the-needle": "/stretches/thread-the-needle.png",
  },

  // Routine 9: Hip Mobility Flow
  "hip-mobility": {
    "90-90-hip-stretch": "/stretches/90-90-hip-rotation-stretch.png",
    "pigeon-pose": "/stretches/pigeon-pose.png",
    "frog-stretch": "/stretches/frog-stretch.png",
    "butterfly-stretch": "/stretches/butterfly-stretch.png",
    "hip-flexor-lunge": "/stretches/half-kneeling-hip-flexor-arms-overhead.png",
    "standing-figure-4": "/stretches/standing-figure-4.png",
  },
} as const;
