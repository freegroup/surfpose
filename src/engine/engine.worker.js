// Worker shell around the engine. Protocol:
//   in:  { type: 'init' } | { type: 'frame', image: ImageBitmap, t: number }
//   out: { type: 'ready', delegate } | { type: 'result', result } | { type: 'error', message }
import { createMediaPipeSource } from '../pose/mediapipe-source.js';
import { createEngine } from './engine.js';

const source = createMediaPipeSource({ canvas: new OffscreenCanvas(1, 1) });
const engine = createEngine(source);

self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'init') {
      await engine.init();
      self.postMessage({ type: 'ready', delegate: source.delegate() });
    } else if (data.type === 'frame') {
      const result = engine.process(data.image, data.t);
      data.image.close();
      self.postMessage({ type: 'result', result });
    }
  } catch (error) {
    self.postMessage({ type: 'error', message: String(error) });
  }
};
