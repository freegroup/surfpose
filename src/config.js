// All tunable values in one place. Detection thresholds are starting values and get
// calibrated with real recordings (plan step 5).

// Vite replaces BASE_URL at build time ('/' in dev, '/surfpose/' on gh-pages), so the
// self-hosted model and runtime load from our own server under any deploy sub-path.
const BASE = import.meta.env.BASE_URL;

export const POSE_MODEL = {
  wasmPath: `${BASE}mediapipe`,
  modelPath: `${BASE}models/pose_landmarker_full.task`,
};

/** One-Euro filter for landmarks: low jitter when still, little lag when fast. */
export const SMOOTHING = {
  minCutoff: 1.5,
  beta: 0.4,
  dCutoff: 1.0,
};

/** Landmarks below this visibility are treated as not seen. */
export const MIN_VISIBILITY = 0.5;

/** Phase detection and pop-up timing. Heights in torso lengths, angles in degrees. */
export const PHASES = {
  lyingMinIncl: 60, // torso at least this flat to count as lying
  standMaxIncl: 50, // torso at most this inclined to count as standing (no upright requirement)
  lyingMaxRise: 0.15, // shoulders above the lying baseline, still lying
  onsetRise: 0.08, // first movement of the shoulders – the pop-up starts here
  pushupRise: 0.25, // shoulders clearly up – a pop-up is under way
  readyAfterMs: 700, // lying still this long → ready
  startConfirmMs: 100, // shoulders up this long → pop-up confirmed (start is back-dated)
  stableStanceMs: 300, // stance held this long → done (end is back-dated)
  abortLyingMs: 500, // lying again this long during a pop-up → aborted
  lostAfterMs: 1000, // nobody visible this long while ready → back to waiting
  timeoutMs: 20000,
  evaluationWindowMs: 800, // stance frames collected after the end for the evaluation
};

/**
 * Stance criteria, all measured around a reference value (starting value):
 * within ± `perfectRange` = 100 points (green), within ± `inRange` the score drops to 0 (yellow),
 * beyond that 0 (red). 🎯 reference clips only move `reference` – to the median of their
 * values, kept inside `referenceLimits` – the two ranges stay fixed.
 * @typedef {object} RangeCriterion
 * @property {'range'} kind
 * @property {string} label
 * @property {string} unit
 * @property {number} reference
 * @property {number} perfectRange
 * @property {number} inRange
 * @property {[number, number]} referenceLimits
 * @property {number} weight
 * @property {{ low?: string, high?: string }} tips
 */
/**
 * @typedef {object} FlagCriterion  a yes/no criterion, `good` is the desired value
 * @property {'flag'} kind
 * @property {string} label
 * @property {boolean} good
 * @property {number} weight
 * @property {string} tip
 */

