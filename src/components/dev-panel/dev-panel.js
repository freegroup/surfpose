/**
 * @typedef {object} DevRow
 * @property {string} key        JSON key in STANCE_CRITERIA
 * @property {string} label
 * @property {string} personal   your own value (Soll), formatted – '–' when you haven't set one
 * @property {string} current    measured value (Ist), formatted
 * @property {string} reference  fixed value from config.js (Referenz), formatted
 * @property {string} range      "± perfect / ± ok"
 * @property {'good' | 'warn' | 'bad' | 'na'} status
 * @property {boolean} own       a personal value (Soll) is set
 */

/**
 * Developer page: toolbar and the live criteria table. Emits `dev:copy`, `dev:save`,
 * `dev:clear`, `dev:take` (`{ key }`) when a row is tapped and `dev:reset` (`{ key }`)
 * from a row's reset button.
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
    const target = /** @type {HTMLElement} */ (event.target);
    const row = /** @type {HTMLElement | null} */ (target.closest('[data-key]'));
    if (!row) return;
    emit(target.closest('.dev-panel__reset') ? 'dev:reset' : 'dev:take', { key: row.dataset.key });
  });

  // Rows are created once per key and then only updated. The table renders ~10× per second
  // while the camera runs; replacing the rows would swallow clicks whose press and release
  // land on different (replaced) elements.
  /** @type {Map<string, HTMLElement>} */
  const rowsByKey = new Map();

  /** @param {DevRow} r */
  function row(r) {
    let tr = rowsByKey.get(r.key);
    if (!tr) {
      tr = /** @type {HTMLElement} */ (/** @type {DocumentFragment} */ (template.content.cloneNode(true)).firstElementChild);
      tr.dataset.key = r.key;
      rowsByKey.set(r.key, tr);
    }
    const el = tr;
    const set = (/** @type {string} */ s, /** @type {string} */ text) => {
      const cell = /** @type {HTMLElement} */ (el.querySelector(s));
      if (cell.textContent !== text) cell.textContent = text;
    };
    el.dataset.status = r.status;
    el.toggleAttribute('data-own', r.own);
    set('.dev-panel__json', r.key);
    set('.dev-panel__label', r.label);
    set('.dev-panel__personal', r.personal);
    set('.dev-panel__current', r.current);
    set('.dev-panel__reference', r.reference);
    set('.dev-panel__range', r.range);
    /** @type {HTMLElement} */ (el.querySelector('.dev-panel__reset')).hidden = !r.own; // like a slicer: only where a personal value is set
    return el;
  }

  return {
    /** @param {{ rows: DevRow[], model: string, status: string }} state */
    render({ rows, model: modelText, status: statusText }) {
      const trs = rows.map(row);
      const same = trs.length === body.children.length && trs.every((tr, i) => body.children[i] === tr);
      if (!same) body.replaceChildren(...trs);
      model.textContent = modelText;
      status.textContent = statusText;
      status.hidden = !statusText;
    },
  };
}
