// Skeleton drawing without DOM access – used by the live view, the clip player and the
// clip worker (burned into the video).
import { MIN_VISIBILITY } from '../config.js';
import { headCenter, LM, SKELETON_EDGES, SKELETON_POINTS } from '../pose/landmarks.js';

/** @typedef {import('../pose/types.js').ImageLandmark} ImageLandmark */
/** @typedef {{ line: string, point: string, weak: string, outline: string }} SkeletonColors */

const GOOD_VISIBILITY = 0.8;

/**
 * @param {CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D} ctx
 * @param {ImageLandmark[]} lm  normalized landmarks of the unmirrored camera frame
 * @param {object} view
 * @param {number} view.frameWidth   camera frame size (for the aspect ratio)
 * @param {number} view.frameHeight
 * @param {number} view.width        drawing area
 * @param {number} view.height
 * @param {boolean} view.mirror      mirrored like the selfie video
 * @param {'cover' | 'contain'} view.objectFit  same mapping as the video element
 * @param {SkeletonColors} colors
 */
export function drawSkeleton(ctx, lm, { frameWidth, frameHeight, width, height, mirror, objectFit }, colors) {
  const scale = (objectFit === 'cover' ? Math.max : Math.min)(width / frameWidth, height / frameHeight);
  const ox = (width - frameWidth * scale) / 2;
  const oy = (height - frameHeight * scale) / 2;
  const toCanvas = (/** @type {ImageLandmark} */ p) => {
    const x = p.x * frameWidth * scale + ox;
    return { x: mirror ? width - x : x, y: p.y * frameHeight * scale + oy };
  };
  const seen = (/** @type {ImageLandmark} */ p) => p.visibility >= MIN_VISIBILITY;
  const size = Math.min(width, height);
  const head = headCenter(lm);
  const [ls, rs] = [lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER]];

  ctx.lineWidth = Math.max(3, size * 0.006);
  ctx.lineCap = 'round';
  ctx.strokeStyle = colors.line;
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
    const ps = toCanvas({ ...ls, x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 });
    ctx.moveTo(ph.x, ph.y);
    ctx.lineTo(ps.x, ps.y);
  }
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
