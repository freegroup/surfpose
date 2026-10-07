// Synthetic pose frames for tests: a stick figure in board coordinates
// (u = along the board towards the nose, v = up from the floor, d = towards the camera; meters),
// projected into image and world landmarks the way MediaPipe delivers them.
import { LANDMARK_COUNT, LM } from '../../src/pose/landmarks.js';

/** @typedef {import('../../src/pose/types.js').PoseFrame} PoseFrame */
/** @typedef {[number, number, number]} UVD */
/** @typedef {Record<string, UVD>} Template */

// "front"/"back" = the side nearer to / farther from the nose of the board.
/** @type {Record<string, Template>} */
export const TEMPLATES = {
  // paddle position: prone, chest slightly up, head raised looking forward
  lying: {
    nose: [0.8, 0.4, 0], frontEar: [0.7, 0.4, 0.07], backEar: [0.7, 0.4, -0.07],
    frontShoulder: [0.52, 0.24, 0.18], backShoulder: [0.52, 0.24, -0.18],
    frontElbow: [0.4, 0.14, 0.22], backElbow: [0.4, 0.14, -0.22],
    frontWrist: [0.5, 0.03, 0.2], backWrist: [0.5, 0.03, -0.2],
    frontHip: [0, 0.14, 0.12], backHip: [0, 0.14, -0.12],
    frontKnee: [-0.45, 0.08, 0.12], backKnee: [-0.45, 0.08, -0.12],
    frontAnkle: [-0.9, 0.07, 0.12], backAnkle: [-0.9, 0.07, -0.12],
  },
  pushup: {
    nose: [0.85, 0.95, 0], frontEar: [0.76, 0.95, 0.07], backEar: [0.76, 0.95, -0.07],
    frontShoulder: [0.5, 0.75, 0.18], backShoulder: [0.5, 0.75, -0.18],
    frontElbow: [0.48, 0.4, 0.2], backElbow: [0.48, 0.4, -0.2],
    frontWrist: [0.47, 0.03, 0.2], backWrist: [0.47, 0.03, -0.2],
    frontHip: [0, 0.4, 0.12], backHip: [0, 0.4, -0.12],
    frontKnee: [-0.45, 0.15, 0.12], backKnee: [-0.45, 0.15, -0.12],
    frontAnkle: [-0.9, 0.07, 0.12], backAnkle: [-0.9, 0.07, -0.12],
  },
  // good surf stance: wide, knees bent, slight forward lean, looking forward
  stance: {
    nose: [0.33, 1.55, 0], frontEar: [0.22, 1.56, 0.06], backEar: [0.22, 1.56, -0.06],
    frontShoulder: [0.3, 1.32, 0], backShoulder: [-0.08, 1.32, 0],
    frontElbow: [0.45, 1.1, 0.05], backElbow: [-0.25, 1.1, 0.05],
    frontWrist: [0.55, 0.95, 0.05], backWrist: [-0.35, 0.95, 0.05],
    frontHip: [0.12, 0.85, 0], backHip: [-0.08, 0.85, 0],
    frontKnee: [0.45, 0.48, 0.05], backKnee: [0, 0.45, 0.05],
    frontAnkle: [0.33, 0.07, 0], backAnkle: [-0.3, 0.07, 0],
  },
  // typical beginner fault: standing up straight, narrow, stiff legs
  upright: {
    nose: [0.12, 1.7, 0], frontEar: [0.02, 1.7, 0.06], backEar: [0.02, 1.7, -0.06],
    frontShoulder: [0.19, 1.45, 0], backShoulder: [-0.19, 1.45, 0],
    frontElbow: [0.25, 1.15, 0], backElbow: [-0.25, 1.15, 0],
    frontWrist: [0.27, 0.9, 0], backWrist: [-0.27, 0.9, 0],
    frontHip: [0.1, 0.95, 0], backHip: [-0.1, 0.95, 0],
    frontKnee: [0.18, 0.5, 0], backKnee: [-0.18, 0.5, 0],
    frontAnkle: [0.18, 0.07, 0], backAnkle: [-0.18, 0.07, 0],
  },
};

/** Standing, bent forward at the hips (e.g. reaching for the laptop): torso flat, feet under the hips. */
TEMPLATES.bentOver = {
  nose: [0.78, 0.9, 0], frontEar: [0.7, 0.95, 0.06], backEar: [0.7, 0.95, -0.06],
  frontShoulder: [0.5, 1.0, 0.18], backShoulder: [0.5, 1.0, -0.18],
  frontElbow: [0.55, 0.75, 0.2], backElbow: [0.55, 0.75, -0.2],
  frontWrist: [0.6, 0.5, 0.2], backWrist: [0.6, 0.5, -0.2],
  frontHip: [0, 0.92, 0.12], backHip: [0, 0.92, -0.12],
  frontKnee: [0.02, 0.5, 0.12], backKnee: [0.02, 0.5, -0.12],
  frontAnkle: [0, 0.07, 0.12], backAnkle: [0, 0.07, -0.12],
};

