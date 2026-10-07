import { describe, expect, it } from 'vitest';
import { calibrate } from '../src/analysis/board-axis.js';
import { buildProfile, DEFAULT_PROFILE } from '../src/analysis/reference-profile.js';
import { evaluateStance, measureStance } from '../src/analysis/stance-evaluator.js';
import { sequence, synthFrame, TEMPLATES } from './helpers/synth.js';

/** @typedef {import('../src/analysis/popup-session.js').PopupRun} PopupRun */

/** @type {PopupRun} */
const cleanRun = { startT: 0, landedT: 400, endT: 600, kneeDown: false, maxGazePitch: 5 };

/**
 * @param {keyof typeof TEMPLATES} template
 * @param {{ noseDir?: 1 | -1, stance?: 'regular' | 'goofy', run?: PopupRun, visibility?: Record<string, number> }} [options]
 */
function measure(template, { noseDir = 1, stance = 'regular', run = cleanRun, visibility = {} } = {}) {
  const calib = /** @type {import('../src/analysis/features.js').Calibration} */ (
    calibrate(sequence([{ hold: 'lying', ms: 700 }], { noseDir }))
  );
  const frames = Array.from({ length: 25 }, (_, i) =>
    synthFrame({ template: TEMPLATES[template], noseDir, stance, t: i * 33, noise: 1.5, visibility }));
  return measureStance(frames, run, calib);
}

const byKey = (/** @type {import('../src/analysis/stance-evaluator.js').StanceEvaluation} */ e, /** @type {string} */ key) =>
  /** @type {import('../src/analysis/stance-evaluator.js').CriterionResult} */ (e.criteria.find((c) => c.key === key));

describe('stance evaluation', () => {
  it('rates a good surf stance highly and has no tips', () => {
    const e = evaluateStance(measure('stance'), DEFAULT_PROFILE);
    expect(e.score).toBeGreaterThanOrEqual(90);
    expect(e.tips).toEqual([]);
    expect(e.basis.kind).toBe('default');
  });

  for (const noseDir of /** @type {const} */ ([1, -1])) {
    for (const stance of /** @type {const} */ (['regular', 'goofy'])) {
      it(`recognizes ${stance} with the nose ${noseDir > 0 ? 'right' : 'left'}`, () => {
        const m = measure('stance', { noseDir, stance });
        expect(m.stance.side).toBe(stance);
        expect(m.stance.confidence).toBeGreaterThan(0.9);
      });
    }
  }

  it('upright and stiff: lower score, tips about bent knees and stance width', () => {
    const e = evaluateStance(measure('upright'), DEFAULT_PROFILE);
    expect(e.score).toBeLessThan(70);
    expect(byKey(e, 'frontKnee').status).not.toBe('good');
    expect(byKey(e, 'stanceWidth').status).not.toBe('good');
    expect(e.tips.join(' ')).toMatch(/Knie mehr beugen/);
  });

  it('looking down at the board gives the gaze tip', () => {
    const e = evaluateStance(measure('lookDown'), DEFAULT_PROFILE);
    expect(byKey(e, 'gazePitch').status).toBe('bad');
    expect(e.tips).toContain('Blick nach vorn statt aufs Board.');
  });

  it('a knee on the board during the pop-up is a tip', () => {
    const e = evaluateStance(measure('stance', { run: { ...cleanRun, kneeDown: true } }), DEFAULT_PROFILE);
    expect(e.tips[0]).toMatch(/Knie aufstehen/);
  });

  it('marks head criteria as not measurable instead of guessing when the face is hidden', () => {
    const e = evaluateStance(measure('stance', { visibility: { NOSE: 0.1, LEFT_EAR: 0.1, RIGHT_EAR: 0.1 } }), DEFAULT_PROFILE);
    expect(byKey(e, 'gazePitch').status).toBe('na');
    expect(byKey(e, 'lookingForward').status).toBe('na');
    expect(e.tips.join(' ')).not.toMatch(/Blick/);
  });
});

describe('reference profile from 🎯 clips', () => {
  const good = measure('stance').values;

  it('keeps the starting values with fewer than 3 references', () => {
    expect(buildProfile([good, good])).toEqual({ references: {}, basis: { kind: 'default', count: 2 } });
  });

  it('starting values score exactly like the old 110–150° range with 20° falloff', () => {
    const knee = (/** @type {number} */ frontKnee) =>
      byKey(evaluateStance({ ...measure('stance'), values: { ...good, frontKnee } }, DEFAULT_PROFILE), 'frontKnee');
    expect(knee(110).score).toBe(100);
    expect(knee(150).score).toBe(100);
    expect(knee(100).score).toBeCloseTo(50);
    expect(knee(90).status).toBe('bad');
  });

  it('moves the reference to the median and keeps the ranges', () => {
    const profile = buildProfile([118, 121, 126].map((frontKnee) => ({ ...good, frontKnee })));
    expect(profile.basis).toEqual({ kind: 'references', count: 3 });
    expect(profile.references.frontKnee).toBe(121);
    const at = (/** @type {number} */ frontKnee) =>
      byKey(evaluateStance({ ...measure('stance'), values: { ...good, frontKnee } }, profile), 'frontKnee');
    expect(at(121).target).toEqual({ reference: 121, perfectRange: 20 });
    expect(at(140).score).toBe(100); // still ± 20° perfect – references never tighten it
    expect(at(150).status).toBe('warn');
  });

  it('references score themselves fully', () => {
    const self = evaluateStance(measure('stance'), buildProfile([good, good, good]));
    for (const c of self.criteria) if (c.score !== null) expect(c.score, c.key).toBeGreaterThan(90);
  });

  it('a single outlier reference barely moves the reference', () => {
    const refs = [118, 120, 121, 122, 124, 158].map((frontKnee) => ({ ...good, frontKnee }));
    expect(buildProfile(refs).references.frontKnee).toBeLessThan(125);
  });

  it('never lets references turn straight knees into the standard (guard rails)', () => {
    const stiff = measure('upright').values;
    const profile = buildProfile([stiff, stiff, stiff]);
    expect(profile.references.frontKnee).toBeLessThanOrEqual(140);
    const e = evaluateStance(measure('upright'), profile);
    expect(byKey(e, 'frontKnee').status).not.toBe('good');
  });
});
