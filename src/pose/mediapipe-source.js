import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import { POSE_MODEL } from '../config.js';

/** @typedef {import('./types.js').PoseSource} PoseSource */
/** @typedef {import('./types.js').PoseFrame} PoseFrame */

/**
 * PoseSource backed by MediaPipe PoseLandmarker. Tries the GPU first, falls back to CPU.
 * @param {{ canvas?: OffscreenCanvas }} [options] canvas for the GPU delegate when running in a worker
 * @returns {PoseSource & { delegate: () => 'GPU' | 'CPU' | null }}
 */
export function createMediaPipeSource({ canvas } = {}) {
  /** @type {PoseLandmarker | null} */
  let landmarker = null;
  /** @type {'GPU' | 'CPU' | null} */
  let delegate = null;
  let lastT = -Infinity;

  /** @param {Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>} fileset @param {'GPU' | 'CPU'} d */
  const create = (fileset, d) => PoseLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: POSE_MODEL.modelPath, delegate: d },
    runningMode: 'VIDEO',
    numPoses: 1,
    ...(canvas && { canvas }),
  });

  return {
    async init() {
      // module workers can only load the ES-module runtime, the main thread only the classic one
      const inWorker = !('document' in globalThis);
      const fileset = await FilesetResolver.forVisionTasks(POSE_MODEL.wasmPath, inWorker);
      try {
        landmarker = await create(fileset, 'GPU');
        delegate = 'GPU';
      } catch (error) {
        console.warn('GPU delegate unavailable, using CPU', error);
        landmarker = await create(fileset, 'CPU');
        delegate = 'CPU';
      }
    },

    detect(image, t) {
      if (!landmarker) throw new Error('PoseSource not initialized');
      // MediaPipe requires strictly increasing timestamps
      const ts = Math.max(t, lastT + 0.001);
      lastT = ts;
      const result = landmarker.detectForVideo(image, ts);
      const image2d = result.landmarks[0];
      const world = result.worldLandmarks[0];
      if (!image2d || !world) return null;
      return {
        t,
        width: image.width,
        height: image.height,
        image: image2d.map(({ x, y, z, visibility }) => ({ x, y, z, visibility })),
        world: world.map(({ x, y, z }) => ({ x, y, z })),
      };
    },

    dispose() {
      landmarker?.close();
      landmarker = null;
    },

    delegate: () => delegate,
  };
}
