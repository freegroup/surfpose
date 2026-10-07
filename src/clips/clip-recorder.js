// Main-thread side of the clip worker: hands every camera frame over and asks for a clip
// when a stand is detected. Only one clip is captured at a time.
import { CLIPS } from '../config.js';

/**
 * @typedef {object} RecordedClip
 * @property {Blob} video        MP4
 * @property {Blob | null} thumbnail
 * @property {number} startT     timestamp of the first frame, ms (same clock as the engine)
 * @property {number} standOffset seconds from the start of the video to the stand
 * @property {number} duration   seconds
 */

export const clipsSupported = () =>
  typeof VideoEncoder === 'function' && typeof VideoFrame === 'function' && typeof OffscreenCanvas === 'function';

/** @param {(clip: RecordedClip) => void} onClip */
export function createClipRecorder(onClip) {
  /** @type {Worker | null} */
  let worker = null;

  return {
    /**
     * @param {HTMLVideoElement} video  the running camera
     * @param {{ mirror: boolean }} options
     * @returns {Promise<boolean>} false when the browser can't encode H.264
     */
    async init(video, { mirror }) {
      if (!clipsSupported()) return false;
      const scale = Math.min(1, CLIPS.maxLongSide / Math.max(video.videoWidth, video.videoHeight));
      // H.264 needs even dimensions
      const even = (/** @type {number} */ n) => Math.round((n * scale) / 2) * 2;

      const w = new Worker(new URL('./clip-worker.js', import.meta.url), { type: 'module' });
      const supported = await new Promise((resolve) => {
        w.onmessage = ({ data }) => data.type === 'ready' && resolve(data.supported);
        w.onerror = () => resolve(false);
        w.postMessage({ type: 'init', width: even(video.videoWidth), height: even(video.videoHeight), mirror });
      });
      if (!supported) {
        w.terminate();
        return false;
      }
      w.onmessage = ({ data }) => {
        if (data.type === 'clip') {
          onClip({
            video: new Blob([data.mp4], { type: 'video/mp4' }),
            thumbnail: data.thumbnail,
            startT: data.startT,
            standOffset: data.standOffset,
            duration: data.duration,
          });
        } else if (data.type === 'error') {
          console.error('Clip worker', data.message);
        }
      };
      worker = w;
      return true;
    },

    /** @param {HTMLVideoElement} video @param {number} t frame timestamp in ms */
    addFrame(video, t) {
      if (!worker) return;
      const frame = new VideoFrame(video, { timestamp: Math.round(t * 1000) });
      worker.postMessage({ type: 'frame', frame, t }, [frame]);
    },

    /** @param {{ logo?: ImageBitmap | null, badge?: ImageBitmap | null }} overlays */
    setOverlays(overlays) {
      const transfer = Object.values(overlays).filter((b) => b instanceof ImageBitmap);
      worker?.postMessage({ type: 'overlay', ...overlays }, transfer);
    },

    /** Starts capturing a clip around the stand at `standT` (ms). */
    trigger(/** @type {number} */ standT) {
      worker?.postMessage({ type: 'trigger', standT });
    },

    /** Ends the current clip now (next pop-up, or the camera stops). */
    finish() {
      worker?.postMessage({ type: 'finish' });
    },

    dispose() {
      worker?.postMessage({ type: 'finish' });
      const w = worker;
      worker = null;
      // let the last clip be muxed and posted before the worker goes away
      setTimeout(() => w?.terminate(), 3000);
    },
  };
}
