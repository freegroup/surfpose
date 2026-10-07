import { deleteClip, listClips, updateClip } from '../clips/clip-store.js';
import { shareClip } from '../clips/share.js';
import { buildProfile } from '../analysis/reference-profile.js';
import { evaluateStance } from '../analysis/stance-evaluator.js';
import { initClipGallery } from '../components/clip-gallery/clip-gallery.js';
import { initClipPlayer } from '../components/clip-player/clip-player.js';
import { initPageChrome } from './page-chrome.js';

/** @typedef {import('../clips/clip-store.js').Clip} Clip */

const seconds = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** A stance is good enough to be a 🎯 reference when the core criteria were measurable. */
const canReference = (/** @type {Clip} */ clip) =>
  ['frontKnee', 'backKnee', 'stanceWidth'].every((k) => typeof clip.measurement?.values[k] === 'number');

/** @param {string} selector */
const $ = (selector) => /** @type {HTMLElement} */ (document.querySelector(selector));

/** Wires the clips page: gallery, player, 🤙/🎯 marks, sharing and deleting. */
export function initClipsPage() {
  initPageChrome();

  const gallery = initClipGallery($('.clip-gallery'));
  const player = initClipPlayer($('.clip-player'));

  /** @type {Clip[]} */
  let clips = [];
  /** The same reference profile the live app uses, rebuilt from the 🎯 clips on this device. */
  let profile = buildProfile([]);
  /** @type {Map<string, string>} object URLs per `${id}:${kind}` */
  const urls = new Map();
  /** @type {Clip | null} */
  let open = null;
  let status = '';

  refresh();

  document.addEventListener('clip:open', (e) => {
    open = clips.find((c) => c.id === /** @type {CustomEvent} */ (e).detail.id) ?? null;
    renderPlayer();
  });
  document.addEventListener('player:close', closePlayer);
  document.addEventListener('clip:toggle-cool', (e) => toggle(/** @type {CustomEvent} */ (e).detail.id, 'cool'));
  document.addEventListener('clip:toggle-reference', (e) => toggle(/** @type {CustomEvent} */ (e).detail.id, 'reference'));
  document.addEventListener('clip:delete', async (e) => {
    await deleteClip(/** @type {CustomEvent} */ (e).detail.id);
    closePlayer();
    await refresh();
  });
  document.addEventListener('clip:share', async (e) => {
    const clip = clips.find((c) => c.id === /** @type {CustomEvent} */ (e).detail.id);
    if (!clip) return;
    try {
      const outcome = await shareClip(clip);
      if (outcome === 'downloaded') renderPlayer('Teilen geht in diesem Browser nicht – der Clip wurde heruntergeladen.');
    } catch (error) {
      console.error('Share failed', error);
      renderPlayer('Teilen hat nicht geklappt.');
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && open) closePlayer();
  });

  async function refresh() {
    try {
      clips = await listClips();
    } catch (error) {
      console.error('Loading clips failed', error);
      status = 'Die Clips konnten nicht geladen werden.';
    }
    profile = buildProfile(clips.filter((c) => c.reference && c.measurement).map((c) => /** @type {NonNullable<typeof c.measurement>} */ (c.measurement).values));
    const best = $('.clip-gallery__best');
    const fastest = clips.reduce((min, c) => Math.min(min, c.popupSeconds), Infinity);
    best.hidden = !Number.isFinite(fastest);
    best.textContent = Number.isFinite(fastest) ? `Beste Zeit: ${seconds.format(fastest)} s` : '';
    for (const [key, objectUrl] of urls) {
      if (!clips.some((c) => key.startsWith(`${c.id}:`))) {
        URL.revokeObjectURL(objectUrl);
        urls.delete(key);
      }
    }
    gallery.render({
      status,
      showInstallHint: !matchMedia('(display-mode: standalone)').matches,
      clips: clips.map((c) => ({
        id: c.id, thumbnailUrl: url(c, 'thumbnail'), popupSeconds: c.popupSeconds,
        stance: c.stance, score: c.score, createdAt: c.createdAt, cool: c.cool, reference: c.reference,
      })),
    });
    if (open) renderPlayer();
  }

  /** @param {Clip} clip @param {'video' | 'thumbnail'} kind */
  function url(clip, kind) {
    const key = `${clip.id}:${kind}`;
    const blob = clip[kind];
    if (!blob) return null;
    if (!urls.has(key)) urls.set(key, URL.createObjectURL(blob));
    return /** @type {string} */ (urls.get(key));
  }

  function renderPlayer(note = '') {
    open = clips.find((c) => c.id === open?.id) ?? null;
    if (!open) return;
    const referenceNote = canReference(open) ? '' : 'Als Referenz nicht möglich – die Stance war in diesem Clip nicht gut genug sichtbar.';
    const evaluation = open.measurement ? evaluateStance(open.measurement, profile) : null;
    const tips = evaluation ? (evaluation.tips.length ? evaluation.tips : ['Sauberer Stand – weiter so!']) : null;
    player.render({
      visible: true,
      note: note || referenceNote,
      tips,
      clip: {
        id: open.id, url: /** @type {string} */ (url(open, 'video')), standOffset: open.standOffset,
        cool: open.cool, reference: open.reference, canReference: canReference(open),
      },
    });
  }

  function closePlayer() {
    open = null;
    player.render({ visible: false });
  }

  /** @param {string} id @param {'cool' | 'reference'} mark */
  async function toggle(id, mark) {
    const clip = clips.find((c) => c.id === id);
    if (!clip) return;
    await updateClip(id, { [mark]: !clip[mark] });
    await refresh();
  }
}
