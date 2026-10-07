import { MIN_VISIBILITY } from '../config.js';
import { headCenter, LM, SKELETON_EDGES, SKELETON_POINTS } from '../pose/landmarks.js';

/** @typedef {import('../pose/types.js').PoseFrame} PoseFrame */
/** @typedef {import('../pose/types.js').ImageLandmark} ImageLandmark */

const GOOD_VISIBILITY = 0.8;

/**
 * Draws the detected skeleton over the video. Colors come from the theme
 * (--color-skeleton-*) and are re-read on `themechange`.
 * @param {HTMLCanvasElement} canvas
 */
export function createSkeletonRenderer(canvas) {
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
  let colors = readColors();
  window.addEventListener('themechange', () => {
    colors = readColors();
  });

  function readColors() {
    const style = getComputedStyle(canvas);
    const get = (/** @type {string} */ name) => style.getPropertyValue(name).trim();
    return {
      line: get('--color-skeleton-line'),
      point: get('--color-skeleton-point'),
      weak: get('--color-skeleton-point-weak'),
      outline: get('--color-skeleton-outline'),
    };
  }

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

      // same mapping as the video's object-fit
      const scale = (objectFit === 'cover' ? Math.max : Math.min)(w / frame.width, h / frame.height);
      const ox = (w - frame.width * scale) / 2;
      const oy = (h - frame.height * scale) / 2;
      const toCanvas = (/** @type {ImageLandmark} */ p) => {
        const x = p.x * frame.width * scale + ox;
        return { x: mirror ? w - x : x, y: p.y * frame.height * scale + oy };
      };
      const lm = frame.image;
      const head = headCenter(lm);
      const shoulders = [lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]];

      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.strokeStyle = colors.line;
      ctx.beginPath();
      for (const [a, b] of SKELETON_EDGES) {
        if (lm[a].visibility < MIN_VISIBILITY || lm[b].visibility < MIN_VISIBILITY) continue;
        const pa = toCanvas(lm[a]);
        const pb = toCanvas(lm[b]);
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
      }
      if (head && shoulders.every((p) => p.visibility >= MIN_VISIBILITY)) {
        const ph = toCanvas(head);
        const ps = toCanvas({ ...shoulders[0], x: (shoulders[0].x + shoulders[1].x) / 2, y: (shoulders[0].y + shoulders[1].y) / 2 });
        ctx.moveTo(ph.x, ph.y);
        ctx.lineTo(ps.x, ps.y);
      }
      ctx.stroke();

      const points = SKELETON_POINTS.map((i) => lm[i]).concat(head ? [head] : []);
      ctx.lineWidth = 2;
      ctx.strokeStyle = colors.outline;
      for (const p of points) {
        if (p.visibility < MIN_VISIBILITY) continue;
        const c = toCanvas(p);
        ctx.beginPath();
        ctx.arc(c.x, c.y, 6, 0, 2 * Math.PI);
        ctx.fillStyle = p.visibility >= GOOD_VISIBILITY ? colors.point : colors.weak;
        ctx.fill();
        ctx.stroke();
      }
    },

    clear() {
      const { w, h } = fit();
      ctx.clearRect(0, 0, w, h);
    },
  };
}
