/**
 * @typedef {object} PlayerClip
 * @property {string} id
 * @property {string} url          object URL of the MP4
 * @property {number} standOffset  seconds
 * @property {boolean} cool
 * @property {boolean} reference
 * @property {boolean} canReference  the stance in this clip was measurable
 */

const SPEEDS = [0.25, 0.5, 1];

/**
 * Replay of one clip (skeleton, logo and result are burned into the video). Speed and jumping
 * are handled here; everything that touches data is an event:
 * clip:share / clip:toggle-cool / clip:toggle-reference / clip:delete (`{ id }`), player:close.
 * @param {HTMLElement} root
 */
export function initClipPlayer(root) {
  const $ = (/** @type {string} */ s) => /** @type {HTMLElement} */ (root.querySelector(s));
  const video = /** @type {HTMLVideoElement} */ ($('.clip-player__video'));
  const cool = $('.clip-player__cool');
  const reference = $('.clip-player__reference');
  const remove = $('.clip-player__delete');
  const note = $('.clip-player__note');
  const critique = $('.clip-player__critique');
  const tips = $('.clip-player__tips');
  const speedButtons = /** @type {HTMLButtonElement[]} */ ([...root.querySelectorAll('.clip-player__speed')]);

  /** @type {PlayerClip | null} */
  let clip = null;
  let deleteArmed = false;

  /** @param {string} type @param {object} [detail] */
  const emit = (type, detail) => root.dispatchEvent(new CustomEvent(type, { detail, bubbles: true }));

  /** @param {number} speed */
  function setSpeed(speed) {
    video.playbackRate = speed;
    speedButtons.forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.speed) === speed)));
  }

  speedButtons.forEach((b) => b.addEventListener('click', () => setSpeed(Number(b.dataset.speed))));
  $('.clip-player__jump').addEventListener('click', () => {
    if (!clip) return;
    video.currentTime = Math.max(0, clip.standOffset - 1.5);
    video.play();
  });
  $('.clip-player__share').addEventListener('click', () => clip && emit('clip:share', { id: clip.id }));
  cool.addEventListener('click', () => clip && emit('clip:toggle-cool', { id: clip.id }));
  reference.addEventListener('click', () => clip && emit('clip:toggle-reference', { id: clip.id }));
  remove.addEventListener('click', () => {
    if (!clip) return;
    if (!deleteArmed) {
      deleteArmed = true;
      remove.textContent = 'Wirklich löschen?';
      return;
    }
    emit('clip:delete', { id: clip.id });
  });
  $('.clip-player__close').addEventListener('click', () => emit('player:close'));

  return {
    /** @param {{ visible: boolean, clip?: PlayerClip | null, note?: string, tips?: string[] | null }} state */
    render({ visible, clip: next = null, note: text = '', tips: tipList = null }) {
      root.hidden = !visible;
      if (!visible) {
        video.pause();
        return;
      }
      if (next && next.url !== clip?.url) {
        video.src = next.url;
        const start = Math.max(0, next.standOffset - 3);
        video.addEventListener('loadedmetadata', () => { video.currentTime = start; }, { once: true });
        setSpeed(SPEEDS[SPEEDS.length - 1]);
        deleteArmed = false;
        remove.textContent = 'Löschen';
      }
      clip = next;
      cool.setAttribute('aria-pressed', String(Boolean(clip?.cool)));
      reference.setAttribute('aria-pressed', String(Boolean(clip?.reference)));
      /** @type {HTMLButtonElement} */ (reference).disabled = !clip?.canReference;
      note.textContent = text;
      note.hidden = !text;
      critique.hidden = !tipList;
      if (tipList) {
        tips.replaceChildren(...tipList.map((tip) => {
          const li = document.createElement('li');
          li.textContent = tip;
          return li;
        }));
      }
    },
  };
}
