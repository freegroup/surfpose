import { describe, expect, it } from 'vitest';
import { angle3, angleBetween, inclination, median } from '../src/analysis/geometry.js';

const o = { x: 0, y: 0, z: 0 };

describe('geometry', () => {
  it('angle3 measures the angle at the middle point', () => {
    expect(angle3({ x: 1, y: 0, z: 0 }, o, { x: 0, y: 1, z: 0 })).toBeCloseTo(90);
    expect(angle3({ x: 1, y: 0, z: 0 }, o, { x: -1, y: 0, z: 0 })).toBeCloseTo(180);
    expect(angle3({ x: 0, y: 0, z: 1 }, o, { x: 0, y: 0, z: 1 })).toBeCloseTo(0);
  });

  it('angleBetween compares two directions', () => {
    expect(angleBetween(o, { x: 0, y: -1, z: 0 }, o, { x: 0, y: -2, z: 0 })).toBeCloseTo(0);
    expect(angleBetween(o, { x: 0, y: -1, z: 0 }, o, { x: 1, y: 0, z: 0 })).toBeCloseTo(90);
  });

  it('inclination is 0 upright and 90 horizontal (image y points down)', () => {
    expect(inclination({ x: 0, y: 100 }, { x: 0, y: 0 })).toBeCloseTo(0);
    expect(inclination({ x: 0, y: 0 }, { x: 100, y: 0 })).toBeCloseTo(90);
    expect(inclination({ x: 0, y: 0 }, { x: -100, y: 0 })).toBeCloseTo(90);
    expect(inclination({ x: 0, y: 100 }, { x: 100, y: 0 })).toBeCloseTo(45);
  });

  it('median handles odd, even and empty lists', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNaN();
  });
});
