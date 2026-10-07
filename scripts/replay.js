// Usage: npm run replay -- tests/fixtures/recordings/<file>.json
// Prints what the detection makes of a recording – for calibrating thresholds in src/config.js.
import { readFile } from 'node:fs/promises';
import { replay } from '../src/recording/replay.js';

const file = process.argv[2];
if (!file) {
  console.error('Usage: npm run replay -- <recording.json>');
  process.exit(1);
}

const recording = JSON.parse(await readFile(file, 'utf8'));
const { events, popups, stances } = replay(recording.frames);
const t0 = recording.frames[0]?.t ?? 0;
const sec = (/** @type {number} */ t) => ((t - t0) / 1000).toFixed(2).padStart(7);

console.log(`${recording.frames.length} frames, expected: ${JSON.stringify(recording.expect)}\n`);
for (const e of events) {
  const detail = e.type === 'done'
    ? `pop-up ${((e.run.endT - e.run.startT) / 1000).toFixed(2)} s, knee down: ${e.run.kneeDown}`
    : e.type === 'ready' ? `nose ${e.calib.noseDir > 0 ? 'right' : 'left'}, gaze agrees: ${e.calib.gazeAgrees}`
    : e.type === 'start' ? `movement began at ${sec(e.t).trim()} s` : '';
  console.log(`${sec(e.at)} s  ${e.type.padEnd(7)} ${detail}`);
}
console.log(`\ndetected ${popups.length} pop-up(s), front foot: ${stances.map((s) => s.frontFoot).join(', ') || '–'}`);
