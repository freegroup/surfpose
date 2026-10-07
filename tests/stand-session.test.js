import { describe, expect, it } from 'vitest';
import { calibrateStanding } from '../src/analysis/board-axis.js';
import { createStandSession } from '../src/analysis/stand-session.js';
import { sequence, synthFrame, TEMPLATES } from './helpers/synth.js';

/** @typedef {import('../src/pose/types.js').PoseFrame} PoseFrame */

/** Feed frames through a session and collect every event. @param {PoseFrame[]} frames */
function runStand(frames) {
  const session = createStandSession();
  /** @type {import('../src/analysis/stand-session.js').StandEvent[]} */
  const events = [];
  for (const f of frames) events.push(...session.update(f, f.t));
  return events;
}

describe('createStandSession', () => {
  it('reports one stand when a good stance is held', () => {
    const events = runStand(sequence([{ hold: 'stance', ms: 1500 }]));
    const stands = events.filter((e) => e.type === 'stand');
    expect(stands).toHaveLength(1);
    expect(stands[0].frames.length).toBeGreaterThan(0);
    expect(stands[0].calib).not.toBeNull();
  });

  it('does not report while lying in the paddle position', () => {
    const events = runStand(sequence([{ hold: 'lying', ms: 1500 }]));
    expect(events.filter((e) => e.type === 'stand')).toHaveLength(0);
  });

  it('needs the stance held long enough', () => {
    const events = runStand(sequence([{ hold: 'stance', ms: 300 }]));
    expect(events.filter((e) => e.type === 'stand')).toHaveLength(0);
  });

  it('re-arms after leaving the stance for the next one', () => {
    const events = runStand(sequence([
      { hold: 'stance', ms: 1000 },
      { hold: 'lying', ms: 1000 }, // out of the stance long enough to re-arm
      { hold: 'stance', ms: 1000 },
    ]));
    expect(events.filter((e) => e.type === 'stand')).toHaveLength(2);
  });

  it('does not report twice while the stance just keeps being held', () => {
    const events = runStand(sequence([{ hold: 'stance', ms: 4000 }]));
    expect(events.filter((e) => e.type === 'stand')).toHaveLength(1);
  });
});

describe('calibrateStanding', () => {
  /** @param {1 | -1} noseDir */
  const standingFrames = (noseDir) =>
    Array.from({ length: 20 }, (_, i) => synthFrame({ template: TEMPLATES.stance, noseDir, t: i * 33 }));

  it('reads the nose direction from the gaze (both directions)', () => {
    expect(calibrateStanding(standingFrames(1))?.noseDir).toBe(1);
    expect(calibrateStanding(standingFrames(-1))?.noseDir).toBe(-1);
  });

  it('returns null without frames', () => {
    expect(calibrateStanding([])).toBeNull();
  });

  it('returns null when the gaze is not visible', () => {
    const blind = standingFrames(1).map((f) => synthFrame({
      template: TEMPLATES.stance, t: f.t,
      visibility: { NOSE: 0, LEFT_EAR: 0, RIGHT_EAR: 0 },
    }));
    expect(calibrateStanding(blind)).toBeNull();
  });
});
