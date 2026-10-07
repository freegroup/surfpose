// Personal model from developer.html: a complete STANCE_CRITERIA object in localStorage.
// While it exists it replaces the config and the 🎯 reference clips everywhere.
import { buildProfile, developerProfile } from '../analysis/reference-profile.js';

/** @typedef {import('../analysis/reference-profile.js').Criteria} Criteria */

const STORAGE_KEY = 'ok-dev-criteria';

/** @returns {Criteria | null} null when none is saved */
export function loadDevCriteria() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    return saved && typeof saved === 'object' && Object.keys(saved).length ? saved : null;
  } catch {
    return null;
  }
}

/** @param {Criteria} criteria */
export function saveDevCriteria(criteria) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(criteria));
}

export function clearDevCriteria() {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * The model to score with: the saved developer model if there is one, otherwise the profile
 * from the 🎯 clips (or the starting values).
 * @param {Record<string, number | boolean | null>[]} clipReferences  `values` of the 🎯 clips
 */
export function activeProfile(clipReferences) {
  const developer = loadDevCriteria();
  return developer ? developerProfile(developer) : buildProfile(clipReferences);
}
