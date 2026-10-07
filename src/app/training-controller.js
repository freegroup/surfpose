import { bodyInView } from '../analysis/features.js';
import { FRAMING, STAND_MODE } from '../config.js';
import { DEFAULT_PROFILE } from '../analysis/reference-profile.js';
import { evaluateStance, measureStance } from '../analysis/stance-evaluator.js';
import { initCameraView } from '../components/camera-view/camera-view.js';
import { initCelebration } from '../components/celebration/celebration.js';
import { initResultCard } from '../components/result-card/result-card.js';
import { initSetupHints } from '../components/setup-hints/setup-hints.js';
import { initTimer } from '../components/timer/timer.js';
import { createEngineClient } from '../engine/engine-client.js';
import { createRecorder } from '../recording/recorder.js';
import { createSkeletonRenderer } from '../render/skeleton-renderer.js';
import { openCamera } from './camera.js';
import { createClipsController } from './clips-controller.js';
import { createDevMetrics } from './dev-metrics.js';
import { startFrameLoop } from './frame-loop.js';
import { initPageChrome } from './page-chrome.js';

/** @typedef {import('../engine/engine.js').EngineResult} EngineResult */
/** @typedef {import('../components/timer/timer.js').TimerState} TimerState */

const HINTS = {
  nobody: 'Stell dich so hin, dass die Kamera dich ganz sieht.',
  partial: 'Ganzer Körper ins Bild – auch die Füße.',
  waiting: 'Leg dich seitlich zur Kamera in die Paddelposition.',
  ready: 'Bereit – spring auf, wann du willst!',
  running: 'Los, los, los!',
  done: 'Leg dich wieder hin für den nächsten Pop-up.',
  aborted: 'Abgebrochen – nochmal, wenn du bereit bist.',
  timeout: 'Zeit abgelaufen. Leg dich wieder hin.',
};

/** @param {string} selector */
const $ = (selector) => /** @type {HTMLElement} */ (document.querySelector(selector));

