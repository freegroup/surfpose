/**
 * Calls onFrame once per new video frame with the frame's timestamp in ms
 * (camera capture time where the browser provides it). Returns a stop function.
 * @param {HTMLVideoElement} video
 * @param {(t: number) => void} onFrame
 */
export function startFrameLoop(video, onFrame) {
  let stopped = false;

  // not available in older browsers, although the DOM types always declare it
  if (typeof video.requestVideoFrameCallback === 'function') {
    /** @type {VideoFrameRequestCallback} */
    const tick = (now, meta) => {
      if (stopped) return;
      onFrame(meta.captureTime ?? now);
      handle = video.requestVideoFrameCallback(tick);
    };
    let handle = video.requestVideoFrameCallback(tick);
    return () => {
      stopped = true;
      video.cancelVideoFrameCallback(handle);
    };
  }

  // Fallback: poll on animation frames and detect new frames by currentTime
  let lastVideoTime = -1;
  /** @param {number} now */
  const tick = (now) => {
    if (stopped) return;
    if (video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      onFrame(now);
    }
    handle = requestAnimationFrame(tick);
  };
  let handle = requestAnimationFrame(tick);
  return () => {
    stopped = true;
    cancelAnimationFrame(handle);
  };
}
