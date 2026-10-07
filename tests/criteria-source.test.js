import { describe, expect, it } from 'vitest';
import { STANCE_CRITERIA } from '../src/config.js';
import { stanceCriteriaSource } from '../src/app/criteria-source.js';

/** Evaluates the generated block the way it would run once pasted into config.js. */
const run = (/** @type {string} */ source) =>
  new Function(source.replace('export const STANCE_CRITERIA =', 'return'))();

describe('STANCE_CRITERIA source for the clipboard', () => {
  it('reproduces the config exactly', () => {
    expect(run(stanceCriteriaSource(STANCE_CRITERIA))).toEqual(STANCE_CRITERIA);
  });

  it('carries changed values from the developer page', () => {
    const knee = /** @type {import('../src/config.js').RangeCriterion} */ (STANCE_CRITERIA.frontKnee);
    const tuned = { ...STANCE_CRITERIA, frontKnee: { ...knee, reference: 124 } };
    expect(run(stanceCriteriaSource(tuned)).frontKnee.reference).toBe(124);
  });

  it('starts with the same header lines as the config block', () => {
    expect(stanceCriteriaSource(STANCE_CRITERIA).split('\n').slice(0, 3)).toEqual([
      '/** @type {Record<string, RangeCriterion | FlagCriterion>} */',
      '// Weights: bent knees and stance width are the core of a surf stance.',
      'export const STANCE_CRITERIA = {',
    ]);
  });
});
