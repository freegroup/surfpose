import { STAND_MODE } from '../config.js';
import { calibrateStanding } from './board-axis.js';
import { createDwell } from './dwell.js';
import { extractFeatures } from './features.js';
import { classifyPhase } from './phase-detector.js';

/** @typedef {import('../pose/types.js').PoseFrame} PoseFrame */
/** @typedef {import('./features.js').Calibration} Calibration */
/** @typedef {'WAITING' | 'STANDING'} StandState */
/** @typedef {{ type: 'stand', frames: PoseFrame[], calib: Calibration }} StandEvent */

/**
 * Stand mode: reports every surf stance that is held for STAND_MODE.holdMs, then waits until
 * the person leaves the stance before the next one counts. Pure – feed frames, read events.
 */
export function createStandSession() {
  /** @type {StandState} */
  let state = 'WAITING';
  /** @type {PoseFrame[]} */
  let recent = [];
  const inStance = createDwell();
  const outOfStance = createDwell();

  return {
    /**
     * @param {PoseFrame | null} frame
     * @param {number} t frame timestamp in ms
     * @returns {StandEvent[]}
     */
    update(frame, t) {
      let isStance = false;
      if (frame) {
        recent.push(frame);
        recent = recent.filter((f) => t - f.t <= STAND_MODE.bufferMs);
        const calib = calibrateStanding(recent);
        isStance = calib !== null && classifyPhase(extractFeatures(frame, calib), calib) === 'STANCE';
      }

      if (state === 'STANDING') {
        if (outOfStance.hold(!isStance, t, STAND_MODE.rearmMs)) {
          state = 'WAITING';
          inStance.reset();
        }
        return [];
      }
      if (!inStance.hold(isStance, t, STAND_MODE.holdMs)) return [];

      const frames = recent.filter((f) => f.t >= inStance.since());
      const calib = calibrateStanding(frames);
      state = 'STANDING';
      outOfStance.reset();
      return calib ? [{ type: 'stand', frames, calib }] : [];
    },

    state: () => state,
  };
}