/** Wires the training page: camera, engine and the live components. Starts on load. */
export function initTrainingController() {
  initPageChrome();

  const cameraView = initCameraView($('.camera-view'));
  const timer = initTimer($('.timer'));
  const resultCard = initResultCard($('.result-card'));
  const setupHints = initSetupHints($('.setup-hints'));
  const celebration = initCelebration($('.celebration'));
  const skeleton = createSkeletonRenderer(cameraView.canvas);

  /** @type {import('../analysis/reference-profile.js').Profile} */
  let profile = DEFAULT_PROFILE;
  const clips = createClipsController();
  clips.loadProfile().then((p) => { profile = p; }, (error) => console.error('Loading references failed', error));
  /** @type {'good' | 'bad' | 'none'} */
  let framing = 'none';
  /** @type {{ value: 'good' | 'bad', since: number } | null} */
  let framingCandidate = null;

  const engine = createEngineClient(onResult);
  /** @type {Promise<import('../engine/engine-client.js').EngineInfo> | null} */
  let engineReady = null;
  /** @type {ReturnType<typeof createDevMetrics> | null} */
  let metrics = null;
  /** @type {ReturnType<typeof createRecorder> | null} */
  let recorder = null;
  if (import.meta.env.DEV) {
    recorder = createRecorder();
    Object.assign(window, { okRecord: recorder });
  }
  /** @type {(() => void) | null} */
  let stopLoop = null;
  let grabbing = false;

  let reps = 0;
  let lastSeconds = 0;
  /** @type {keyof typeof HINTS | null} */
  let lastOutcome = null;

  // Leaving the training happens through the site header (logo → home, nav → Clips/Stance),
  // which navigates away and tears the page down. Flush any clip still being recorded first.
  window.addEventListener('pagehide', () => { clips.flush(); });

  start();

  async function start() {
    cameraView.render({ visible: true, status: 'Kamera wird gestartet …' });

    try {
      await openCamera(cameraView.video);
    } catch (error) {
      console.error('Camera failed', error);
      cameraView.render({ visible: true, status: cameraErrorText(error) });
      return;
    }

    cameraView.render({ visible: true, status: 'Erkennung wird geladen …' });
    engineReady ??= engine.init();
    const [info, canRecord] = await Promise.all([engineReady, clips.start(cameraView.video)]);
    if (import.meta.env.DEV) metrics = createDevMetrics(`${info.mode}/${info.delegate}, clips: ${canRecord}`);

    framing = 'none';
    framingCandidate = null;
    cameraView.render({ visible: true, framing });
    timer.render({ seconds: lastSeconds, state: 'waiting', hint: HINTS.waiting, reps });
    stopLoop = startFrameLoop(cameraView.video, grabFrame);
  }

  /** @param {number} t */
  function grabFrame(t) {
    clips.addFrame(cameraView.video, t); // every frame goes into the clip
    if (grabbing || engine.isBusy()) return; // drop frames instead of queueing
    grabbing = true;
    createImageBitmap(cameraView.video).then((image) => {
      grabbing = false;
      engine.submit(image, t);
    });
  }

  /** @param {EngineResult} result */
  function onResult(result) {
    if (!stopLoop) return; // a late result after stopping
    skeleton.draw(result.frame, { mirror: true });
    updateFraming(result);
    metrics?.record(result.inferenceMs);
    recorder?.add(result.frame);
    clips.addPose(result.frame);

    for (const event of result.events) {
      if (event.type === 'start') {
        lastOutcome = null;
        resultCard.render({ visible: false });
        celebration.hide();
        clips.popupStarted();
      }
      if (event.type === 'abort') lastOutcome = 'aborted';
      if (event.type === 'timeout') lastOutcome = 'timeout';
      if (event.type === 'done') finishPopup(event.run);
      if (event.type === 'stance') showEvaluation(event);
      if (event.type === 'stand') celebrateStand(event);
    }
    renderTimer(result);
    // The setup hints help with positioning – once the whole body is in view (green frame)
    // they've done their job and would only cover the result card, so they go away.
    setupHints.render({ visible: result.state === 'IDLE' && reps === 0 && framing !== 'good' });
  }

  /**
   * Stand mode runs alongside the pop-up timing: whenever a good surf stance is held
   * (whether after a pop-up or just standing there), it gets a "Yeah!".
   * @param {import('../analysis/stand-session.js').StandEvent} event
   */
  function celebrateStand({ frames, calib }) {
    const evaluation = evaluateStance(measureStance(frames, null, calib), profile);
    if (evaluation.score >= STAND_MODE.yeahScore) celebration.show({ message: 'Yeah!' });
  }

  /** @param {import('../analysis/popup-session.js').PopupRun} run */
  function finishPopup(run) {
    lastSeconds = (/** @type {number} */ (run.endT) - run.startT) / 1000;
    lastOutcome = 'done';
    reps++;
    clips.popupDone(/** @type {number} */ (run.endT), lastSeconds);
  }

  /** @param {Extract<import('../analysis/popup-session.js').SessionEvent, { type: 'stance' }>} event */
  function showEvaluation({ frames, run, calib }) {
    const measurement = measureStance(frames, run, calib);
    const evaluation = evaluateStance(measurement, profile);
    resultCard.render({ visible: true, popupSeconds: lastSeconds, evaluation });
    clips.evaluated(measurement, evaluation);
  }

  /**
   * Green frame when the person is well in the picture, red otherwise (see bodyInView).
   * Changes only after holding for FRAMING.holdMs, so single dropped frames don't make it flicker.
   * @param {EngineResult} result
   */
  function updateFraming({ frame, t }) {
    const value = bodyInView(frame) ? 'good' : 'bad';
    if (framingCandidate?.value !== value) framingCandidate = { value, since: t };
    if (value !== framing && t - framingCandidate.since >= FRAMING.holdMs) {
      framing = value;
      cameraView.render({ visible: true, framing });
    }
  }

  /** @param {EngineResult} result */
  function renderTimer({ state, run, t, frame }) {
    if (state === 'RUNNING' && run) {
      timer.render({ seconds: (t - run.startT) / 1000, state: 'running', hint: HINTS.running, reps });
      return;
    }
    if (state === 'READY') {
      const hint = lastOutcome === 'aborted' ? HINTS.aborted : HINTS.ready;
      timer.render({ seconds: 0, state: 'ready', hint, reps });
      return;
    }
    /** @type {TimerState} */
    const shown = state === 'DONE' ? 'done' : state === 'TIMEOUT' ? 'timeout' : 'waiting';
    const hint = !frame ? HINTS.nobody : framing === 'bad' ? HINTS.partial : HINTS[lastOutcome ?? 'waiting'];
    timer.render({ seconds: state === 'TIMEOUT' ? 20 : lastSeconds, state: shown, hint, reps });
  }
}

/** @param {unknown} error */
function cameraErrorText(error) {
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return 'Kein Kamera-Zugriff. Bitte erlaube die Kamera in deinem Browser und versuche es erneut.';
  }
  return 'Keine Kamera gefunden.';
}
