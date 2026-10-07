import { PHASES } from '../config.js';
import { calibrate } from './board-axis.js';
import { extractFeatures } from './features.js';
import { classifyPhase, shoulderRise } from './phase-detector.js';

/** @typedef {import('../pose/types.js').PoseFrame} PoseFrame */
/** @typedef {import('./features.js').BodyFeatures} BodyFeatures */
/** @typedef {import('./features.js').Calibration} Calibration */
/** @typedef {'IDLE' | 'READY' | 'RUNNING' | 'DONE' | 'TIMEOUT'} SessionState */

/**
 * One pop-up attempt. Times are frame timestamps in ms.
 * @typedef {object} PopupRun
 * @property {number} startT        first movement of the shoulders (back-dated)
 * @property {number | null} landedT  first frame with both feet under the body
 * @property {number | null} endT     first frame of the stable stance (back-dated)
 * @property {boolean} kneeDown     a knee touched the board on the way up
 * @property {number | null} maxGazePitch  most downward look during the pop-up, degrees
 */

/**
 * @typedef {{ type: 'ready', calib: Calibration }
 *   | { type: 'start', t: number }
 *   | { type: 'done', run: PopupRun, calib: Calibration }
 *   | { type: 'stance', frames: PoseFrame[], run: PopupRun, calib: Calibration }
 *   | { type: 'abort' }
 *   | { type: 'timeout' }} SessionEvent
 */

/** Holds when `cond` has been true for `ms`; `since` is when it became true. */
function createDwell() {
  /** @type {number | null} */
  let since = null;
  return {
    /** @param {boolean} cond @param {number} t @param {number} ms */
    hold(cond, t, ms) {
      if (!cond) {
        since = null;
        return false;
      }
      since ??= t;
      return t - since >= ms;
    },
    since: () => /** @type {number} */ (since),
    reset() {
      since = null;
    },
  };
}

/**
 * Pop-up state machine: waits for the paddle position, calibrates, times the pop-up
 * and collects the stance frames for the evaluation. Pure – feed it frames, read events.
 */
