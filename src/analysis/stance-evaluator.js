import { EVALUATION, MIN_VISIBILITY, STANCE_CRITERIA } from '../config.js';
import { LM } from '../pose/landmarks.js';
import { extractStanceFeatures } from './features.js';
import { median } from './geometry.js';

/** @typedef {import('../pose/types.js').PoseFrame} PoseFrame */
/** @typedef {import('./features.js').Calibration} Calibration */
/** @typedef {import('./features.js').StanceFeatures} StanceFeatures */
/** @typedef {import('./popup-session.js').PopupRun} PopupRun */
/** @typedef {import('./reference-profile.js').Profile} Profile */
/** @typedef {keyof typeof STANCE_CRITERIA} CriterionKey */

/**
 * Measured values of one stance (stored with 🎯 reference clips). null = not measurable.
 * @typedef {object} StanceMeasurement
 * @property {Record<string, number | boolean | null>} values
 * @property {{ side: 'regular' | 'goofy' | null, confidence: number }} stance
 */

/**
 * @typedef {object} CriterionResult
 * @property {string} key
 * @property {string} label
 * @property {number | boolean | null} value
 * @property {string} unit
 * @property {[number, number] | null} target
 * @property {number | null} score   0..100, null = not measurable
 * @property {'good' | 'warn' | 'bad' | 'na'} status
 * @property {string | null} tip
 */

/**
 * @typedef {object} StanceEvaluation
 * @property {number} score   0..100
 * @property {StanceMeasurement['stance']} stance
 * @property {CriterionResult[]} criteria
 * @property {string[]} tips   the 2–3 most important ones
 * @property {Profile['basis']} basis
 */

const SHOULDERS = [[LM.LEFT_SHOULDER], [LM.RIGHT_SHOULDER]];
const HIPS = [[LM.LEFT_HIP], [LM.RIGHT_HIP]];
const KNEES = [[LM.LEFT_KNEE], [LM.RIGHT_KNEE]];
const ANKLES = [[LM.LEFT_ANKLE], [LM.RIGHT_ANKLE]];
const NOSE_AND_EAR = [[LM.NOSE], [LM.LEFT_EAR, LM.RIGHT_EAR]];

/** Landmarks each criterion relies on – each inner list means "one of these". */
const NEEDS = /** @type {Record<string, number[][]>} */ ({
  stanceWidth: [...ANKLES, ...SHOULDERS],
  frontKnee: [...HIPS, ...KNEES, ...ANKLES],
  backKnee: [...HIPS, ...KNEES, ...ANKLES],
  hip: [...SHOULDERS, ...HIPS, ...KNEES],
  torsoLean: [...SHOULDERS, ...HIPS],
  gazePitch: NOSE_AND_EAR,
  lookingForward: NOSE_AND_EAR,
  neckAngle: [...SHOULDERS, ...HIPS, [LM.LEFT_EAR, LM.RIGHT_EAR]],
  headPos: [...ANKLES, [LM.NOSE, LM.LEFT_EAR, LM.RIGHT_EAR]],
  hipPos: [...HIPS, ...ANKLES],
});

/** @param {PoseFrame} frame @param {number[][]} needs */
const visible = (frame, needs) =>
  needs.every((anyOf) => anyOf.some((i) => frame.image[i].visibility >= MIN_VISIBILITY));

/** @param {StanceFeatures} s @param {string} key @returns {number | boolean | null} */
function featureValue(s, key) {
  if (key === 'hip') return (s.frontHip + s.backHip) / 2;
  return /** @type {number | boolean | null} */ (s[/** @type {keyof StanceFeatures} */ (key)]);
}

/**
 * Median values over the stance window, criteria with too few visible frames are null.
 * @param {PoseFrame[]} frames  stance frames from the session's `stance` / `stand` event
 * @param {PopupRun | null} run  null in stand mode: the pop-up criteria can't be measured
 * @param {Calibration} calib
 * @returns {StanceMeasurement}
 */
export function measureStance(frames, run, calib) {
  const measured = frames.map((frame) => ({ frame, s: extractStanceFeatures(frame, calib) }));

  /** @type {Record<string, number | boolean | null>} */
  const values = { popupGaze: run?.maxGazePitch ?? null, kneeDown: run?.kneeDown ?? null };
  for (const [key, needs] of Object.entries(NEEDS)) {
    const usable = measured.filter(({ frame }) => visible(frame, needs));
    const raw = usable.map(({ s }) => featureValue(s, key)).filter((v) => v !== null);
    if (raw.length < EVALUATION.minVisibleShare * frames.length) {
      values[key] = null;
    } else if (typeof raw[0] === 'boolean') {
      values[key] = raw.filter(Boolean).length * 2 >= raw.length;
    } else {
      values[key] = median(/** @type {number[]} */ (raw));
    }
  }

  const feet = measured.filter(({ s }) => s.footVisibility >= EVALUATION.minFootVisibility).map(({ s }) => s.frontFoot);
  const leftShare = feet.length ? feet.filter((f) => f === 'left').length / feet.length : 0;
  const share = Math.max(leftShare, 1 - leftShare);
  const decided = feet.length >= 3 && share >= EVALUATION.minStanceShare;
  return {
    values,
    stance: { side: decided ? (leftShare > 0.5 ? 'regular' : 'goofy') : null, confidence: feet.length ? share : 0 },
  };
}

/**
 * Scores a measurement against the active profile (starting values or reference clips).
 * @param {StanceMeasurement} measurement
 * @param {Profile} profile
 * @returns {StanceEvaluation}
 */
export function evaluateStance(measurement, profile) {
  /** @type {CriterionResult[]} */
  const criteria = Object.entries(STANCE_CRITERIA).map(([key, c]) => {
    const value = measurement.values[key] ?? null;
    const base = { key, label: c.label, value, unit: c.kind === 'range' ? c.unit : '' };
    if (value === null) return { ...base, target: null, score: null, status: 'na', tip: null };

    if (c.kind === 'flag') {
      const ok = value === c.good;
      return { ...base, target: null, score: ok ? 100 : 0, status: ok ? 'good' : 'bad', tip: ok ? null : c.tip };
    }

    const [lo, hi] = profile.targets[key] ?? c.target;
    const v = /** @type {number} */ (value);
    const off = v < lo ? lo - v : v > hi ? v - hi : 0;
    const score = Math.max(0, 100 * (1 - off / c.falloff));
    const tip = off === 0 ? null : (v < lo ? c.tips.low : c.tips.high) ?? null;
    /** @type {CriterionResult['status']} */
    const status = off === 0 ? 'good' : score >= 50 ? 'warn' : 'bad';
    return { ...base, target: [lo, hi], score, status, tip };
  });

  const weight = (/** @type {CriterionResult} */ r) => STANCE_CRITERIA[r.key].weight;
  const rated = criteria.filter((r) => r.score !== null);
  const totalWeight = rated.reduce((sum, r) => sum + weight(r), 0);
  const score = totalWeight
    ? rated.reduce((sum, r) => sum + weight(r) * /** @type {number} */ (r.score), 0) / totalWeight
    : 0;

  const tips = rated
    .filter((r) => r.tip)
    .sort((a, b) => weight(b) * (100 - /** @type {number} */ (b.score)) - weight(a) * (100 - /** @type {number} */ (a.score)))
    .slice(0, 3)
    .map((r) => /** @type {string} */ (r.tip));

  return { score: Math.round(score), stance: measurement.stance, criteria, tips, basis: profile.basis };
}
