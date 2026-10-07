import { MIN_VISIBILITY } from '../config.js';
import { headCenter, LM } from '../pose/landmarks.js';
import { angle3, angleBetween, dist, dist3, inclination, mid, mid3 } from './geometry.js';

/** @typedef {import('../pose/types.js').PoseFrame} PoseFrame */
/** @typedef {import('./geometry.js').Vec2} Vec2 */

/**
 * Orientation and body scale of a session, measured while lying still (see board-axis.js).
 * @typedef {object} Calibration
 * @property {1 | -1} noseDir   image x direction the board nose points to (+1 = right, unmirrored frame)
 * @property {boolean} gazeAgrees  head looked towards noseDir as well
 * @property {number} groundY   image y of the floor/board, px
 * @property {number} torsoLen  shoulder-to-hip length, px
 * @property {number} shoulderHeight  shoulders above ground while lying, in torso lengths
 */

/**
 * Per-frame body description used by the phase detector.
 * Heights are in torso lengths above the ground; null when not calibrated or not visible.
 * @typedef {object} BodyFeatures
 * @property {number} t
 * @property {boolean} core          shoulders and hips are visible
 * @property {number} torsoLen       px
 * @property {number} torsoIncl      degrees from vertical (0 upright, 90 lying)
 * @property {boolean | null} legsFlat  ankles at hip level, as when lying
 * @property {number | null} shoulderHeight
 * @property {number | null} hipHeight
 * @property {boolean | null} feetUnderBody  both feet on the ground below the hips, hips between the feet
 * @property {boolean | null} handsDown  a hand on the ground
 * @property {boolean | null} kneeDown   kneeling: a bent knee on the board (a straight plank doesn't count)
 * @property {boolean | null} hipsAboveKnees
 * @property {number | null} gazePitch   ear→nose below horizontal, degrees (positive = looking down)
 */

const HAND_ON_GROUND = 0.3; // torso lengths
const KNEE_ON_GROUND = 0.25;
const KNEE_BENT = 130; // degrees – a knee on the board is bent, a plank is straight
const FOOT_ON_GROUND = 0.35;
const FEET_UNDER_BODY = 0.9; // ankles must be this far below the hips
const HIP_BETWEEN_MARGIN = 0.15; // hips may be this far outside the feet (along the board)

/** @param {number} a @param {number} b @param {number} x @param {number} margin */
const hipBetween = (a, b, x, margin) => Math.min(a, b) - margin < x && x < Math.max(a, b) + margin;

/**
 * Image landmark in pixels, so distances are aspect-correct.
 * @param {PoseFrame} frame @param {number} i
 */
export function px(frame, i) {
  const p = frame.image[i];
  return { x: p.x * frame.width, y: p.y * frame.height, seen: p.visibility >= MIN_VISIBILITY };
}

/** @param {PoseFrame} frame @returns {(Vec2 & { seen: boolean }) | null} */
function visibleEar(frame) {
  const left = frame.image[LM.LEFT_EAR];
  const right = frame.image[LM.RIGHT_EAR];
  const best = left.visibility >= right.visibility ? LM.LEFT_EAR : LM.RIGHT_EAR;
  const ear = px(frame, best);
  return ear.seen ? ear : null;
}

/**
 * Viewing direction from the head profile. Works lying and standing, because the head
 * is turned towards the nose of the board in both cases.
 * @param {PoseFrame} frame
 * @returns {{ dirX: number, pitch: number } | null} dirX: sign of the gaze in image x
 */
export function gaze(frame) {
  const nose = px(frame, LM.NOSE);
  const ear = visibleEar(frame);
  if (!nose.seen || !ear) return null;
  const dx = nose.x - ear.x;
  const dy = nose.y - ear.y;
  return { dirX: Math.sign(dx), pitch: (Math.atan2(dy, Math.abs(dx)) * 180) / Math.PI };
}

/**
 * @param {PoseFrame} frame
 * @param {(p: Vec2) => number | null} height
 */
function kneeOnBoard(frame, height) {
  return [
    [LM.LEFT_HIP, LM.LEFT_KNEE, LM.LEFT_ANKLE],
    [LM.RIGHT_HIP, LM.RIGHT_KNEE, LM.RIGHT_ANKLE],
  ].some(([hip, knee, ankle]) => {
    const k = px(frame, knee);
    return k.seen
      && /** @type {number} */ (height(k)) < KNEE_ON_GROUND
      && angle3(frame.world[hip], frame.world[knee], frame.world[ankle]) < KNEE_BENT;
  });
}

/**
 * @param {PoseFrame} frame
 * @param {Calibration | null} calib
 * @returns {BodyFeatures}
 */
