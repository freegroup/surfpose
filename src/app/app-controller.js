import { bodyInView } from '../analysis/features.js';
import { FRAMING, STAND_MODE } from '../config.js';
import { DEFAULT_PROFILE } from '../analysis/reference-profile.js';
import { evaluateStance, measureStance } from '../analysis/stance-evaluator.js';
import { initCameraView } from '../components/camera-view/camera-view.js';
import { initCelebration } from '../components/celebration/celebration.js';
import { initResultCard } from '../components/result-card/result-card.js';
import { initSetupHints } from '../components/setup-hints/setup-hints.js';
import { initStartScreen } from '../components/start-screen/start-screen.js';
import { initStats } from '../components/stats/stats.js';
import { initTimer } from '../components/timer/timer.js';
import { createEngineClient } from '../engine/engine-client.js';
import { createRecorder } from '../recording/recorder.js';
import { createSkeletonRenderer } from '../render/skeleton-renderer.js';
import { closeCamera, openCamera } from './camera.js';
import { createClipsController } from './clips-controller.js';
import { createDevMetrics } from './dev-metrics.js';
import { startFrameLoop } from './frame-loop.js';
import { initPageChrome } from './page-chrome.js';

/** @typedef {import('../engine/engine.js').EngineResult} EngineResult */
/** @typedef {import('../components/timer/timer.js').TimerState} TimerState */

const BEST_KEY = 'ok-best-time';

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

/** Wires the components of the main page. The only place that knows all of them. */
export function initAppController() {
  initPageChrome();

  const startScreen = initStartScreen($('.start-screen'));
  const cameraView = initCameraView($('.camera-view'));
  const timer = initTimer($('.timer'));
  const stats = initStats($('.stats'));
  const resultCard = initResultCard($('.result-card'));
  const setupHints = initSetupHints($('.setup-hints'));
  const celebration = initCelebration($('.celebration'));
  const skeleton = createSkeletonRenderer(cameraView.canvas);

  /** @type {import('../analysis/reference-profile.js').Profile} */
  let profile = DEFAULT_PROFILE;
  const clips = createClipsController();
  clips.loadProfile().then((p) => { profile = p; }, (error) => console.error('Loading references failed', error));
  let clipsAvailable = false;
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

  let best = loadBest();
  let reps = 0;
  let lastSeconds = 0;
  /** @type {keyof typeof HINTS | null} */
  let lastOutcome = null;

  showStart();
  stats.render({ best, reps });

  document.addEventListener('app:start', startTraining);
  document.addEventListener('app:stop', stopTraining);
  document.addEventListener('clips:open', async () => {
    await clips.flush(); // don't lose a clip that is still being recorded
    location.href = 'clips.html';
  });
  // "Training" in the site header links here – go straight to the camera
  if (location.hash === '#training') startTraining();

  function showStart() {
    startScreen.render({ visible: true });
    cameraView.render({ visible: false });
  }

  async function startTraining() {
    startScreen.render({ visible: false });
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
    clipsAvailable = canRecord;
    if (import.meta.env.DEV) metrics = createDevMetrics(`${info.mode}/${info.delegate}, clips: ${canRecord}`);

    framing = 'none';
    framingCandidate = null;
    cameraView.render({ visible: true, clipsAvailable, framing });
    timer.render({ seconds: lastSeconds, state: 'waiting', hint: HINTS.waiting });
    stopLoop = startFrameLoop(cameraView.video, grabFrame);
  }

  function stopTraining() {
    if (location.hash) history.replaceState(null, '', location.pathname);
    stopLoop?.();
    stopLoop = null;
    clips.stop();
    closeCamera(cameraView.video);
    skeleton.clear();
    resultCard.render({ visible: false });
    setupHints.render({ visible: false });
    celebration.hide();
    showStart();
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
    setupHints.render({ visible: result.state === 'IDLE' && reps === 0 });
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
    const newBest = best === null || lastSeconds < best;
    if (newBest) {
      best = lastSeconds;
      saveBest(best);
    }
    stats.render({ best, reps, newBest });
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
      cameraView.render({ visible: true, clipsAvailable, framing });
    }
  }

  /** @param {EngineResult} result */
  function renderTimer({ state, run, t, frame }) {
    if (state === 'RUNNING' && run) {
      timer.render({ seconds: (t - run.startT) / 1000, state: 'running', hint: HINTS.running });
      return;
    }
    if (state === 'READY') {
      const hint = lastOutcome === 'aborted' ? HINTS.aborted : HINTS.ready;
      timer.render({ seconds: 0, state: 'ready', hint });
      return;
    }
    /** @type {TimerState} */
    const shown = state === 'DONE' ? 'done' : state === 'TIMEOUT' ? 'timeout' : 'waiting';
    const hint = !frame ? HINTS.nobody : framing === 'bad' ? HINTS.partial : HINTS[lastOutcome ?? 'waiting'];
    timer.render({ seconds: state === 'TIMEOUT' ? 20 : lastSeconds, state: shown, hint });
  }
}

function loadBest() {
  try {
    const saved = Number(localStorage.getItem(BEST_KEY));
    return saved > 0 ? saved : null;
  } catch {
    return null;
  }
}

/** @param {number} seconds */
function saveBest(seconds) {
  try {
    localStorage.setItem(BEST_KEY, String(seconds));
  } catch {
    // storage blocked – best time lasts for this visit only
  }
}

/** @param {unknown} error */
function cameraErrorText(error) {
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return 'Kein Kamera-Zugriff. Bitte erlaube die Kamera in deinem Browser und versuche es erneut.';
  }
  return 'Keine Kamera gefunden.';
}
