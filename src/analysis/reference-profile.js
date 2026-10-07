import { EVALUATION, STANCE_CRITERIA } from '../config.js';
import { median } from './geometry.js';

/**
 * Target ranges the evaluation compares against. Empty targets = starting values from config.
 * @typedef {object} Profile
 * @property {Record<string, [number, number]>} targets
 * @property {{ kind: 'default' | 'references', count: number }} basis
 */

/** @type {Profile} */
export const DEFAULT_PROFILE = { targets: {}, basis: { kind: 'default', count: 0 } };

/** Robust spread (median absolute deviation, scaled like a standard deviation). @param {number[]} values */
const spread = (values) => {
  const m = median(values);
  return 1.4826 * median(values.map((v) => Math.abs(v - m)));
};

/**
 * Builds target ranges from the measurements of 🎯 reference clips: median ± 2 robust
 * spreads, outliers dropped, never narrower than minHalfWidth and always inside the guard
 * rails – so a reference can't turn a fault into the standard.
 * @param {Record<string, number | boolean | null>[]} references  `values` of StanceMeasurements
 * @returns {Profile}
 */
export function buildProfile(references) {
  if (references.length < EVALUATION.minReferences) {
    return { targets: {}, basis: { kind: 'default', count: references.length } };
  }

  /** @type {Record<string, [number, number]>} */
  const targets = {};
  for (const [key, c] of Object.entries(STANCE_CRITERIA)) {
    if (c.kind !== 'range') continue;
    let values = references.map((r) => r[key]).filter((v) => typeof v === 'number');
    if (values.length < EVALUATION.minReferences) continue;

    const s = spread(values);
    if (s > 0) values = values.filter((v) => Math.abs(v - median(values)) <= 3 * s);

    const m = median(values);
    const half = Math.max(2 * spread(values), c.minHalfWidth);
    const width = 2 * c.minHalfWidth;
    const [min, max] = c.limits;
    let lo = Math.max(m - half, min);
    let hi = Math.min(m + half, max);
    // A reference near a guard rail gets clipped there; widen on the other side so the range
    // stays usable. Widen from the side that was actually clipped – deciding by `hi === max`
    // misfired on float rounding (0.2999… < 0.3) and produced inverted ranges like 1.51–1.3.
    if (hi - lo < width) {
      if (m - half < min) hi = Math.min(max, lo + width);
      else lo = Math.max(min, hi - width);
    }
    targets[key] = [lo, hi];
  }
  return { targets, basis: { kind: 'references', count: references.length } };
}
