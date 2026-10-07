// developer.html – tune the stance model live. Measures standing (calibration from the gaze,
// like stand mode), colors every joint by its criteria and lets you take a measured value
// as the new reference. The model can be copied as config source or kept in localStorage.
import { calibrateStanding } from '../analysis/board-axis.js';
import { extractStanceFeatures } from '../analysis/features.js';
import { developerProfile } from '../analysis/reference-profile.js';
import { evaluateStance, measureStance } from '../analysis/stance-evaluator.js';
import { initCameraView } from '../components/camera-view/camera-view.js';
import { initDevPanel } from '../components/dev-panel/dev-panel.js';
import { MIN_VISIBILITY, STANCE_CRITERIA, STAND_MODE } from '../config.js';
import { createEngineClient } from '../engine/engine-client.js';
import { headCenter, LM } from '../pose/landmarks.js';
import { canvasMapper } from '../render/draw-skeleton.js';
import { createSkeletonRenderer } from '../render/skeleton-renderer.js';
import { openCamera } from './camera.js';
import { stanceCriteriaSource } from './criteria-source.js';
import { clearDevCriteria, loadDevCriteria, saveDevCriteria } from './dev-references.js';
import { startFrameLoop } from './frame-loop.js';
import { initPageChrome } from './page-chrome.js';

/** @typedef {import('../analysis/reference-profile.js').Criteria} Criteria */
/** @typedef {import('../analysis/stance-evaluator.js').StanceEvaluation} StanceEvaluation */
/** @typedef {import('../pose/types.js').PoseFrame} PoseFrame */
/** @typedef {import('../components/dev-panel/dev-panel.js').DevRow} DevRow */
/** @typedef {DevRow['status']} Status */

/** Laptop/desktop only – keep in sync with the media query in dev-panel.css. */
const LAPTOP = '(min-width: 900px) and (pointer: fine)';

const RANK = { na: 0, good: 1, warn: 2, bad: 3 };

/** Degrees with one decimal, ratios with two – the precision the config uses. */
const precise = (/** @type {number} */ v, /** @type {string} */ unit) =>
  (unit.startsWith('°') ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100);
const show = (/** @type {number} */ v, /** @type {string} */ unit) =>
  (unit.startsWith('°') ? `${v.toFixed(1)}°` : unit.startsWith('×') ? `${v.toFixed(2)}×` : v.toFixed(2));

/**
 * Which joints belong to which criteria. The knees depend on which foot is in front.
 * @param {'left' | 'right' | null} frontFoot
 * @returns {{ joints: (number | 'head')[], keys: string[] }[]}
 */
function jointGroups(frontFoot) {
  const knees = frontFoot
    ? [
        { joints: [frontFoot === 'left' ? LM.LEFT_KNEE : LM.RIGHT_KNEE], keys: ['frontKnee'] },
        { joints: [frontFoot === 'left' ? LM.RIGHT_KNEE : LM.LEFT_KNEE], keys: ['backKnee'] },
      ]
    : [{ joints: [LM.LEFT_KNEE, LM.RIGHT_KNEE], keys: ['frontKnee', 'backKnee'] }];
  return [
    ...knees,
    { joints: [LM.LEFT_ANKLE, LM.RIGHT_ANKLE, LM.LEFT_FOOT_INDEX, LM.RIGHT_FOOT_INDEX], keys: ['stanceWidth'] },
    { joints: [LM.LEFT_HIP, LM.RIGHT_HIP], keys: ['hip', 'hipPos'] },
    { joints: [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER], keys: ['torsoLean'] },
    { joints: ['head'], keys: ['gazePitch', 'neckAngle', 'headPos', 'lookingForward'] },
  ];
}

function readStatusColors() {
  const style = getComputedStyle(document.documentElement);
  const get = (/** @type {string} */ name) => style.getPropertyValue(name).trim();
  return { good: get('--color-success'), warn: get('--color-state-running'), bad: get('--color-danger'), na: get('--color-skeleton-point') };
}

/** @param {string} selector */
const $ = (selector) => /** @type {HTMLElement} */ (document.querySelector(selector));

