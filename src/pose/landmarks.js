// BlazePose / MediaPipe Pose topology (33 landmarks).
import { MIN_VISIBILITY } from '../config.js';

/** @typedef {import('./types.js').ImageLandmark} ImageLandmark */

export const LM = /** @type {const} */ ({
  NOSE: 0,
  LEFT_EYE: 2,
  RIGHT_EYE: 5,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
});

export const LANDMARK_COUNT = 33;

/** Body skeleton for drawing (face and fingers left out on purpose). */
export const SKELETON_EDGES = [
  [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER],
  [LM.LEFT_SHOULDER, LM.LEFT_ELBOW],
  [LM.LEFT_ELBOW, LM.LEFT_WRIST],
  [LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW],
  [LM.RIGHT_ELBOW, LM.RIGHT_WRIST],
  [LM.LEFT_SHOULDER, LM.LEFT_HIP],
  [LM.RIGHT_SHOULDER, LM.RIGHT_HIP],
  [LM.LEFT_HIP, LM.RIGHT_HIP],
  [LM.LEFT_HIP, LM.LEFT_KNEE],
  [LM.LEFT_KNEE, LM.LEFT_ANKLE],
  [LM.LEFT_ANKLE, LM.LEFT_HEEL],
  [LM.LEFT_HEEL, LM.LEFT_FOOT_INDEX],
  [LM.LEFT_ANKLE, LM.LEFT_FOOT_INDEX],
  [LM.RIGHT_HIP, LM.RIGHT_KNEE],
  [LM.RIGHT_KNEE, LM.RIGHT_ANKLE],
  [LM.RIGHT_ANKLE, LM.RIGHT_HEEL],
  [LM.RIGHT_HEEL, LM.RIGHT_FOOT_INDEX],
  [LM.RIGHT_ANKLE, LM.RIGHT_FOOT_INDEX],
];

/** Landmarks drawn as points; the head is drawn as one point (see headCenter). */
export const SKELETON_POINTS = [
  LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_ELBOW, LM.RIGHT_ELBOW, LM.LEFT_WRIST, LM.RIGHT_WRIST,
  LM.LEFT_HIP, LM.RIGHT_HIP, LM.LEFT_KNEE, LM.RIGHT_KNEE, LM.LEFT_ANKLE, LM.RIGHT_ANKLE,
  LM.LEFT_FOOT_INDEX, LM.RIGHT_FOOT_INDEX,
];

/**
 * Head as one point: average of the visible nose and ears.
 * @param {ImageLandmark[]} lm normalized image landmarks
 * @returns {ImageLandmark | null}
 */
export function headCenter(lm) {
  const seen = [lm[LM.NOSE], lm[LM.LEFT_EAR], lm[LM.RIGHT_EAR]].filter((p) => p.visibility >= MIN_VISIBILITY);
  if (!seen.length) return null;
  const avg = (/** @type {'x' | 'y' | 'z' | 'visibility'} */ k) => seen.reduce((s, p) => s + p[k], 0) / seen.length;
  return { x: avg('x'), y: avg('y'), z: avg('z'), visibility: avg('visibility') };
}