export function extractFeatures(frame, calib) {
  const ls = px(frame, LM.LEFT_SHOULDER);
  const rs = px(frame, LM.RIGHT_SHOULDER);
  const lh = px(frame, LM.LEFT_HIP);
  const rh = px(frame, LM.RIGHT_HIP);
  const shoulder = mid(ls, rs);
  const hip = mid(lh, rh);
  const torsoLen = dist(shoulder, hip);
  const ankles = [px(frame, LM.LEFT_ANKLE), px(frame, LM.RIGHT_ANKLE)].filter((p) => p.seen);
  const knees = [px(frame, LM.LEFT_KNEE), px(frame, LM.RIGHT_KNEE)].filter((p) => p.seen);
  const wrists = [px(frame, LM.LEFT_WRIST), px(frame, LM.RIGHT_WRIST)].filter((p) => p.seen);

  const scale = calib?.torsoLen ?? torsoLen;
  /** @param {Vec2} p height above ground in torso lengths */
  const height = (p) => (calib ? (calib.groundY - p.y) / scale : null);
  const nearGround = (/** @type {Vec2[]} */ ps, /** @type {number} */ limit) =>
    calib && ps.length ? ps.some((p) => /** @type {number} */ (height(p)) < limit) : null;

  return {
    t: frame.t,
    core: ls.seen && rs.seen && lh.seen && rh.seen,
    torsoLen,
    torsoIncl: inclination(hip, shoulder),
    legsFlat: ankles.length ? ankles.every((a) => Math.abs(a.y - hip.y) < 0.6 * scale) : null,
    shoulderHeight: height(shoulder),
    hipHeight: height(hip),
    feetUnderBody: calib && ankles.length === 2
      ? ankles.every((a) => /** @type {number} */ (height(a)) < FOOT_ON_GROUND && a.y - hip.y > FEET_UNDER_BODY * scale)
        && hipBetween(ankles[0].x, ankles[1].x, hip.x, HIP_BETWEEN_MARGIN * scale)
      : null,
    handsDown: nearGround(wrists, HAND_ON_GROUND),
    kneeDown: calib ? kneeOnBoard(frame, height) : null,
    hipsAboveKnees: knees.length ? knees.every((k) => hip.y < k.y) : null,
    gazePitch: gaze(frame)?.pitch ?? null,
  };
}

/**
 * Stance description for the evaluation, defined by front/back foot instead of left/right,
 * so regular and goofy stances are comparable.
 * @typedef {object} StanceFeatures
 * @property {'left' | 'right'} frontFoot
 * @property {number} stanceWidth    ankle distance / shoulder width (3D)
 * @property {number} frontKnee      hip-knee-ankle angle, degrees (180 = straight)
 * @property {number} backKnee
 * @property {number} frontHip       shoulder-hip-knee angle, degrees
 * @property {number} backHip
 * @property {number} torsoLean      degrees from vertical, positive = towards the nose
 * @property {number} neckAngle      head vs. torso axis (3D), degrees (0 = in line)
 * @property {number | null} gazePitch  degrees, positive = looking down
 * @property {boolean | null} lookingForward  gaze points towards the nose
 * @property {number} hipPos         hips between the feet: 0 = back foot, 1 = front foot
 * @property {number | null} headPos  head between the feet, same scale
 * @property {number} footVisibility  min. visibility of both ankles (confidence of front/back)
 */

/**
 * @param {PoseFrame} frame
 * @param {Calibration} calib
 * @returns {StanceFeatures}
 */
export function extractStanceFeatures(frame, calib) {
  const w = frame.world;
  const along = (/** @type {Vec2} */ p) => p.x * calib.noseDir;
  const leftAnkle = px(frame, LM.LEFT_ANKLE);
  const rightAnkle = px(frame, LM.RIGHT_ANKLE);
  const frontFoot = along(leftAnkle) >= along(rightAnkle) ? 'left' : 'right';
  const side = frontFoot === 'left'
    ? { front: { hip: LM.LEFT_HIP, knee: LM.LEFT_KNEE, ankle: LM.LEFT_ANKLE, shoulder: LM.LEFT_SHOULDER },
        back: { hip: LM.RIGHT_HIP, knee: LM.RIGHT_KNEE, ankle: LM.RIGHT_ANKLE, shoulder: LM.RIGHT_SHOULDER } }
    : { front: { hip: LM.RIGHT_HIP, knee: LM.RIGHT_KNEE, ankle: LM.RIGHT_ANKLE, shoulder: LM.RIGHT_SHOULDER },
        back: { hip: LM.LEFT_HIP, knee: LM.LEFT_KNEE, ankle: LM.LEFT_ANKLE, shoulder: LM.LEFT_SHOULDER } };

  const shoulder = mid(px(frame, LM.LEFT_SHOULDER), px(frame, LM.RIGHT_SHOULDER));
  const hip = mid(px(frame, LM.LEFT_HIP), px(frame, LM.RIGHT_HIP));
  const backU = along(px(frame, side.back.ankle));
  const frontU = along(px(frame, side.front.ankle));
  const between = (/** @type {Vec2} */ p) => (along(p) - backU) / (frontU - backU || 1);

  const headLm = headCenter(frame.image);
  const head = headLm && { x: headLm.x * frame.width, y: headLm.y * frame.height };
  const g = gaze(frame);
  const shoulder3 = mid3(w[LM.LEFT_SHOULDER], w[LM.RIGHT_SHOULDER]);
  const hip3 = mid3(w[LM.LEFT_HIP], w[LM.RIGHT_HIP]);
  const head3 = mid3(w[LM.LEFT_EAR], w[LM.RIGHT_EAR]);

  return {
    frontFoot,
    stanceWidth: dist3(w[LM.LEFT_ANKLE], w[LM.RIGHT_ANKLE]) / dist3(w[LM.LEFT_SHOULDER], w[LM.RIGHT_SHOULDER]),
    frontKnee: angle3(w[side.front.hip], w[side.front.knee], w[side.front.ankle]),
    backKnee: angle3(w[side.back.hip], w[side.back.knee], w[side.back.ankle]),
    frontHip: angle3(w[side.front.shoulder], w[side.front.hip], w[side.front.knee]),
    backHip: angle3(w[side.back.shoulder], w[side.back.hip], w[side.back.knee]),
    torsoLean: (Math.atan2((shoulder.x - hip.x) * calib.noseDir, hip.y - shoulder.y) * 180) / Math.PI,
    neckAngle: angleBetween(hip3, shoulder3, shoulder3, head3),
    gazePitch: g?.pitch ?? null,
    lookingForward: g ? g.dirX === calib.noseDir : null,
    hipPos: between(hip),
    headPos: head ? between(head) : null,
    footVisibility: Math.min(frame.image[LM.LEFT_ANKLE].visibility, frame.image[LM.RIGHT_ANKLE].visibility),
  };
}
