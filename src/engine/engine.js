import { createPopupSession } from '../analysis/popup-session.js';
import { SMOOTHING } from '../config.js';
import { createPoseSmoother } from '../filter/one-euro.js';

/** @typedef {import('../pose/types.js').PoseSource} PoseSource */
/** @typedef {import('../pose/types.js').PoseFrame} PoseFrame */
/** @typedef {import('../analysis/popup-session.js').SessionEvent} SessionEvent */
/** @typedef {import('../analysis/popup-session.js').SessionState} SessionState */
/** @typedef {import('../analysis/popup-session.js').PopupRun} PopupRun */

/**
 * @typedef {object} EngineResult
 * @property {number} t
 * @property {PoseFrame | null} frame  smoothed pose, null when nobody is detected
 * @property {number} inferenceMs
 * @property {SessionState} state
 * @property {PopupRun | null} run     the pop-up in progress (or the last one)
 * @property {SessionEvent[]} events
 */

/**
 * The DOM-free analysis pipeline. Runs in the worker, in the main-thread fallback and in tests.
 * @param {PoseSource} source
 */
export function createEngine(source) {
  const smoother = createPoseSmoother(SMOOTHING);
  const session = createPopupSession();

  return {
    init: () => source.init(),

    /**
     * @param {ImageBitmap} image
     * @param {number} t frame timestamp in ms
     * @returns {EngineResult}
     */
    process(image, t) {
      const start = performance.now();
      const raw = source.detect(image, t);
      const inferenceMs = performance.now() - start;
      if (!raw) smoother.reset();
      const frame = raw && smoother.smooth(raw);
      const events = session.update(frame, t);
      return { t, frame, inferenceMs, state: session.state(), run: session.run(), events };
    },
  };
}
