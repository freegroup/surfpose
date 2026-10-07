/**
 * @typedef {object} DevRow
 * @property {string} key        JSON key in STANCE_CRITERIA
 * @property {string} label
 * @property {string} current    measured value, formatted
 * @property {string} reference  target value, formatted
 * @property {string} range      "± perfect / ± ok"
 * @property {'good' | 'warn' | 'bad' | 'na'} status
 * @property {boolean} own       reference differs from config.js
 */

/**
 * Developer page: toolbar and the live criteria table. Emits `dev:copy`, `dev:save`,
 * `dev:clear` and `dev:take` (`{ key }`) when a row is tapped.
 * @param {HTMLElement} root
 */
export function initDevPanel(root) {
  const $ = (/** @type {string} */ s) => /** @type {HTMLElement} */ (root.querySelector(s));
  const body = $('.dev-panel__rows');
  const model = $('.dev-panel__model');
  const status = $('.dev-panel__status');
  const template = /** @type {HTMLTemplateElement} */ ($('.dev-panel__row-template'));

  /** @param {string} type @param {object} [detail] */
  const emit = (type, detail) => root.dispatchEvent(new CustomEvent(type, { detail, bubbles: true }));
  $('.dev-panel__copy').addEventListener('click', () => emit('dev:copy'));
  $('.dev-panel__save').addEventListener('click', () => emit('dev:save'));
  $('.dev-panel__clear').addEventListener('click', () => emit('dev:clear'));
  body.addEventListener('click', (event) => {
    const row = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (event.target).closest('[data-key]'));
    if (row) emit('dev:take', { key: row.dataset.key });
  });

  /** @param {DevRow} r */
  function row(r) {
    const tr = /** @type {HTMLElement} */ (/** @type {DocumentFragment} */ (template.content.cloneNode(true)).firstElementChild);
    const cell = (/** @type {string} */ s) => /** @type {HTMLElement} */ (tr.querySelector(s));
    tr.dataset.key = r.key;
    tr.dataset.status = r.status;
    tr.toggleAttribute('data-own', r.own);
    cell('.dev-panel__json').textContent = r.key;
    cell('.dev-panel__label').textContent = r.label;
    cell('.dev-panel__current').textContent = r.current;
    cell('.dev-panel__reference').textContent = r.reference;
    cell('.dev-panel__range').textContent = r.range;
    return tr;
  }

  return {
    /** @param {{ rows: DevRow[], model: string, status: string }} state */
    render({ rows, model: modelText, status: statusText }) {
      body.replaceChildren(...rows.map(row));
      model.textContent = modelText;
      status.textContent = statusText;
      status.hidden = !statusText;
    },
  };
}
