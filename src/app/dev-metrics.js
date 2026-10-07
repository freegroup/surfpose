// Dev-only performance log (no debug window by design): FPS, inference time, engine mode.

/** @param {string} mode e.g. "worker/GPU" */
export function createDevMetrics(mode) {
  let frames = 0;
  let inferenceTotal = 0;
  let since = performance.now();

  return {
    /** @param {number} inferenceMs */
    record(inferenceMs) {
      frames++;
      inferenceTotal += inferenceMs;
      const elapsed = performance.now() - since;
      if (elapsed < 2000) return;
      console.info(
        `[pose] ${Math.round((frames * 1000) / elapsed)} fps · inference ${Math.round(inferenceTotal / frames)} ms · ${mode}`,
      );
      frames = 0;
      inferenceTotal = 0;
      since = performance.now();
    },
  };
}
