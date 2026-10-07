// Turns a criteria object back into the STANCE_CRITERIA source block of src/config.js,
// so a model tuned on developer.html can be pasted over the config as is.

/** @typedef {import('../analysis/reference-profile.js').Criteria} Criteria */

/** @param {string} s */
const quote = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
/** @param {number} v */
const num = (v) => String(Math.round(v * 1000) / 1000);

/**
 * @param {Criteria} criteria
 * @returns {string}
 */
export function stanceCriteriaSource(criteria) {
  const lines = [
    '/** @type {Record<string, RangeCriterion | FlagCriterion>} */',
    '// Weights: bent knees and stance width are the core of a surf stance.',
    'export const STANCE_CRITERIA = {',
  ];
  for (const [key, c] of Object.entries(criteria)) {
    lines.push(`  ${key}: {`);
    if (c.kind === 'range') {
      lines.push(`    kind: 'range', label: ${quote(c.label)}, unit: ${quote(c.unit)},`);
      lines.push(`    reference: ${num(c.reference)}, perfectRange: ${num(c.perfectRange)}, inRange: ${num(c.inRange)}, `
        + `referenceLimits: [${c.referenceLimits.map(num).join(', ')}], weight: ${num(c.weight)},`);
      const tips = Object.entries(c.tips).map(([side, tip]) => `${side}: ${quote(/** @type {string} */ (tip))}`);
      lines.push(`    tips: { ${tips.join(', ')} },`);
    } else {
      lines.push(`    kind: 'flag', label: ${quote(c.label)}, good: ${c.good}, weight: ${num(c.weight)},`);
      lines.push(`    tip: ${quote(c.tip)},`);
    }
    lines.push('  },');
  }
  lines.push('};');
  return `${lines.join('\n')}\n`;
}
