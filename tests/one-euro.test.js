import { describe, expect, it } from 'vitest';
import { createOneEuro } from '../src/filter/one-euro.js';

const config = { minCutoff: 1.5, beta: 0.4, dCutoff: 1.0 };

describe('createOneEuro', () => {
  it('passes a constant signal through unchanged', () => {
    const f = createOneEuro(config);
    for (let i = 0; i < 30; i++) expect(f(0.5, i / 30)).toBeCloseTo(0.5, 10);
  });

  it('reduces jitter of a still landmark', () => {
    const f = createOneEuro(config);
    const noisy = Array.from({ length: 120 }, (_, i) => 0.5 + (i % 2 ? 0.01 : -0.01));
    const out = noisy.map((v, i) => f(v, i / 30));
    const spread = (/** @type {number[]} */ xs) => Math.max(...xs) - Math.min(...xs);
    expect(spread(out.slice(30))).toBeLessThan(spread(noisy) / 3);
  });

  it('follows a fast move within a few frames', () => {
    const f = createOneEuro(config);
    for (let i = 0; i < 30; i++) f(0, i / 30);
    let value = 0;
    for (let i = 30; i < 36; i++) value = f(1, i / 30);
    expect(value).toBeGreaterThan(0.9);
  });

  it('ignores a repeated timestamp', () => {
    const f = createOneEuro(config);
    f(0, 1);
    expect(f(1, 1)).toBe(0);
  });
});
