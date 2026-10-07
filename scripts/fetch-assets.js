// Puts the pose model and the MediaPipe runtime into public/, so the app loads
// everything from our own server (privacy promise, no CDN). Runs on `npm install`.
import { copyFile, mkdir, stat, writeFile } from 'node:fs/promises';

// Pinned model version – the model is fixed in operation, never "latest".
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task';
const MODEL_FILE = 'public/models/pose_landmarker_full.task';
const WASM_SRC = 'node_modules/@mediapipe/tasks-vision/wasm';
const WASM_DEST = 'public/mediapipe';
// module variant for the engine worker, classic variant for the main-thread fallback
const WASM_FILES = [
  'vision_wasm_module_internal.js',
  'vision_wasm_module_internal.wasm',
  'vision_wasm_internal.js',
  'vision_wasm_internal.wasm',
];

/** @param {string} path */
const exists = (path) => stat(path).then(() => true, () => false);

await mkdir(WASM_DEST, { recursive: true });
for (const file of WASM_FILES) {
  await copyFile(`${WASM_SRC}/${file}`, `${WASM_DEST}/${file}`);
}

if (!(await exists(MODEL_FILE))) {
  await mkdir('public/models', { recursive: true });
  const response = await fetch(MODEL_URL);
  if (!response.ok) throw new Error(`Model download failed: ${response.status}`);
  await writeFile(MODEL_FILE, new Uint8Array(await response.arrayBuffer()));
}

console.log('Pose model and MediaPipe runtime ready in public/.');
