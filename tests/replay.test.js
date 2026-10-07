// Every recording in tests/fixtures/recordings/ becomes a regression test.
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { replay } from '../src/recording/replay.js';

const dir = new URL('./fixtures/recordings/', import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));

describe('recorded pop-ups', () => {
  it.skipIf(files.length > 0)('no recordings yet (plan step 5)', () => {});

  for (const file of files) {
    it(file, () => {
      const recording = JSON.parse(readFileSync(new URL(file, dir), 'utf8'));
      const { popups, stances } = replay(recording.frames);
      expect(popups).toHaveLength(recording.expect.popups);
      if (recording.expect.stance) {
        const expectedFoot = recording.expect.stance === 'regular' ? 'left' : 'right';
        expect(stances.every((s) => s.frontFoot === expectedFoot)).toBe(true);
      }
    });
  }
});
