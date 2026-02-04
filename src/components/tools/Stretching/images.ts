/**
 * Centralized image mapping for stretch images
 * Images should be placed in /public/images/stretches/[routine-slug]/[stretch-slug].jpg
 *
 * For now, this file provides fallback placeholder images and the structure
 * for when real images are added.
 */

// Placeholder image for stretches without images
export const PLACEHOLDER_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect fill='%23FAF7F2' width='400' height='300'/%3E%3Ctext fill='%23D4A574' font-family='system-ui' font-size='48' x='50%25' y='45%25' text-anchor='middle'%3E%F0%9F%A7%98%3C/text%3E%3Ctext fill='%239CAF88' font-family='system-ui' font-size='14' x='50%25' y='60%25' text-anchor='middle'%3EStretch Image%3C/text%3E%3C/svg%3E";

// Category-specific placeholder images
export const CATEGORY_PLACEHOLDERS: Record<string, string> = {
  'posture-correction': "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect fill='%23FAF7F2' width='400' height='300'/%3E%3Ctext fill='%23D4A574' font-family='system-ui' font-size='48' x='50%25' y='45%25' text-anchor='middle'%3E%F0%9F%A7%8D%3C/text%3E%3Ctext fill='%239CAF88' font-family='system-ui' font-size='14' x='50%25' y='60%25' text-anchor='middle'%3EPosture Correction%3C/text%3E%3C/svg%3E",
  'pain-relief': "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect fill='%23FAF7F2' width='400' height='300'/%3E%3Ctext fill='%23D4A574' font-family='system-ui' font-size='48' x='50%25' y='45%25' text-anchor='middle'%3E%F0%9F%92%86%3C/text%3E%3Ctext fill='%239CAF88' font-family='system-ui' font-size='14' x='50%25' y='60%25' text-anchor='middle'%3EPain Relief%3C/text%3E%3C/svg%3E",
  'mobility': "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect fill='%23FAF7F2' width='400' height='300'/%3E%3Ctext fill='%23D4A574' font-family='system-ui' font-size='48' x='50%25' y='45%25' text-anchor='middle'%3E%F0%9F%8F%83%3C/text%3E%3Ctext fill='%239CAF88' font-family='system-ui' font-size='14' x='50%25' y='60%25' text-anchor='middle'%3EMobility%3C/text%3E%3C/svg%3E",
  'flexibility': "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect fill='%23FAF7F2' width='400' height='300'/%3E%3Ctext fill='%23D4A574' font-family='system-ui' font-size='48' x='50%25' y='45%25' text-anchor='middle'%3E%F0%9F%A4%B8%3C/text%3E%3Ctext fill='%239CAF88' font-family='system-ui' font-size='14' x='50%25' y='60%25' text-anchor='middle'%3EFlexibility%3C/text%3E%3C/svg%3E",
  'warm-up': "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect fill='%23FAF7F2' width='400' height='300'/%3E%3Ctext fill='%23D4A574' font-family='system-ui' font-size='48' x='50%25' y='45%25' text-anchor='middle'%3E%F0%9F%94%A5%3C/text%3E%3Ctext fill='%239CAF88' font-family='system-ui' font-size='14' x='50%25' y='60%25' text-anchor='middle'%3EWarm-Up%3C/text%3E%3C/svg%3E",
  'recovery': "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect fill='%23FAF7F2' width='400' height='300'/%3E%3Ctext fill='%23D4A574' font-family='system-ui' font-size='48' x='50%25' y='45%25' text-anchor='middle'%3E%F0%9F%8C%BF%3C/text%3E%3Ctext fill='%239CAF88' font-family='system-ui' font-size='14' x='50%25' y='60%25' text-anchor='middle'%3ERecovery%3C/text%3E%3C/svg%3E",
};

/**
 * Get image URL for a stretch, with fallback to placeholder
 */
export function getStretchImage(imagePath: string | undefined, category?: string): string {
  if (imagePath && !imagePath.startsWith('http')) {
    // Local image path - check if it exists (in production, these should be in /public)
    return imagePath;
  }

  if (imagePath && imagePath.startsWith('http')) {
    // External URL - return as-is
    return imagePath;
  }

  // Return category-specific placeholder or default
  if (category && CATEGORY_PLACEHOLDERS[category]) {
    return CATEGORY_PLACEHOLDERS[category];
  }

  return PLACEHOLDER_IMAGE;
}

/**
 * Image paths organized by routine
 * These map to /public/images/stretches/[routine]/[stretch].jpg
 */
