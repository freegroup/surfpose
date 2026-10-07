import { LM } from '../pose/landmarks.js';
import { gaze, px } from './features.js';
import { dist, median, mid } from './geometry.js';

/** @typedef {import('../pose/types.js').PoseFrame} PoseFrame */
/** @typedef {import('./features.js').Calibration} Calibration */

/**
 * Measures board direction, floor and body scale from frames of a person lying in paddle position.
 * Label-free: uses shoulders vs. hips, so left/right mix-ups of the model don't matter.
 * Second signal: the raised head looks towards the nose.
 * @param {PoseFrame[]} frames
 * @returns {Calibration | null}
 */
export function calibrate(frames) {
  if (!frames.length) return null;

  const bodies = frames.map((f) => {
    const shoulder = mid(px(f, LM.LEFT_SHOULDER), px(f, LM.RIGHT_SHOULDER));
    const hip = mid(px(f, LM.LEFT_HIP), px(f, LM.RIGHT_HIP));
    const low = [LM.LEFT_HIP, LM.RIGHT_HIP, LM.LEFT_KNEE, LM.RIGHT_KNEE, LM.LEFT_ANKLE, LM.RIGHT_ANKLE]
      .map((i) => px(f, i))
      .filter((p) => p.seen)
      .map((p) => p.y);
    return { shoulder, hip, torsoLen: dist(shoulder, hip), lowest: Math.max(...low) };
  });

  const direction = Math.sign(median(bodies.map((b) => b.shoulder.x - b.hip.x)));
  if (direction === 0) return null;
  const noseDir = /** @type {1 | -1} */ (direction);

  const gazeDirs = frames.map(gaze).filter((g) => g !== null).map((g) => g.dirX);
  const gazeAgrees = gazeDirs.length > 0 && Math.sign(gazeDirs.reduce((s, d) => s + d, 0)) === noseDir;

  const groundY = median(bodies.map((b) => b.lowest));
  const torsoLen = median(bodies.map((b) => b.torsoLen));

  return {
    noseDir,
    gazeAgrees,
    groundY,
    torsoLen,
    shoulderHeight: median(bodies.map((b) => (groundY - b.shoulder.y) / torsoLen)),
  };
}

/**
 * Calibration from a person standing in surf stance (stand mode – no lying phase):
 * the nose direction comes from the gaze (surfers look towards the nose), the floor from the feet.
 * @param {PoseFrame[]} frames
 * @returns {Calibration | null} null when the gaze isn't visible
 */
export function calibrateStanding(frames) {
  const gazeDirs = frames.map(gaze).filter((g) => g !== null).map((g) => g.dirX);
  const direction = Math.sign(gazeDirs.reduce((s, d) => s + d, 0));
  if (!frames.length || direction === 0) return null;

  const bodies = frames.map((f) => {
    const shoulder = mid(px(f, LM.LEFT_SHOULDER), px(f, LM.RIGHT_SHOULDER));
    const hip = mid(px(f, LM.LEFT_HIP), px(f, LM.RIGHT_HIP));
    return { shoulder, torsoLen: dist(shoulder, hip), lowest: Math.max(px(f, LM.LEFT_ANKLE).y, px(f, LM.RIGHT_ANKLE).y) };
  });
  const groundY = median(bodies.map((b) => b.lowest));
  const torsoLen = median(bodies.map((b) => b.torsoLen));
  return {
    noseDir: /** @type {1 | -1} */ (direction),
    gazeAgrees: true,
    groundY,
    torsoLen,
    shoulderHeight: median(bodies.map((b) => (groundY - b.shoulder.y) / torsoLen)),
  };
}
