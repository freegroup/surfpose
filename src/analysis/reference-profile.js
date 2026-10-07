import { EVALUATION, STANCE_CRITERIA } from '../config.js';
import { median } from './geometry.js';

/** @typedef {typeof STANCE_CRITERIA} Criteria */

/**
 * The complete criteria the evaluation scores with, and where they come from.
 * @typedef {object} Profile
 * @property {Criteria} criteria
 * @property {{ kind: 'default' | 'references' | 'developer', count: number }} basis
 */

/** @type {Profile} */
export const DEFAULT_PROFILE = { criteria: STANCE_CRITERIA, basis: { kind: 'default', count: 0 } };

/**
 * Moves each criterion's reference value to the median of the 🎯 reference clips, kept inside
 * its referenceLimits so a reference can't turn a fault into the standard. The perfect and ok
 * ranges around it stay as configured – references shift the target, they never tighten it.
 * @param {Record<string, number | boolean | null>[]} references  `values` of StanceMeasurements
 * @returns {Profile}
 */
export function buildProfile(references) {
  if (references.length < EVALUATION.minReferences) {
    return { criteria: STANCE_CRITERIA, basis: { kind: 'default', count: references.length } };
  }

  /** @type {Criteria} */
  const criteria = { ...STANCE_CRITERIA };
  for (const [key, c] of Object.entries(STANCE_CRITERIA)) {
    if (c.kind !== 'range') continue;
    const values = references.map((r) => r[key]).filter((v) => typeof v === 'number');
    if (values.length < EVALUATION.minReferences) continue;
    const [min, max] = c.referenceLimits;
    criteria[key] = { ...c, reference: Math.min(max, Math.max(min, median(values))) };
  }
  return { criteria, basis: { kind: 'references', count: references.length } };
}

/**
 * Personal model from the developer page: a complete criteria object that replaces the
 * config and the 🎯 clips. Keys it lacks (added to the config later) keep the config values.
 * @param {Criteria} criteria
 * @returns {Profile}
 */
export function developerProfile(criteria) {
  return { criteria: { ...STANCE_CRITERIA, ...criteria }, basis: { kind: 'developer', count: 0 } };
}