export const STRETCH_IMAGES = {
  'posture-reset': {
    'doorway-chest-opener': '/images/stretches/posture-reset/doorway-chest-opener.jpg',
    'seated-thoracic-extension': '/images/stretches/posture-reset/seated-thoracic-extension.jpg',
    'half-kneeling-hip-flexor': '/images/stretches/posture-reset/half-kneeling-hip-flexor.jpg',
    'standing-forward-fold': '/images/stretches/posture-reset/standing-forward-fold.jpg',
    'childs-pose-side-reach': '/images/stretches/posture-reset/childs-pose-side-reach.jpg',
  },
  'lower-body-mobility': {
    '90-90-hip-stretch': '/images/stretches/lower-body-mobility/90-90-hip-stretch.jpg',
    'worlds-greatest-stretch': '/images/stretches/lower-body-mobility/worlds-greatest-stretch.jpg',
    'deep-squat-hold': '/images/stretches/lower-body-mobility/deep-squat-hold.jpg',
    'ankle-dorsiflexion': '/images/stretches/lower-body-mobility/ankle-dorsiflexion.jpg',
    'hamstring-sweep': '/images/stretches/lower-body-mobility/hamstring-sweep.jpg',
  },
  'split-progression': {
    'half-split': '/images/stretches/split-progression/half-split.jpg',
    'couch-stretch': '/images/stretches/split-progression/couch-stretch.jpg',
    'assisted-front-split': '/images/stretches/split-progression/assisted-front-split.jpg',
    'straddle-fold': '/images/stretches/split-progression/straddle-fold.jpg',
    'frog-stretch': '/images/stretches/split-progression/frog-stretch.jpg',
  },
  'morning-mobility': {
    'standing-side-reach': '/images/stretches/morning-mobility/standing-side-reach.jpg',
    'cat-cow': '/images/stretches/morning-mobility/cat-cow.jpg',
    'downward-dog': '/images/stretches/morning-mobility/downward-dog.jpg',
    'thoracic-rotation': '/images/stretches/morning-mobility/thoracic-rotation.jpg',
    'lunge-hamstring-flow': '/images/stretches/morning-mobility/lunge-hamstring-flow.jpg',
    'chest-expansion': '/images/stretches/morning-mobility/chest-expansion.jpg',
  },
  'daily-stretch': {
    'cat-cow': '/images/stretches/daily-stretch/cat-cow.jpg',
    'childs-pose': '/images/stretches/daily-stretch/childs-pose.jpg',
    'worlds-greatest-stretch': '/images/stretches/daily-stretch/worlds-greatest-stretch.jpg',
    'half-kneeling-hip-flexor': '/images/stretches/daily-stretch/half-kneeling-hip-flexor.jpg',
    'standing-forward-fold': '/images/stretches/daily-stretch/standing-forward-fold.jpg',
    'shoulder-opener-wall': '/images/stretches/daily-stretch/shoulder-opener-wall.jpg',
    'lying-spinal-twist': '/images/stretches/daily-stretch/lying-spinal-twist.jpg',
  },
  'apt-correction': {
    'kneeling-hip-flexor-apt': '/images/stretches/apt-correction/kneeling-hip-flexor-apt.jpg',
    'couch-stretch-apt': '/images/stretches/apt-correction/couch-stretch-apt.jpg',
    'glute-bridge-posterior-tilt': '/images/stretches/apt-correction/glute-bridge-posterior-tilt.jpg',
    'dead-bug': '/images/stretches/apt-correction/dead-bug.jpg',
    'standing-pelvic-tilt': '/images/stretches/apt-correction/standing-pelvic-tilt.jpg',
    'standing-hamstring-apt': '/images/stretches/apt-correction/standing-hamstring-apt.jpg',
  },
  'lower-back-relief': {
    'cat-cow-flow': '/images/stretches/lower-back-relief/cat-cow-flow.jpg',
    'childs-pose': '/images/stretches/lower-back-relief/childs-pose.jpg',
    'knee-to-chest': '/images/stretches/lower-back-relief/knee-to-chest.jpg',
    'supine-spinal-twist': '/images/stretches/lower-back-relief/supine-spinal-twist.jpg',
    'figure-4-stretch': '/images/stretches/lower-back-relief/figure-4-stretch.jpg',
    'pelvic-tilts': '/images/stretches/lower-back-relief/pelvic-tilts.jpg',
  },
  'neck-shoulder': {
    'neck-side-tilt': '/images/stretches/neck-shoulder/neck-side-tilt.jpg',
    'neck-rotation': '/images/stretches/neck-shoulder/neck-rotation.jpg',
    'upper-trap-stretch': '/images/stretches/neck-shoulder/upper-trap-stretch.jpg',
    'levator-scapulae-stretch': '/images/stretches/neck-shoulder/levator-scapulae-stretch.jpg',
    'doorway-chest-stretch': '/images/stretches/neck-shoulder/doorway-chest-stretch.jpg',
    'thread-the-needle': '/images/stretches/neck-shoulder/thread-the-needle.jpg',
  },
  'hip-mobility': {
    '90-90-hip-stretch': '/images/stretches/hip-mobility/90-90-hip-stretch.jpg',
    'pigeon-pose': '/images/stretches/hip-mobility/pigeon-pose.jpg',
    'frog-stretch': '/images/stretches/hip-mobility/frog-stretch.jpg',
    'butterfly-stretch': '/images/stretches/hip-mobility/butterfly-stretch.jpg',
    'hip-flexor-lunge': '/images/stretches/hip-mobility/hip-flexor-lunge.jpg',
    'standing-figure-4': '/images/stretches/hip-mobility/standing-figure-4.jpg',
  },
} as const;
