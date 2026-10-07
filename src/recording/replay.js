import { extractStanceFeatures } from '../analysis/features.js';
import { createPopupSession } from '../analysis/popup-session.js';

/** @typedef {import('../pose/types.js').PoseFrame} PoseFrame */
/** @typedef {import('../analysis/popup-session.js').SessionEvent} SessionEvent */

/**
 * Runs recorded frames through the pop-up session, like the live engine does.
 * @param {PoseFrame[]} frames
 */
export function replay(frames) {
  const session = createPopupSession();
  /** @type {(SessionEvent & { at: number })[]} */
  const events = [];
  for (const frame of frames) {
    for (const event of session.update(frame, frame.t)) events.push({ ...event, at: frame.t });
  }

  const popups = events.flatMap((e) => (e.type === 'done' ? [e] : []));
  const stances = events.flatMap((e) =>
    e.type === 'stance' ? [extractStanceFeatures(e.frames[Math.floor(e.frames.length / 2)], e.calib)] : [],
  );
  return { events, popups, stances };
}