export function createPopupSession() {
  /** @type {SessionState} */
  let state = 'IDLE';
  /** @type {Calibration | null} */
  let calib = null;
  /** @type {PopupRun | null} */
  let run = null;
  /** @type {number | null} */
  let lastSeenT = null;

  /** @type {PoseFrame[]} */
  let lyingFrames = [];
  /** @type {{ t: number, rise: number, f: BodyFeatures }[]} */
  let readyBuffer = [];
  /** @type {PoseFrame[]} */
  let recentFrames = [];
  /** @type {PoseFrame[] | null} */
  let stanceFrames = null;

  const lying = createDwell();
  const shouldersUp = createDwell();
  const stance = createDwell();
  const lyingAgain = createDwell();

  /** @param {PoseFrame} frame @param {SessionEvent[]} events */
  function waitForLying(frame, events) {
    if (classifyPhase(extractFeatures(frame, null), null) !== 'LYING') {
      lyingFrames = [];
      lying.reset();
      return;
    }
    lyingFrames.push(frame);
    if (!lying.hold(true, frame.t, PHASES.readyAfterMs)) return;
    const measured = calibrate(lyingFrames);
    lyingFrames = [];
    lying.reset();
    if (!measured) return;
    finishStanceCollection(events);
    becomeReady(measured);
    events.push({ type: 'ready', calib: measured });
  }

  /** @param {Calibration} measured */
  function becomeReady(measured) {
    calib = measured;
    state = 'READY';
    run = null;
    readyBuffer = [];
    shouldersUp.reset();
  }

  /** Earliest frame of the current rise of the shoulders. */
  function onsetTime() {
    let startT = readyBuffer[readyBuffer.length - 1].t;
    for (let i = readyBuffer.length - 1; i >= 0 && readyBuffer[i].rise > PHASES.onsetRise; i--) {
      startT = readyBuffer[i].t;
    }
    return startT;
  }

  /** @param {BodyFeatures} f */
  function track(f) {
    const r = /** @type {PopupRun} */ (run);
    if (f.kneeDown) r.kneeDown = true;
    if (f.gazePitch !== null) r.maxGazePitch = Math.max(r.maxGazePitch ?? -Infinity, f.gazePitch);
    if (r.landedT === null && f.feetUnderBody) r.landedT = f.t;
  }

  /** @param {PoseFrame} frame @param {SessionEvent[]} events */
  function whileReady(frame, events) {
    const c = /** @type {Calibration} */ (calib);
    const f = extractFeatures(frame, c);
    const rise = shoulderRise(f, c);
    if (!f.core || rise === null) return;

    readyBuffer.push({ t: frame.t, rise, f });
    readyBuffer = readyBuffer.filter((b) => frame.t - b.t <= 2000);
    if (!shouldersUp.hold(rise > PHASES.pushupRise, frame.t, PHASES.startConfirmMs)) return;

    const startT = onsetTime();
    run = { startT, landedT: null, endT: null, kneeDown: false, maxGazePitch: null };
    readyBuffer.filter((b) => b.t >= startT).forEach((b) => track(b.f));
    readyBuffer = [];
    recentFrames = [];
    stance.reset();
    lyingAgain.reset();
    state = 'RUNNING';
    events.push({ type: 'start', t: startT });
  }

  /** @param {PoseFrame} frame @param {SessionEvent[]} events */
  function whileRunning(frame, events) {
    const c = /** @type {Calibration} */ (calib);
    const r = /** @type {PopupRun} */ (run);
    const f = extractFeatures(frame, c);
    recentFrames.push(frame);
    recentFrames = recentFrames.filter((fr) => frame.t - fr.t <= PHASES.stableStanceMs + 200);
    if (!f.core) return;

    track(f);
    const phase = classifyPhase(f, c);

    if (lyingAgain.hold(phase === 'LYING', frame.t, PHASES.abortLyingMs)) {
      becomeReady(c);
      events.push({ type: 'abort' });
      return;
    }
    if (stance.hold(phase === 'STANCE', frame.t, PHASES.stableStanceMs)) {
      r.endT = stance.since();
      state = 'DONE';
      stanceFrames = recentFrames.filter((fr) => fr.t >= /** @type {number} */ (r.endT));
      events.push({ type: 'done', run: { ...r }, calib: c });
    }
  }

  /** @param {SessionEvent[]} events */
  function finishStanceCollection(events) {
    if (!stanceFrames || !run || !calib) return;
    events.push({ type: 'stance', frames: stanceFrames, run: { ...run }, calib });
    stanceFrames = null;
  }

  return {
    /**
     * Feed one analyzed frame (null when nobody was detected).
     * @param {PoseFrame | null} frame
     * @param {number} t frame timestamp in ms
     * @returns {SessionEvent[]}
     */
    update(frame, t) {
      /** @type {SessionEvent[]} */
      const events = [];

      if (state === 'RUNNING' && t - /** @type {PopupRun} */ (run).startT > PHASES.timeoutMs) {
        state = 'TIMEOUT';
        run = null;
        events.push({ type: 'timeout' });
      }
      if (!frame) {
        if (state === 'READY' && lastSeenT !== null && t - lastSeenT > PHASES.lostAfterMs) state = 'IDLE';
        return events;
      }
      lastSeenT = t;

      if (state === 'READY') whileReady(frame, events);
      else if (state === 'RUNNING') whileRunning(frame, events);
      else {
        if (state === 'DONE' && stanceFrames) {
          stanceFrames.push(frame);
          if (t - /** @type {number} */ (run?.endT) >= PHASES.evaluationWindowMs) finishStanceCollection(events);
        }
        waitForLying(frame, events);
      }
      return events;
    },

    state: () => state,
    run: () => run,
  };
}