/** Stance with the chin dropped: looking down at the board. */
TEMPLATES.lookDown = { ...TEMPLATES.stance, nose: [0.27, 1.43, 0] };
/** Halfway up with the back knee on the board. */
TEMPLATES.kneeDown = {
  ...TEMPLATES.pushup,
  backKnee: [-0.05, 0.05, -0.12], backAnkle: [-0.45, 0.1, -0.12],
  backHip: [0.02, 0.5, -0.12], frontHip: [0.02, 0.5, 0.12],
};

const SIDE_JOINTS = /** @type {const} */ (['Ear', 'Shoulder', 'Elbow', 'Wrist', 'Hip', 'Knee', 'Ankle']);

/**
 * @param {Template} a @param {Template} b @param {number} k 0 = a, 1 = b
 * @returns {Template}
 */
export function blend(a, b, k) {
  return Object.fromEntries(Object.keys(a).map((key) => [
    key,
    /** @type {UVD} */ (a[key].map((v, i) => v + (b[key][i] - v) * k)),
  ]));
}

/**
 * @param {object} options
 * @param {Template} options.template
 * @param {1 | -1} [options.noseDir]  +1: nose points to the right of the unmirrored image
 * @param {'regular' | 'goofy'} [options.stance]  regular = left foot in front
 * @param {number} [options.t]  ms
 * @param {Partial<Record<keyof typeof LM, number>>} [options.visibility]  overrides, default 0.95
 * @param {number} [options.noise]  image jitter in px
 * @returns {PoseFrame}
 */
export function synthFrame({ template, noseDir = 1, stance = 'regular', t = 0, visibility = {}, noise = 0 }) {
  const width = 1280;
  const height = 720;
  const pxPerMeter = 280;
  const originX = width / 2;
  const groundY = 650;
  const front = stance === 'regular' ? 'LEFT' : 'RIGHT';
  const back = stance === 'regular' ? 'RIGHT' : 'LEFT';

  /** @type {Partial<Record<keyof typeof LM, UVD>>} */
  const joints = { NOSE: template.nose };
  for (const j of SIDE_JOINTS) {
    joints[/** @type {keyof typeof LM} */ (`${front}_${j.toUpperCase()}`)] = template[`front${j}`];
    joints[/** @type {keyof typeof LM} */ (`${back}_${j.toUpperCase()}`)] = template[`back${j}`];
  }
  // feet: heel behind, toes in front of the ankle along the board
  for (const s of ['LEFT', 'RIGHT']) {
    const [u, v, d] = /** @type {UVD} */ (joints[/** @type {keyof typeof LM} */ (`${s}_ANKLE`)]);
    joints[/** @type {keyof typeof LM} */ (`${s}_HEEL`)] = [u - 0.06, v - 0.04, d];
    joints[/** @type {keyof typeof LM} */ (`${s}_FOOT_INDEX`)] = [u + 0.16, v - 0.06, d];
  }

  const hipU = (template.frontHip[0] + template.backHip[0]) / 2;
  const hipV = (template.frontHip[1] + template.backHip[1]) / 2;
  const jitter = () => (Math.random() - 0.5) * 2 * noise;

  const image = Array.from({ length: LANDMARK_COUNT }, () => ({ x: 0, y: 0, z: 0, visibility: 0 }));
  const world = Array.from({ length: LANDMARK_COUNT }, () => ({ x: 0, y: 0, z: 0 }));
  for (const [name, uvd] of Object.entries(joints)) {
    const i = LM[/** @type {keyof typeof LM} */ (name)];
    const [u, v, d] = /** @type {UVD} */ (uvd);
    image[i] = {
      x: (originX + u * noseDir * pxPerMeter + jitter()) / width,
      y: (groundY - v * pxPerMeter + jitter()) / height,
      z: -d,
      visibility: visibility[/** @type {keyof typeof LM} */ (name)] ?? 0.95,
    };
    world[i] = { x: (u - hipU) * noseDir, y: -(v - hipV), z: -d };
  }
  return { t, width, height, image, world };
}

/**
 * Timeline of frames at 30 fps. A segment either holds a template or blends from the
 * previous template to a new one.
 * @param {ReadonlyArray<{ hold: keyof typeof TEMPLATES, ms: number } | { to: keyof typeof TEMPLATES, ms: number }>} segments
 * @param {{ noseDir?: 1 | -1, stance?: 'regular' | 'goofy', noise?: number, startT?: number }} [options]
 * @returns {PoseFrame[]}
 */
export function sequence(segments, { noseDir = 1, stance = 'regular', noise = 1.5, startT = 0 } = {}) {
  const frameMs = 1000 / 30;
  /** @type {PoseFrame[]} */
  const frames = [];
  let t = startT;
  /** @type {Template} */
  let current = TEMPLATES.lying;
  for (const segment of segments) {
    const from = 'hold' in segment ? TEMPLATES[segment.hold] : current;
    const to = 'hold' in segment ? from : TEMPLATES[segment.to];
    const count = Math.round(segment.ms / frameMs);
    for (let i = 1; i <= count; i++) {
      frames.push(synthFrame({ template: blend(from, to, i / count), noseDir, stance, t, noise }));
      t += frameMs;
    }
    current = to;
  }
  return frames;
}
