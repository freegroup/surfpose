// Small vector helpers. 2D points are image pixels (y down), 3D points are world meters.

/** @typedef {{ x: number, y: number }} Vec2 */
/** @typedef {import('../pose/types.js').Vec3} Vec3 */

/** @param {Vec2} a @param {Vec2} b @returns {Vec2} */
export const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/** @param {Vec2} a @param {Vec2} b */
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** @param {Vec3} a @param {Vec3} b */
export const dist3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/** @param {Vec3} a @param {Vec3} b @returns {Vec3} */
export const mid3 = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 });

const DEG = 180 / Math.PI;

/**
 * Angle at b between the segments b→a and b→c, in degrees (0..180).
 * @param {Vec3} a @param {Vec3} b @param {Vec3} c
 */
export function angle3(a, b, c) {
  const u = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  const v = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };
  const cos = (u.x * v.x + u.y * v.y + u.z * v.z) / (Math.hypot(u.x, u.y, u.z) * Math.hypot(v.x, v.y, v.z));
  return Math.acos(Math.min(1, Math.max(-1, cos))) * DEG;
}

/**
 * Angle between two 3D directions (a1→a2 vs b1→b2), in degrees (0..180).
 * @param {Vec3} a1 @param {Vec3} a2 @param {Vec3} b1 @param {Vec3} b2
 */
export function angleBetween(a1, a2, b1, b2) {
  const origin = { x: 0, y: 0, z: 0 };
  return angle3(
    { x: a2.x - a1.x, y: a2.y - a1.y, z: a2.z - a1.z },
    origin,
    { x: b2.x - b1.x, y: b2.y - b1.y, z: b2.z - b1.z },
  );
}

/**
 * Inclination of the segment from→to against "straight up" in the image, in degrees:
 * 0 = upright, 90 = horizontal, 180 = upside down.
 * @param {Vec2} from @param {Vec2} to
 */
export function inclination(from, to) {
  return Math.atan2(Math.abs(to.x - from.x), from.y - to.y) * DEG;
}

/** @param {number[]} values */
export function median(values) {
  if (!values.length) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
}
