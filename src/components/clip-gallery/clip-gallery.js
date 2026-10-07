const seconds = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const date = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const STANCE_TEXT = { regular: 'Regular', goofy: 'Goofy' };

/**
 * @typedef {object} ClipSummary
 * @property {string} id
 * @property {string | null} thumbnailUrl
 * @property {number} popupSeconds
 * @property {'regular' | 'goofy' | null} stance
 * @property {number | null} score
 * @property {number} createdAt
 * @property {boolean} cool
 * @property {boolean} reference
 */

/**
 * The saved pop-up clips. Emits `clip:open` with `{ id }`.
 * @param {HTMLElement} root
 */
export function initClipGallery(root) {
  const $ = (/** @type {string} */ s) => /** @type {HTMLElement} */ (root.querySelector(s));
  const list = $('.clip-gallery__list');
  const count = $('.clip-gallery__count');
  const status = $('.clip-gallery__status');
  const empty = $('.clip-gallery__empty');
  const installHint = $('.clip-gallery__install');
  const template = /** @type {HTMLTemplateElement} */ ($('.clip-gallery__item-template'));

  list.addEventListener('click', (event) => {
    const item = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (event.target).closest('[data-id]'));
    if (item) root.dispatchEvent(new CustomEvent('clip:open', { detail: { id: item.dataset.id }, bubbles: true }));
  });

  /** @param {ClipSummary} clip */
  function card(clip) {
    const item = /** @type {HTMLElement} */ (/** @type {DocumentFragment} */ (template.content.cloneNode(true)).firstElementChild);
    const part = (/** @type {string} */ s) => /** @type {HTMLElement} */ (item.querySelector(s));
    part('.clip-gallery__open').dataset.id = clip.id;
    part('.clip-gallery__open').setAttribute('aria-label', `Pop-up ${seconds.format(clip.popupSeconds)} Sekunden abspielen`);
    if (clip.thumbnailUrl) /** @type {HTMLImageElement} */ (part('.clip-gallery__thumb')).src = clip.thumbnailUrl;
    part('.clip-gallery__time').textContent = `${seconds.format(clip.popupSeconds)} s`;
    const score = part('.clip-gallery__score');
    score.hidden = clip.score === null;
    score.textContent = `${clip.score}`;
    score.dataset.grade = clip.score === null ? '' : clip.score >= 85 ? 'good' : clip.score >= 60 ? 'ok' : 'weak';
    part('.clip-gallery__meta').textContent = [clip.stance && STANCE_TEXT[clip.stance], date.format(clip.createdAt)]
      .filter(Boolean)
      .join(' · ');
    part('.clip-gallery__marks').textContent = `${clip.cool ? '🤙' : ''}${clip.reference ? '🎯' : ''}`;
    return item;
  }

  return {
    /** @param {{ clips: ClipSummary[], status?: string, showInstallHint?: boolean }} state */
    render({ clips, status: text = '', showInstallHint = false }) {
      const cool = clips.filter((c) => c.cool).length;
      const references = clips.filter((c) => c.reference).length;
      count.textContent = clips.length
        ? [`${clips.length} ${clips.length === 1 ? 'Clip' : 'Clips'}`, cool && `${cool} 🤙`, references && `${references} 🎯`]
          .filter(Boolean)
          .join(' · ')
        : '';
      status.textContent = text;
      status.hidden = !text;
      empty.hidden = clips.length > 0;
      installHint.hidden = !showInstallHint;
      list.replaceChildren(...clips.map(card));
    },
  };
}
