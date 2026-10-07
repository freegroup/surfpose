// Compact pose storage for clips: x, y, visibility of the 33 image landmarks as Float32Array
// (~0.5 KB per frame instead of several KB of JSON). Enough to draw the skeleton in the replay.
import { LANDMARK_COUNT } from '../pose/landmarks.js';

/** @typedef {import('../pose/types.js').PoseFrame} PoseFrame */

/**
 * @typedef {object} PoseTrack
 * @property {number} width
 * @property {number} height
 * @property {Float32Array} times  seconds since the start of the clip
 * @property {Float32Array} data   frames × 33 × [x, y, visibility]
 */

const STRIDE = LANDMARK_COUNT * 3;

/**
 * @param {PoseFrame[]} frames
 * @param {number} startT ms, start of the clip
 * @returns {PoseTrack}
 */
export function toPoseTrack(frames, startT) {
  const data = new Float32Array(frames.length * STRIDE);
  frames.forEach((frame, f) => {
    frame.image.forEach((p, i) => data.set([p.x, p.y, p.visibility], f * STRIDE + i * 3));
  });
  return {
    width: frames[0]?.width ?? 0,
    height: frames[0]?.height ?? 0,
    times: Float32Array.from(frames, (frame) => (frame.t - startT) / 1000),
    data,
  };
}

/**
 * Pose closest to the given video time (null if none within 100 ms).
 * @param {PoseTrack} track
 * @param {number} seconds
 * @returns {PoseFrame | null}
 */
export function poseAt(track, seconds) {
  const { times } = track;
  let lo = 0;
  let hi = times.length - 1;
  if (hi < 0) return null;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (times[mid] < seconds) lo = mid + 1;
    else hi = mid;
  }
  const best = lo > 0 && seconds - times[lo - 1] < times[lo] - seconds ? lo - 1 : lo;
  if (Math.abs(times[best] - seconds) > 0.1) return null;

  const offset = best * STRIDE;
  return {
    t: times[best] * 1000,
    width: track.width,
    height: track.height,
    image: Array.from({ length: LANDMARK_COUNT }, (_, i) => ({
      x: track.data[offset + i * 3],
      y: track.data[offset + i * 3 + 1],
      z: 0,
      visibility: track.data[offset + i * 3 + 2],
    })),
    world: [],
  };
}
