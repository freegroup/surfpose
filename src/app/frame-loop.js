/**
 * Calls onFrame once per new video frame with the frame's timestamp in ms
 * (camera capture time where the browser provides it). Returns a stop function.
 * The next frame is requested before onFrame runs, so an error in one frame never stops the loop.
 * @param {HTMLVideoElement} video
 * @param {(t: number) => void} onFrame
 */
export function startFrameLoop(video, onFrame) {
  let stopped = false;

  /** @param {number} t */
  const handle = (t) => {
    try {
      onFrame(t);
    } catch (error) {
      console.error('Frame failed', error);
    }
  };

  // not available in older browsers, although the DOM types always declare it
  if (typeof video.requestVideoFrameCallback === 'function') {
    /** @type {VideoFrameRequestCallback} */
    const tick = (now, meta) => {
      if (stopped) return;
      id = video.requestVideoFrameCallback(tick);
      handle(meta.captureTime ?? now);
    };
    let id = video.requestVideoFrameCallback(tick);
    return () => {
      stopped = true;
      video.cancelVideoFrameCallback(id);
    };
  }

  // Fallback: poll on animation frames and detect new frames by currentTime
  let lastVideoTime = -1;
  /** @param {number} now */
  const tick = (now) => {
    if (stopped) return;
    id = requestAnimationFrame(tick);
    if (video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      handle(now);
    }
  };
  let id = requestAnimationFrame(tick);
  return () => {
    stopped = true;
    cancelAnimationFrame(id);
  };
}
