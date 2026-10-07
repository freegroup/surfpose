// Main-thread facade of the engine: runs it in a worker, or in the main thread if the
// worker cannot start (e.g. no OffscreenCanvas). Callers don't notice the difference.

/** @typedef {import('./engine.js').EngineResult} EngineResult */
/** @typedef {{ mode: 'worker' | 'main', delegate: 'GPU' | 'CPU' | null }} EngineInfo */

/** @param {(result: EngineResult) => void} onResult */
export function createEngineClient(onResult) {
  /** @type {Worker | null} */
  let worker = null;
  /** @type {ReturnType<typeof import('./engine.js').createEngine> | null} */
  let local = null;
  let busy = false;

  /** @returns {Promise<'GPU' | 'CPU' | null>} */
  function startWorker() {
    const w = new Worker(new URL('./engine.worker.js', import.meta.url), { type: 'module' });
    worker = w;
    return new Promise((resolve, reject) => {
      w.onerror = (event) => reject(new Error(event.message || 'worker failed to start'));
      w.onmessage = ({ data }) => {
        if (data.type === 'ready') resolve(data.delegate);
        else if (data.type === 'error') reject(new Error(data.message));
      };
      w.postMessage({ type: 'init' });
    });
  }

  async function startLocal() {
    const [{ createEngine }, { createMediaPipeSource }] = await Promise.all([
      import('./engine.js'),
      import('../pose/mediapipe-source.js'),
    ]);
    const source = createMediaPipeSource();
    local = createEngine(source);
    await local.init();
    return source.delegate();
  }

  return {
    /** @returns {Promise<EngineInfo>} */
    async init() {
      try {
        const delegate = await startWorker();
        /** @type {Worker} */ (worker).onmessage = ({ data }) => {
          busy = false;
          if (data.type === 'result') onResult(data.result);
          else console.error('Engine error', data.message);
        };
        return { mode: 'worker', delegate };
      } catch (error) {
        console.warn('Engine worker unavailable, running in main thread', error);
        worker?.terminate();
        worker = null;
        return { mode: 'main', delegate: await startLocal() };
      }
    },

    /** At most one frame is in flight – check before grabbing a new one. */
    isBusy: () => busy,

    /**
     * Hands the frame over (transferred, the caller must not use it afterwards).
     * @param {ImageBitmap} image
     * @param {number} t frame timestamp in ms
     */
    submit(image, t) {
      busy = true;
      if (worker) {
        worker.postMessage({ type: 'frame', image, t }, [image]);
        return;
      }
      const result = /** @type {NonNullable<typeof local>} */ (local).process(image, t);
      image.close();
      busy = false;
      onResult(result);
    },

    dispose() {
      worker?.terminate();
      worker = null;
    },
  };
}
