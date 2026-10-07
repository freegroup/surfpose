import { buildProfile } from '../analysis/reference-profile.js';
import { createClipRecorder } from '../clips/clip-recorder.js';
import { renderBadge, renderLogo } from '../clips/clip-overlays.js';
import { listClips, saveClip } from '../clips/clip-store.js';
import { toPoseTrack } from '../clips/pose-track.js';
import { CLIPS } from '../config.js';

/** @typedef {import('../pose/types.js').PoseFrame} PoseFrame */
/** @typedef {import('../analysis/reference-profile.js').Profile} Profile */
/** @typedef {import('../analysis/stance-evaluator.js').StanceMeasurement} StanceMeasurement */
/** @typedef {import('../analysis/stance-evaluator.js').StanceEvaluation} StanceEvaluation */

const seconds = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const STANCE_TEXT = { regular: 'Regular', goofy: 'Goofy' };

/**
 * Training page side of the clips: records a clip around every stand, stores it, and
 * provides the reference profile built from 🎯 clips.
 */
export function createClipsController() {
  const recorder = createClipRecorder(storeClip);
  let videoHeight = 720;

  /** pose frames of the last seconds, sliced into each clip */
  /** @type {PoseFrame[]} */
  let poses = [];
  /** what is known about the pop-up whose clip is being recorded */
  /** @type {{ popupSeconds: number, measurement: StanceMeasurement | null, evaluation: StanceEvaluation | null } | null} */
  let pending = null;
  /** @type {(() => void) | null} */
  let onSaved = null;

  /** @param {import('../clips/clip-recorder.js').RecordedClip} recorded */
  async function storeClip(recorded) {
    recorder.setOverlays({ badge: null });
    const info = pending;
    pending = null;
    const endT = recorded.startT + recorded.duration * 1000 + 50;
    try {
      await saveClip({
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        popupSeconds: info?.popupSeconds ?? 0,
        stance: info?.evaluation?.stance.side ?? null,
        score: info?.evaluation?.score ?? null,
        standOffset: recorded.standOffset,
        duration: recorded.duration,
        video: recorded.video,
        thumbnail: recorded.thumbnail,
        mirrored: true,
        poses: toPoseTrack(poses.filter((p) => p.t >= recorded.startT && p.t <= endT), recorded.startT),
        measurement: info?.measurement ?? null,
        cool: false,
        reference: false,
      });
    } catch (error) {
      console.error('Saving clip failed', error);
    }
    onSaved?.();
  }

  /** @param {string} text */
  async function showBadge(text) {
    recorder.setOverlays({ badge: await renderBadge(text, videoHeight) });
  }

  return {
    /** Reference profile from the 🎯 clips stored on this device. @returns {Promise<Profile>} */
    async loadProfile() {
      const clips = await listClips();
      return buildProfile(
        clips.filter((c) => c.reference && c.measurement).map((c) => /** @type {StanceMeasurement} */ (c.measurement).values),
      );
    },

    /**
     * Starts recording with the running camera.
     * @param {HTMLVideoElement} video
     * @returns {Promise<boolean>} whether this browser can record clips
     */
    async start(video) {
      const ok = await recorder.init(video, { mirror: true });
      if (!ok) return false;
      videoHeight = Math.min(video.videoHeight, CLIPS.maxLongSide);
      recorder.setOverlays({ logo: await renderLogo(videoHeight), badge: null });
      return true;
    },

    /** @param {HTMLVideoElement} video @param {number} t */
    addFrame(video, t) {
      recorder.addFrame(video, t);
    },

    /** @param {PoseFrame | null} frame */
    addPose(frame) {
      if (!frame) return;
      poses.push(frame);
      const keepMs = CLIPS.preMs + CLIPS.postMs + 3000;
      while (poses.length && frame.t - poses[0].t > keepMs) poses.shift();
    },

    /** A new pop-up starts: the running clip ends here, the badge goes away. */
    popupStarted() {
      recorder.finish();
      recorder.setOverlays({ badge: null });
    },

    /** @param {number} standT ms @param {number} popupSeconds */
    popupDone(standT, popupSeconds) {
      pending = { popupSeconds, measurement: null, evaluation: null };
      recorder.trigger(standT);
      showBadge(`${seconds.format(popupSeconds)} s`);
    },

    /** @param {StanceMeasurement} measurement @param {StanceEvaluation} evaluation */
    evaluated(measurement, evaluation) {
      if (!pending) return;
      pending.measurement = measurement;
      pending.evaluation = evaluation;
      const side = evaluation.stance.side;
      showBadge(`${seconds.format(pending.popupSeconds)} s${side ? ` · ${STANCE_TEXT[side]}` : ''}`);
    },

    /** Ends a clip still being recorded and waits until it is saved (max. 5 s). */
    async flush() {
      if (!pending) return;
      const saved = new Promise((resolve) => {
        onSaved = () => resolve(undefined);
      });
      recorder.finish();
      await Promise.race([saved, new Promise((resolve) => setTimeout(resolve, 5000))]);
      onSaved = null;
    },

    stop() {
      recorder.dispose();
    },
  };
}
