import { EVALUATION, STANCE_CRITERIA } from '../config.js';
import { median } from './geometry.js';

/**
 * Reference values the evaluation measures around. Empty = starting values from config.
 * @typedef {object} Profile
 * @property {Record<string, number>} references
 * @property {{ kind: 'default' | 'references', count: number }} basis
 */

/** @type {Profile} */
export const DEFAULT_PROFILE = { references: {}, basis: { kind: 'default', count: 0 } };

/**
 * Moves each criterion's reference value to the median of the 🎯 reference clips, kept inside
 * its referenceLimits so a reference can't turn a fault into the standard. The perfect and ok
 * ranges around it stay as configured – references shift the target, they never tighten it.
 * @param {Record<string, number | boolean | null>[]} references  `values` of StanceMeasurements
 * @returns {Profile}
 */
export function buildProfile(references) {
  if (references.length < EVALUATION.minReferences) {
    return { references: {}, basis: { kind: 'default', count: references.length } };
  }

  /** @type {Record<string, number>} */
  const moved = {};
  for (const [key, c] of Object.entries(STANCE_CRITERIA)) {
    if (c.kind !== 'range') continue;
    const values = references.map((r) => r[key]).filter((v) => typeof v === 'number');
    if (values.length < EVALUATION.minReferences) continue;
    const [min, max] = c.referenceLimits;
    moved[key] = Math.min(max, Math.max(min, median(values)));
  }
  return { references: moved, basis: { kind: 'references', count: references.length } };
}