/** @type {Record<string, RangeCriterion | FlagCriterion>} */
// Weights: bent knees and stance width are the core of a surf stance.
export const STANCE_CRITERIA = {
  stanceWidth: {
    kind: 'range', label: 'Standbreite', unit: '× Schulterbreite',
    reference: 1.5, perfectRange: 0.3, inRange: 0.7, referenceLimits: [1.3, 1.9], weight: 1.5,
    tips: { low: 'Stell die Füße weiter auseinander – etwa schulterbreit oder etwas mehr.', high: 'Deine Füße stehen zu weit auseinander – etwas enger stellen.' },
  },
  frontKnee: {
    kind: 'range', label: 'Vorderes Knie', unit: '°',
    reference: 130, perfectRange: 20, inRange: 40, referenceLimits: [115, 140], weight: 2,
    tips: { low: 'Vorderes Knie ist sehr stark gebeugt – etwas höher kommen.', high: 'Vorderes Knie mehr beugen – tief und federnd stehen.' },
  },
  backKnee: {
    kind: 'range', label: 'Hinteres Knie', unit: '°',
    reference: 130, perfectRange: 20, inRange: 40, referenceLimits: [115, 140], weight: 2,
    tips: { low: 'Hinteres Knie ist sehr stark gebeugt – etwas höher kommen.', high: 'Hinteres Knie mehr beugen – tief und federnd stehen.' },
  },
  hip: {
    kind: 'range', label: 'Hüfte', unit: '°',
    reference: 142.5, perfectRange: 32.5, inRange: 57.5, referenceLimits: [127.5, 147.5], weight: 1,
    tips: { low: 'Nicht in der Hüfte abknicken – Oberkörper aufrichten und mehr über die Knie tief gehen.' },
  },
  torsoLean: {
    kind: 'range', label: 'Oberkörper', unit: '° nach vorn',
    reference: 25, perfectRange: 15, inRange: 30, referenceLimits: [15, 35], weight: 1,
    tips: { low: 'Oberkörper leicht nach vorn Richtung Nose neigen.', high: 'Oberkörper zu weit vorgebeugt – etwas aufrichten.' },
  },
  gazePitch: {
    kind: 'range', label: 'Blick', unit: '° nach unten',
    reference: 0, perfectRange: 20, inRange: 40, referenceLimits: [-10, 10], weight: 1,
    tips: { low: 'Kopf nicht in den Nacken legen.', high: 'Blick nach vorn statt aufs Board.' },
  },
  lookingForward: {
    kind: 'flag', label: 'Blick Richtung Nose', good: true, weight: 0.5,
    tip: 'Schau in Fahrtrichtung, zur Nose des Boards.',
  },
  neckAngle: {
    kind: 'range', label: 'Kopf zum Körper', unit: '°',
    reference: 17.5, perfectRange: 17.5, inRange: 37.5, referenceLimits: [17.5, 27.5], weight: 0.5,
    tips: { high: 'Kopf über dem Körper halten, nicht nach vorn hängen lassen.' },
  },
  headPos: {
    kind: 'range', label: 'Kopfposition', unit: '',
    reference: 0.7, perfectRange: 0.25, inRange: 0.45, referenceLimits: [0.6, 0.8], weight: 0.5,
    tips: { low: 'Kopf zu weit hinten – mehr über die Mitte des Boards.', high: 'Kopf zu weit vorn – zurück über die Mitte.' },
  },
  hipPos: {
    kind: 'range', label: 'Schwerpunkt', unit: '',
    reference: 0.5, perfectRange: 0.1, inRange: 0.25, referenceLimits: [0.4, 0.6], weight: 1,
    tips: { low: 'Gewicht zu weit hinten – mehr in die Mitte zwischen die Füße.', high: 'Gewicht zu weit vorn – mehr in die Mitte zwischen die Füße.' },
  },
  popupGaze: {
    kind: 'range', label: 'Blick beim Aufspringen', unit: '° nach unten',
    reference: -2.5, perfectRange: 27.5, inRange: 47.5, referenceLimits: [-12.5, 7.5], weight: 1,
    tips: { high: 'Beim Aufspringen nach vorn schauen, nicht aufs Board.' },
  },
  kneeDown: {
    kind: 'flag', label: 'Ohne Knie aufgestanden', good: false, weight: 1.5,
    tip: 'Nicht übers Knie aufstehen – direkt auf die Füße springen.',
  },
};

export const EVALUATION = {
  minVisibleShare: 0.6, // a criterion needs its landmarks in this share of the stance frames
  minFootVisibility: 0.7, // frames used for regular/goofy
  minStanceShare: 0.7, // majority needed to call regular/goofy
  minReferences: 3, // reference clips needed before they replace the starting values
};

/** Video clips of the last stands (stored on the device only). */
export const CLIPS = {
  preMs: 5000, // video before the stand
  postMs: 5000, // video after the stand
  maxClips: 20, // unmarked clips kept; 🤙/🎯 clips come on top and are never removed automatically
  maxLongSide: 1280, // px
  bitrate: 2_000_000,
  fps: 30,
  keyFrameIntervalMs: 1000,
};

/** Green/red frame in the training view: is the person well in the picture? */
export const FRAMING = {
  minVisibility: 0.3, // more tolerant than the analysis (MIN_VISIBILITY)
  maxMissing: 2, // of the 8 body points (shoulders, hips, knees, ankles) – e.g. the hidden far leg in side view
  edgeMargin: 0, // normalized distance visible points must keep from the image border
  holdMs: 300, // the color changes only after the new state held this long (no flicker)
};

/** Stand mode: train only the stance, without lying down first. */
export const STAND_MODE = {
  holdMs: 600, // stance held this long → evaluated
  rearmMs: 500, // out of the stance this long → ready for the next one
  bufferMs: 1000, // recent frames used to measure floor, body size and nose direction
  yeahScore: 80, // from this score on: YEAH!
};
