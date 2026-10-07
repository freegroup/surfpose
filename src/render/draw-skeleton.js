// Skeleton drawing without DOM access – used by the live view, the clip player and the
// clip worker (burned into the video).
import { MIN_VISIBILITY } from '../config.js';
import { headCenter, LM, SKELETON_EDGES, SKELETON_POINTS } from '../pose/landmarks.js';

/** @typedef {import('../pose/types.js').ImageLandmark} ImageLandmark */
/** @typedef {{ line: string, point: string, weak: string, outline: string }} SkeletonColors */

const GOOD_VISIBILITY = 0.8;

/**
 * @typedef {object} SkeletonView
 * @property {number} frameWidth   camera frame size (for the aspect ratio)
 * @property {number} frameHeight
 * @property {number} width        drawing area
 * @property {number} height
 * @property {boolean} mirror      mirrored like the selfie video
 * @property {'cover' | 'contain'} objectFit  same mapping as the video element
 */

/**
 * Maps a normalized landmark to drawing-area coordinates, exactly like the video is shown.
 * @param {SkeletonView} view
 * @returns {(p: { x: number, y: number }) => { x: number, y: number }}
 */
export function canvasMapper({ frameWidth, frameHeight, width, height, mirror, objectFit }) {
  const scale = (objectFit === 'cover' ? Math.max : Math.min)(width / frameWidth, height / frameHeight);
  const ox = (width - frameWidth * scale) / 2;
  const oy = (height - frameHeight * scale) / 2;
  return (p) => {
    const x = p.x * frameWidth * scale + ox;
    return { x: mirror ? width - x : x, y: p.y * frameHeight * scale + oy };
  };
}

const seen = (/** @type {ImageLandmark} */ p) => p.visibility >= MIN_VISIBILITY;

/**
 * Bones as one path, including head → middle of the shoulders.
 * @param {CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D} ctx
 * @param {ImageLandmark[]} lm
 * @param {ReturnType<typeof canvasMapper>} toCanvas
 */
function traceBones(ctx, lm, toCanvas) {
  const head = headCenter(lm);
  const [ls, rs] = [lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]];
  ctx.beginPath();
  for (const [a, b] of SKELETON_EDGES) {
    if (!seen(lm[a]) || !seen(lm[b])) continue;
    const pa = toCanvas(lm[a]);
    const pb = toCanvas(lm[b]);
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
  }
  if (head && seen(ls) && seen(rs)) {
    const ph = toCanvas(head);
    const ps = toCanvas({ x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 });
    ctx.moveTo(ph.x, ph.y);
    ctx.lineTo(ps.x, ps.y);
  }
}

/**
 * Thick skeleton for watching from a distance (developer page): every joint in its own color.
 * @param {CanvasRenderingContext2D} ctx
 * @param {ImageLandmark[]} lm
 * @param {SkeletonView} view
 * @param {{ line: string, outline: string }} colors
 * @param {(index: number | 'head') => string} jointColor
 * @returns {number} joint radius in px (for hit testing)
 */
export function drawStatusSkeleton(ctx, lm, view, colors, jointColor) {
  const toCanvas = canvasMapper(view);
  const size = Math.min(view.width, view.height);
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(8, size * 0.016);
  ctx.strokeStyle = colors.line;
  traceBones(ctx, lm, toCanvas);
  ctx.stroke();

  const radius = Math.max(14, size * 0.03);
  ctx.lineWidth = Math.max(3, size * 0.005);
  ctx.strokeStyle = colors.outline;
  const head = headCenter(lm);
  /** @type {[number | 'head', ImageLandmark][]} */
  const joints = SKELETON_POINTS.map((i) => /** @type {[number, ImageLandmark]} */ ([i, lm[i]]));
  if (head) joints.push(['head', head]);
  for (const [index, p] of joints) {
    if (!seen(p)) continue;
    const c = toCanvas(p);
    ctx.beginPath();
    ctx.arc(c.x, c.y, index === 'head' ? radius * 1.4 : radius, 0, 2 * Math.PI);
    ctx.fillStyle = jointColor(index);
    ctx.fill();
    ctx.stroke();
  }
  return radius;
}

/**
 * @param {CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D} ctx
 * @param {ImageLandmark[]} lm  normalized landmarks of the unmirrored camera frame
 * @param {SkeletonView} view
 * @param {SkeletonColors} colors
 */
export function drawSkeleton(ctx, lm, view, colors) {
  const { width, height } = view;
  const toCanvas = canvasMapper(view);
  const size = Math.min(width, height);
  const head = headCenter(lm);

  ctx.lineWidth = Math.max(3, size * 0.006);
  ctx.lineCap = 'round';
  ctx.strokeStyle = colors.line;
  traceBones(ctx, lm, toCanvas);
  ctx.stroke();

  ctx.lineWidth = Math.max(2, size * 0.003);
  ctx.strokeStyle = colors.outline;
  const radius = Math.max(5, size * 0.009);
  for (const p of SKELETON_POINTS.map((i) => lm[i]).concat(head ? [head] : [])) {
    if (!seen(p)) continue;
    const c = toCanvas(p);
    ctx.beginPath();
    ctx.arc(c.x, c.y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = p.visibility >= GOOD_VISIBILITY ? colors.point : colors.weak;
    ctx.fill();
    ctx.stroke();
  }
}
