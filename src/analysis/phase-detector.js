import { PHASES } from '../config.js';

/** @typedef {import('./features.js').BodyFeatures} BodyFeatures */
/** @typedef {import('./features.js').Calibration} Calibration */
/** @typedef {'LYING' | 'PUSHUP' | 'TRANSITION' | 'STANCE' | 'UNKNOWN'} Phase */

/**
 * Shoulder height above the lying baseline, in torso lengths.
 * @param {BodyFeatures} f @param {Calibration | null} calib
 */
export const shoulderRise = (f, calib) =>
  calib && f.shoulderHeight !== null ? f.shoulderHeight - calib.shoulderHeight : null;

/**
 * Phase of a single frame. Stateless – timing and hysteresis live in the session.
 * Head movements never change the phase: only shoulders, hips, knees, feet and hands count.
 * @param {BodyFeatures} f
 * @param {Calibration | null} calib
 * @returns {Phase}
 */
export function classifyPhase(f, calib) {
  if (!f.core) return 'UNKNOWN';
  const rise = shoulderRise(f, calib);
  // Lying needs a flat torso and legs that confirm it. One visible leg is enough (on the side
  // one leg hides the other); with no leg visible at all, legsFlat/legsExtended are null and
  // this stays false – an upper body alone never counts as lying.
  const bodyFlat = f.torsoIncl > PHASES.lyingMinIncl && f.legsFlat === true && f.legsExtended === true;
  if (bodyFlat && (rise === null || rise < PHASES.lyingMaxRise)) return 'LYING';
  if (f.feetUnderBody && f.hipsAboveKnees !== false && !f.handsDown && !f.kneeDown && f.torsoIncl < PHASES.standMaxIncl) {
    return 'STANCE';
  }
  if (rise !== null && rise > PHASES.pushupRise && f.handsDown) return 'PUSHUP';
  return 'TRANSITION';
}
