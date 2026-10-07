// Dev-only recorder for calibration (no UI by design). In the browser console:
//   okRecord.start()
//   okRecord.stop({ popups: 3, stance: 'regular', note: 'Laptop, Wohnzimmer' })
// downloads a JSON file for tests/fixtures/recordings/.

/** @typedef {import('../pose/types.js').PoseFrame} PoseFrame */

/**
 * What the recording contains – the replay test checks the detection against it.
 * @typedef {{ popups: number, stance?: 'regular' | 'goofy', note?: string }} RecordingExpectation
 */

export function createRecorder() {
  /** @type {PoseFrame[] | null} */
  let frames = null;

  return {
    /** @param {PoseFrame | null} frame */
    add(frame) {
      if (frames && frame) frames.push(frame);
    },

    start() {
      frames = [];
      console.info('[record] started – do your pop-ups, then okRecord.stop({ popups: n, stance })');
    },

    /** @param {RecordingExpectation} expect */
    stop(expect) {
      if (!frames) return;
      const recording = { expect, recordedAt: new Date().toISOString(), frames };
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([JSON.stringify(recording)], { type: 'application/json' }));
      link.download = `recording-${recording.recordedAt.replace(/[:.]/g, '-')}.json`;
      link.click();
      URL.revokeObjectURL(link.href);
      console.info(`[record] saved ${frames.length} frames`);
      frames = null;
    },
  };
}
