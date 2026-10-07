/** @typedef {import('../../analysis/stance-evaluator.js').StanceEvaluation} StanceEvaluation */
/** @typedef {import('../../analysis/stance-evaluator.js').CriterionResult} CriterionResult */

const seconds = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const oneDecimal = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const STANCE_TEXT = { regular: 'Regular', goofy: 'Goofy' };

/** @param {number} v @param {string} unit */
function formatValue(v, unit) {
  if (unit.startsWith('°')) return `${Math.round(v)}°`;
  if (unit.startsWith('×')) return `${oneDecimal.format(v)}×`;
  return `${Math.round(v * 100)} %`; // position between the feet
}

/** @param {CriterionResult} c */
function describe(c) {
  if (c.value === null) return 'nicht messbar';
  if (typeof c.value === 'boolean') return c.status === 'good' ? 'ja' : 'nein';
  const value = formatValue(c.value, c.unit);
  if (!c.target) return value;
  return `${value} (Ziel ${formatValue(c.target.reference, c.unit)} ± ${formatValue(c.target.perfectRange, c.unit)})`;
}

/**
 * Result of the last pop-up: time, stance, score, top tips, all criteria.
 * @param {HTMLElement} root
 */
export function initResultCard(root) {
  const time = /** @type {HTMLElement} */ (root.querySelector('.result-card__time'));
  const stance = /** @type {HTMLElement} */ (root.querySelector('.result-card__stance'));
  const score = /** @type {HTMLElement} */ (root.querySelector('.result-card__score-value'));
  const tips = /** @type {HTMLElement} */ (root.querySelector('.result-card__tips'));
  const criteria = /** @type {HTMLElement} */ (root.querySelector('.result-card__criteria'));
  const basis = /** @type {HTMLElement} */ (root.querySelector('.result-card__basis'));
  const rowTemplate = /** @type {HTMLTemplateElement} */ (root.querySelector('.result-card__row-template'));

  return {
    /** @param {{ visible: boolean, popupSeconds?: number, evaluation?: StanceEvaluation }} state */
    render({ visible, popupSeconds = 0, evaluation }) {
      root.hidden = !visible || !evaluation;
      if (!evaluation) return;

      time.textContent = `${seconds.format(popupSeconds)} s`;
      const side = evaluation.stance.side;
      stance.textContent = side ? STANCE_TEXT[side] : 'Stance unsicher';
      score.textContent = String(evaluation.score);
      root.dataset.grade = evaluation.score >= 85 ? 'good' : evaluation.score >= 60 ? 'ok' : 'weak';

      tips.replaceChildren(...(evaluation.tips.length ? evaluation.tips : ['Sauberer Stand – weiter so!']).map((tip) => {
        const li = document.createElement('li');
        li.textContent = tip;
        return li;
      }));

      criteria.replaceChildren(...evaluation.criteria.map((c) => {
        const row = /** @type {HTMLElement} */ (/** @type {DocumentFragment} */ (rowTemplate.content.cloneNode(true)).firstElementChild);
        row.dataset.status = c.status;
        /** @type {HTMLElement} */ (row.querySelector('.result-card__criterion-label')).textContent = c.label;
        /** @type {HTMLElement} */ (row.querySelector('.result-card__criterion-value')).textContent = describe(c);
        return row;
      }));

      basis.textContent = evaluation.basis.kind === 'references'
        ? `Verglichen mit deinen ${evaluation.basis.count} Referenz-Clips`
        : 'Bewertet mit den Startwerten';
    },
  };
}