export function initDeveloperController() {
  initPageChrome();
  if (!matchMedia(LAPTOP).matches) return; // mobile: only the notice, no camera, no permission prompt
  const cameraView = initCameraView($('.camera-view'));
  const panel = initDevPanel($('.dev-panel'));
  const skeleton = createSkeletonRenderer(cameraView.canvas);
  let colors = readStatusColors();
  window.addEventListener('themechange', () => { colors = readStatusColors(); });

  /** @type {Criteria | null} */
  let stored = loadDevCriteria();
  /** @type {Criteria} */
  let working = structuredClone({ ...STANCE_CRITERIA, ...(stored ?? {}) });
  /** @type {PoseFrame[]} */
  let buffer = [];
  /** @type {PoseFrame | null} */
  let lastFrame = null;
  /** @type {StanceEvaluation | null} */
  let evaluation = null;
  /** @type {'left' | 'right' | null} */
  let frontFoot = null;
  /** @type {{ view: import('../render/draw-skeleton.js').SkeletonView, radius: number } | null} */
  let lastDraw = null;
  let message = '';
  let lastPanelT = -Infinity;
  let grabbing = false;

  const engine = createEngineClient(onResult);

  /** @param {string} key @returns {Status} */
  const statusOf = (key) => evaluation?.criteria.find((c) => c.key === key)?.status ?? 'na';

  /** @param {number | 'head'} index */
  function jointColor(index) {
    const group = jointGroups(frontFoot).find((g) => g.joints.includes(index));
    if (!group) return colors.na;
    const worst = group.keys.map(statusOf).reduce((a, b) => (RANK[b] > RANK[a] ? b : a), /** @type {Status} */ ('na'));
    return colors[worst];
  }

  /** @param {import('../engine/engine.js').EngineResult} result */
  function onResult({ frame, t }) {
    lastFrame = frame;
    if (frame) buffer.push(frame);
    buffer = buffer.filter((f) => t - f.t <= STAND_MODE.bufferMs);
    const calib = frame && buffer.length >= 5 ? calibrateStanding(buffer) : null;
    evaluation = calib ? evaluateStance(measureStance(buffer, null, calib), developerProfile(working)) : null;
    frontFoot = calib && frame ? extractStanceFeatures(frame, calib).frontFoot : null;
    lastDraw = skeleton.drawStatus(frame, { mirror: true, objectFit: 'contain' }, jointColor);
    if (t - lastPanelT > 100) {
      lastPanelT = t;
      renderPanel();
    }
  }

  /** Takes the current measured values of these criteria as their new reference. @param {string[]} keys */
  function take(keys) {
    const taken = [];
    for (const key of keys) {
      const c = working[key];
      const value = evaluation?.criteria.find((r) => r.key === key)?.value;
      if (c?.kind !== 'range' || typeof value !== 'number') continue;
      const reference = precise(value, c.unit);
      const [lo, hi] = c.referenceLimits;
      // the guard rails for 🎯 clips must include the new reference
      working[key] = { ...c, reference, referenceLimits: [Math.min(lo, reference), Math.max(hi, reference)] };
      taken.push(`${key} → ${show(reference, c.unit)}`);
    }
    message = taken.length
      ? `Übernommen: ${taken.join(', ')} – noch nicht gespeichert.`
      : 'Hier gibt es gerade keinen messbaren Wert.';
    renderPanel();
  }

  function renderPanel() {
    const results = new Map((evaluation?.criteria ?? []).map((r) => [r.key, r]));
    /** @type {DevRow[]} */
    const rows = Object.entries(working).map(([key, c]) => {
      const r = results.get(key);
      const own = JSON.stringify(c) !== JSON.stringify(STANCE_CRITERIA[key]);
      const status = r?.status ?? 'na';
      if (c.kind === 'flag') {
        const current = typeof r?.value === 'boolean' ? (r.value ? 'ja' : 'nein') : '–';
        const target = !own ? '–' : /** @type {import('../config.js').FlagCriterion} */ (STANCE_CRITERIA[key]).good ? 'ja' : 'nein';
        return { key, label: c.label, target, current, reference: c.good ? 'ja' : 'nein', range: '', status, own };
      }
      return {
        key, label: c.label, status, own,
        // Soll only where your reference differs from it – so every change stands out
        target: own ? show(/** @type {import('../config.js').RangeCriterion} */ (STANCE_CRITERIA[key]).reference, c.unit) : '–',
        current: typeof r?.value === 'number' ? show(r.value, c.unit) : '–',
        reference: show(c.reference, c.unit),
        range: `± ${show(c.perfectRange, c.unit)} / ± ${show(c.inRange, c.unit)}`,
      };
    });
    const active = { ...STANCE_CRITERIA, ...(stored ?? {}) };
    const dirty = JSON.stringify(working) !== JSON.stringify(active);
    const model = `${stored ? 'Persönliches Modell aktiv' : 'Startwerte aus config.js aktiv'}${dirty ? ' · ungespeichert' : ''}`;
    const hint = evaluation ? '' : 'Stell dich seitlich zur Kamera in Surf-Stance, Blick zur Nose.';
    panel.render({ rows, model, status: message || hint });
  }

  cameraView.canvas.addEventListener('pointerdown', (event) => {
    if (!lastDraw || !lastFrame) return;
    const rect = cameraView.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const toCanvas = canvasMapper(lastDraw.view);
    const reach = Math.max(lastDraw.radius * 2, 36);
    /** @type {{ d: number, keys: string[] } | null} */
    let best = null;
    for (const group of jointGroups(frontFoot)) {
      for (const joint of group.joints) {
        const p = joint === 'head' ? headCenter(lastFrame.image) : lastFrame.image[joint];
        if (!p || p.visibility < MIN_VISIBILITY) continue;
        const c = toCanvas(p);
        const d = Math.hypot(c.x - x, c.y - y);
        if (d <= reach && (!best || d < best.d)) best = { d, keys: group.keys };
      }
    }
    if (best) take(best.keys);
  });

  document.addEventListener('dev:take', (e) => take([/** @type {CustomEvent} */ (e).detail.key]));
  document.addEventListener('dev:reset', (e) => {
    const { key } = /** @type {CustomEvent} */ (e).detail;
    working[key] = structuredClone(STANCE_CRITERIA[key]);
    message = `${key} auf Startwert aus config.js zurückgesetzt – noch nicht gespeichert.`;
    renderPanel();
  });
  document.addEventListener('dev:copy', async () => {
    try {
      await navigator.clipboard.writeText(stanceCriteriaSource(working));
      message = 'STANCE_CRITERIA kopiert – in src/config.js einfügen.';
    } catch {
      message = 'Kopieren nicht möglich – der Browser hat den Zugriff auf die Zwischenablage verweigert.';
    }
    renderPanel();
  });
  document.addEventListener('dev:save', () => {
    saveDevCriteria(working);
    stored = structuredClone(working);
    message = 'Als Referenz festgelegt – Training und Clips bewerten jetzt mit deinem Modell.';
    renderPanel();
  });
  document.addEventListener('dev:clear', () => {
    clearDevCriteria();
    stored = null;
    working = structuredClone(STANCE_CRITERIA);
    message = 'Standard hergestellt – es gelten wieder die Startwerte aus config.js.';
    renderPanel();
  });

  renderPanel();
  start();

  async function start() {
    cameraView.render({ visible: true, status: 'Kamera wird gestartet …' });
    try {
      await openCamera(cameraView.video);
    } catch (error) {
      console.error('Camera failed', error);
      cameraView.render({ visible: true, status: 'Keine Kamera verfügbar.' });
      return;
    }
    cameraView.render({ visible: true, status: 'Erkennung wird geladen …' });
    await engine.init();
    cameraView.render({ visible: true });
    startFrameLoop(cameraView.video, (t) => {
      if (grabbing || engine.isBusy()) return;
      grabbing = true;
      createImageBitmap(cameraView.video).then((image) => {
        grabbing = false;
        engine.submit(image, t);
      });
    });
  }
}
