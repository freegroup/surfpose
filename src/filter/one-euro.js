// One-Euro filter (Casiez et al. 2012): strong smoothing when still, little lag when moving fast.
// Driven by frame timestamps, so it behaves the same live, in the worker and in replays.

/** @typedef {{ minCutoff: number, beta: number, dCutoff: number }} OneEuroConfig */
/** @typedef {import('../pose/types.js').PoseFrame} PoseFrame */

/** @param {number} cutoff @param {number} dt */
const alpha = (cutoff, dt) => 1 / (1 + 1 / (2 * Math.PI * cutoff * dt));

/**
 * Scalar filter.
 * @param {OneEuroConfig} config
 * @returns {(value: number, tSeconds: number) => number}
 */
export function createOneEuro({ minCutoff, beta, dCutoff }) {
  /** @type {{ t: number, value: number, speed: number } | null} */
  let prev = null;

  return (value, t) => {
    if (!prev) {
      prev = { t, value, speed: 0 };
      return value;
    }
    const dt = t - prev.t;
    if (dt <= 0) return prev.value;

    const aSpeed = alpha(dCutoff, dt);
    const speed = aSpeed * ((value - prev.value) / dt) + (1 - aSpeed) * prev.speed;
    const a = alpha(minCutoff + beta * Math.abs(speed), dt);
    const filtered = a * value + (1 - a) * prev.value;

    prev = { t, value: filtered, speed };
    return filtered;
  };
}

/**
 * Smooths every coordinate of image and world landmarks of consecutive frames.
 * @param {OneEuroConfig} config
 */
export function createPoseSmoother(config) {
  /** @type {Map<string, (value: number, t: number) => number>} */
  const filters = new Map();

  /** @param {string} key @param {number} value @param {number} t */
  const filter = (key, value, t) => {
    let fn = filters.get(key);
    if (!fn) filters.set(key, (fn = createOneEuro(config)));
    return fn(value, t);
  };

  return {
    /** @param {PoseFrame} frame @returns {PoseFrame} */
    smooth(frame) {
      const t = frame.t / 1000;
      return {
        ...frame,
        image: frame.image.map((p, i) => ({
          x: filter(`i${i}x`, p.x, t),
          y: filter(`i${i}y`, p.y, t),
          z: filter(`i${i}z`, p.z, t),
          visibility: p.visibility,
        })),
        world: frame.world.map((p, i) => ({
          x: filter(`w${i}x`, p.x, t),
          y: filter(`w${i}y`, p.y, t),
          z: filter(`w${i}z`, p.z, t),
        })),
      };
    },

    reset() {
      filters.clear();
    },
  };
}
