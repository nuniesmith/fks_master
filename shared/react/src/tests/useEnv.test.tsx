import { describe, it, expect } from 'vitest';
import { getRiskThreshold } from '../utils/risk';

describe('risk utils', () => {
  it('uses default when env missing', () => {
    const v = getRiskThreshold(10000);
    expect(v).toBeCloseTo(100); // 1% default
  });
});
