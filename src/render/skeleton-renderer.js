import { drawSkeleton, drawStatusSkeleton } from './draw-skeleton.js';

/** @typedef {import('../pose/types.js').PoseFrame} PoseFrame */
/** @typedef {import('./draw-skeleton.js').SkeletonColors} SkeletonColors */

/**
 * Skeleton colors of the active theme (--color-skeleton-*).
 * @param {Element} [element]
 * @returns {SkeletonColors}
 */
export function readSkeletonColors(element = document.documentElement) {
  const style = getComputedStyle(element);
  const get = (/** @type {string} */ name) => style.getPropertyValue(name).trim();
  return {
    line: get('--color-skeleton-line'),
    point: get('--color-skeleton-point'),
    weak: get('--color-skeleton-point-weak'),
    outline: get('--color-skeleton-outline'),
  };
}

/**
 * Draws the detected skeleton over a video element. Colors follow the theme (`themechange`).
 * @param {HTMLCanvasElement} canvas
 */
export function createSkeletonRenderer(canvas) {
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
  let colors = readSkeletonColors(canvas);
  window.addEventListener('themechange', () => {
    colors = readSkeletonColors(canvas);
  });

  /** Matches the canvas buffer to its displayed size (sharp on retina screens). */
  function fit() {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w, h };
  }

  return {
    /**
     * @param {PoseFrame | null} frame
     * @param {{ mirror: boolean, objectFit?: 'cover' | 'contain' }} options same mirroring and object-fit as the video
     */
    draw(frame, { mirror, objectFit = 'cover' }) {
      const { w, h } = fit();
      ctx.clearRect(0, 0, w, h);
      if (!frame) return;
      drawSkeleton(ctx, frame.image, {
        frameWidth: frame.width, frameHeight: frame.height, width: w, height: h, mirror, objectFit,
      }, colors);
    },

    /**
     * Thick skeleton with a color per joint (developer page). Returns the view and joint
     * radius used, so taps can be matched to joints with the same mapping.
     * @param {PoseFrame | null} frame
     * @param {{ mirror: boolean }} options
     * @param {(index: number | 'head') => string} jointColor
     */
    drawStatus(frame, { mirror }, jointColor) {
      const { w, h } = fit();
      ctx.clearRect(0, 0, w, h);
      if (!frame) return null;
      /** @type {import('./draw-skeleton.js').SkeletonView} */
      const view = { frameWidth: frame.width, frameHeight: frame.height, width: w, height: h, mirror, objectFit: 'cover' };
      return { view, radius: drawStatusSkeleton(ctx, frame.image, view, colors, jointColor) };
    },

    clear() {
      const { w, h } = fit();
      ctx.clearRect(0, 0, w, h);
    },
  };
}
