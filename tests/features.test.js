import { describe, expect, it } from 'vitest';
import { calibrate } from '../src/analysis/board-axis.js';
import { extractFeatures, extractStanceFeatures } from '../src/analysis/features.js';
import { synthFrame, TEMPLATES } from './helpers/synth.js';

/** @param {1 | -1} noseDir */
const lyingFrames = (noseDir, visibility = {}) =>
  Array.from({ length: 20 }, (_, i) => synthFrame({ template: TEMPLATES.lying, noseDir, t: i * 33, visibility, noise: 2 }));

describe('calibrate (board axis from paddle position)', () => {
  for (const noseDir of /** @type {const} */ ([1, -1])) {
    it(`finds the nose direction ${noseDir} and the raised head agrees`, () => {
      const calib = calibrate(lyingFrames(noseDir));
      expect(calib?.noseDir).toBe(noseDir);
      expect(calib?.gazeAgrees).toBe(true);
    });
  }

  it('still finds the direction from shoulders vs. hips when the face is not visible', () => {
    const calib = calibrate(lyingFrames(1, { NOSE: 0.1, LEFT_EAR: 0.1, RIGHT_EAR: 0.1 }));
    expect(calib?.noseDir).toBe(1);
    expect(calib?.gazeAgrees).toBe(false);
  });

  it('measures floor and body scale', () => {
    const calib = calibrate(lyingFrames(1));
    expect(calib?.groundY).toBeCloseTo(630, -1);
    expect(calib?.torsoLen).toBeCloseTo(148, -1);
    expect(calib?.shoulderHeight).toBeGreaterThan(0.2);
    expect(calib?.shoulderHeight).toBeLessThan(0.45);
  });
});

describe('extractFeatures', () => {
  const calib = /** @type {import('../src/analysis/features.js').Calibration} */ (calibrate(lyingFrames(1)));
  const features = (/** @type {keyof typeof TEMPLATES} */ name) =>
    extractFeatures(synthFrame({ template: TEMPLATES[name] }), calib);

  it('lying: body horizontal, legs flat, hands on the board, head looking forward', () => {
    const f = features('lying');
    expect(f.core).toBe(true);
    expect(f.torsoIncl).toBeGreaterThan(60);
    expect(f.legsFlat).toBe(true);
    expect(f.handsDown).toBe(true);
    expect(f.feetUnderBody).toBe(false);
    expect(Math.abs(/** @type {number} */ (f.gazePitch))).toBeLessThan(10);
  });

  it('push-up: shoulders clearly above the lying baseline', () => {
    const f = features('pushup');
    expect(/** @type {number} */ (f.shoulderHeight) - calib.shoulderHeight).toBeGreaterThan(0.5);
    expect(f.handsDown).toBe(true);
  });

  it('surf stance counts as standing although it is low and leaning', () => {
    const f = features('stance');
    expect(f.feetUnderBody).toBe(true);
    expect(f.hipsAboveKnees).toBe(true);
    expect(f.handsDown).toBe(false);
    expect(f.kneeDown).toBe(false);
    expect(f.torsoIncl).toBeLessThan(50);
  });

  it('detects a knee on the board', () => {
    expect(features('kneeDown').kneeDown).toBe(true);
  });

  it('without calibration the height-based features are unknown', () => {
    const f = extractFeatures(synthFrame({ template: TEMPLATES.stance }), null);
    expect(f.shoulderHeight).toBeNull();
    expect(f.feetUnderBody).toBeNull();
  });
});

describe('extractStanceFeatures', () => {
  for (const noseDir of /** @type {const} */ ([1, -1])) {
    for (const stance of /** @type {const} */ (['regular', 'goofy'])) {
      it(`${stance}, nose ${noseDir > 0 ? 'right' : 'left'}: front foot and joint angles`, () => {
        const calib = /** @type {import('../src/analysis/features.js').Calibration} */ (calibrate(lyingFrames(noseDir)));
        const s = extractStanceFeatures(synthFrame({ template: TEMPLATES.stance, noseDir, stance }), calib);
        expect(s.frontFoot).toBe(stance === 'regular' ? 'left' : 'right');
        // bent knees within the target range of a good stance (110°–150°)
        expect(s.frontKnee).toBeGreaterThan(115);
        expect(s.frontKnee).toBeLessThan(130);
        expect(s.backKnee).toBeGreaterThan(120);
        expect(s.backKnee).toBeLessThan(140);
        expect(s.stanceWidth).toBeCloseTo(1.66, 1);
        expect(s.torsoLean).toBeGreaterThan(5);
        expect(s.torsoLean).toBeLessThan(20);
        expect(s.lookingForward).toBe(true);
        expect(s.hipPos).toBeCloseTo(0.51, 1);
      });
    }
  }

  const calib = /** @type {import('../src/analysis/features.js').Calibration} */ (calibrate(lyingFrames(1)));

  it('upright stance: almost straight knees, no lean', () => {
    const s = extractStanceFeatures(synthFrame({ template: TEMPLATES.upright }), calib);
    expect(s.frontKnee).toBeGreaterThan(165);
    expect(Math.abs(s.torsoLean)).toBeLessThan(3);
  });

  it('looking down at the board raises the gaze pitch', () => {
    const good = extractStanceFeatures(synthFrame({ template: TEMPLATES.stance }), calib);
    const down = extractStanceFeatures(synthFrame({ template: TEMPLATES.lookDown }), calib);
    expect(/** @type {number} */ (good.gazePitch)).toBeLessThan(15);
    expect(/** @type {number} */ (down.gazePitch)).toBeGreaterThan(40);
  });
});
