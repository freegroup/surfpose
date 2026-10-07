// Clips live in IndexedDB on this device only. Unmarked clips are capped (oldest go first),
// 🤙 cool and 🎯 reference clips are never removed automatically.
import { CLIPS } from '../config.js';

/** @typedef {import('./pose-track.js').PoseTrack} PoseTrack */
/** @typedef {import('../analysis/stance-evaluator.js').StanceMeasurement} StanceMeasurement */

/**
 * @typedef {object} Clip
 * @property {string} id
 * @property {number} createdAt      epoch ms
 * @property {number} popupSeconds
 * @property {'regular' | 'goofy' | null} stance
 * @property {number | null} score
 * @property {number} standOffset    seconds into the video
 * @property {number} duration       seconds
 * @property {Blob} video            MP4
 * @property {Blob | null} thumbnail
 * @property {boolean} mirrored      video shows the mirrored camera image
 * @property {PoseTrack} poses
 * @property {StanceMeasurement | null} measurement
 * @property {boolean} cool
 * @property {boolean} reference
 */

const DB_NAME = 'ok-clips';
const STORE = 'clips';

/** @type {Promise<IDBDatabase> | null} */
let dbPromise = null;

function db() {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

/**
 * @template T
 * @param {IDBTransactionMode} mode
 * @param {(store: IDBObjectStore) => IDBRequest<T>} op
 * @returns {Promise<T>}
 */
async function run(mode, op) {
  const store = (await db()).transaction(STORE, mode).objectStore(STORE);
  return new Promise((resolve, reject) => {
    const request = op(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** @param {Clip} clip */
const isMarked = (clip) => clip.cool || clip.reference;

/** @returns {Promise<Clip[]>} newest first */
export async function listClips() {
  const clips = await run('readonly', (s) => s.getAll());
  return clips.sort((a, b) => b.createdAt - a.createdAt);
}

/** Deletes the oldest unmarked clips beyond `keep`. @param {number} keep */
async function prune(keep) {
  const unmarked = (await listClips()).filter((c) => !isMarked(c));
  for (const clip of unmarked.slice(keep)) await deleteClip(clip.id);
}

/**
 * Saves a clip; on a full storage the oldest unmarked clips make room.
 * @param {Clip} clip
 * @returns {Promise<boolean>} false when there is no room even after cleaning up
 */
export async function saveClip(clip) {
  navigator.storage?.persist?.(); // ask the browser not to evict our data
  let keep = CLIPS.maxClips - 1;
  for (;;) {
    await prune(keep);
    try {
      await run('readwrite', (s) => s.put(clip));
      await prune(CLIPS.maxClips);
      return true;
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'QuotaExceededError') || keep === 0) throw error;
      keep = Math.max(0, keep - 3);
    }
  }
}

/**
 * @param {string} id
 * @param {Partial<Pick<Clip, 'cool' | 'reference'>>} patch
 */
export async function updateClip(id, patch) {
  const clip = await run('readonly', (s) => s.get(id));
  if (!clip) return;
  await run('readwrite', (s) => s.put({ ...clip, ...patch }));
  if (patch.cool === false || patch.reference === false) await prune(CLIPS.maxClips);
}

/** @param {string} id */
export function deleteClip(id) {
  return run('readwrite', (s) => s.delete(id));
}
