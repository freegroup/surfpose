import { describe, expect, it } from 'vitest';
import { createPopupSession } from '../src/analysis/popup-session.js';
import { sequence, synthFrame, TEMPLATES } from './helpers/synth.js';

/** @typedef {import('../src/analysis/popup-session.js').SessionEvent} SessionEvent */

/** @param {import('../src/pose/types.js').PoseFrame[]} frames */
function play(frames, session = createPopupSession()) {
  /** @type {SessionEvent[]} */
  const events = [];
  for (const frame of frames) events.push(...session.update(frame, frame.t));
  return { session, events, types: events.map((e) => e.type) };
}

const popUp = /** @type {const} */ ([
  { hold: 'lying', ms: 1500 },
  { to: 'pushup', ms: 300 },
  { to: 'stance', ms: 400 },
  { hold: 'stance', ms: 1200 },
]);

describe('PopUpSession', () => {
  it('becomes ready after lying still in paddle position', () => {
    const { types } = play(sequence([{ hold: 'lying', ms: 1000 }]));
    expect(types).toEqual(['ready']);
  });

  it('measures a full pop-up and back-dates start and end', () => {
    const { events, types } = play(sequence(popUp));
    expect(types).toEqual(['ready', 'start', 'done', 'stance']);
    const done = /** @type {Extract<SessionEvent, { type: 'done' }>} */ (events[2]);
    // the shoulders start rising right after 1500 ms
    expect(done.run.startT).toBeGreaterThan(1499);
    expect(done.run.startT).toBeLessThan(1500 + 70);
    const seconds = (/** @type {number} */ (done.run.endT) - done.run.startT) / 1000;
    // synthetic motion: 300 ms push-up + 400 ms until the feet are under the body
    expect(seconds).toBeGreaterThan(0.5);
    expect(seconds).toBeLessThan(0.75);
    expect(done.run.landedT).not.toBeNull();
    expect(done.run.kneeDown).toBe(false);
  });

  for (const noseDir of /** @type {const} */ ([1, -1])) {
    for (const stance of /** @type {const} */ (['regular', 'goofy'])) {
      it(`works with nose ${noseDir > 0 ? 'right' : 'left'}, ${stance}`, () => {
        expect(play(sequence(popUp, { noseDir, stance })).types).toEqual(['ready', 'start', 'done', 'stance']);
      });
    }
  }

  it('does not start when the head moves while lying', () => {
    const frames = sequence([{ hold: 'lying', ms: 3000 }]).map((frame, i) => {
      // nod the head up and down by ±8 cm
      const nod = Math.sin(i / 3) * (0.08 * 280) / frame.height;
      for (const lm of [0, 7, 8]) frame.image[lm].y += nod;
      return frame;
    });
    expect(play(frames).types).toEqual(['ready']);
  });

  it('ignores a single frame that looks like a push-up', () => {
    const frames = sequence([{ hold: 'lying', ms: 2000 }]);
    frames[40] = synthFrame({ template: TEMPLATES.pushup, t: frames[40].t });
    expect(play(frames).types).toEqual(['ready']);
  });

  it('counts a low surf stance as standing (no upright requirement)', () => {
    const { types } = play(sequence(popUp));
    expect(types).toContain('done');
  });

  it('aborts when lying down again during the pop-up', () => {
    const { types, session } = play(sequence([
      { hold: 'lying', ms: 1500 }, { to: 'pushup', ms: 300 }, { hold: 'pushup', ms: 300 },
      { to: 'lying', ms: 300 }, { hold: 'lying', ms: 1000 },
    ]));
    expect(types).toEqual(['ready', 'start', 'abort']);
    expect(session.state()).toBe('READY');
  });

  it('times out after 20 s without standing up', () => {
    const { types } = play(sequence([{ hold: 'lying', ms: 1500 }, { to: 'pushup', ms: 300 }, { hold: 'pushup', ms: 21000 }]));
    expect(types).toEqual(['ready', 'start', 'timeout']);
  });

  it('notices a knee on the board on the way up', () => {
    const { events } = play(sequence([
      { hold: 'lying', ms: 1500 }, { to: 'pushup', ms: 300 }, { to: 'kneeDown', ms: 250 }, { hold: 'kneeDown', ms: 150 },
      { to: 'stance', ms: 400 }, { hold: 'stance', ms: 1200 },
    ]));
    const done = /** @type {Extract<SessionEvent, { type: 'done' }>} */ (events.find((e) => e.type === 'done'));
    expect(done.run.kneeDown).toBe(true);
  });

  it('collects the stance frames for the evaluation', () => {
    const { events } = play(sequence(popUp));
    const stance = /** @type {Extract<SessionEvent, { type: 'stance' }>} */ (events.find((e) => e.type === 'stance'));
    const span = stance.frames[stance.frames.length - 1].t - stance.frames[0].t;
    expect(span).toBeGreaterThanOrEqual(780);
    expect(stance.frames[0].t).toBe(stance.run.endT);
  });

  it('is ready for the next rep after lying down again', () => {
    const first = play(sequence(popUp));
    const next = play(sequence([{ to: 'lying', ms: 600 }, { hold: 'lying', ms: 1500 }], { startT: 3500 }), first.session);
    expect(next.types).toEqual(['ready']);
  });
});
