import { describe, it, expect } from 'vitest';

describe('Tremor Raw chart components', () => {
  it('AreaChart module exports correctly', async () => {
    const mod = await import('@/components/tremor/AreaChart');
    expect(mod.AreaChart).toBeDefined();
    expect(typeof mod.AreaChart).toBe('object'); // forwardRef
  });

  it('BarChart module exports correctly', async () => {
    const mod = await import('@/components/tremor/BarChart');
    expect(mod.BarChart).toBeDefined();
  });

  it('DonutChart module exports correctly', async () => {
    const mod = await import('@/components/tremor/DonutChart');
    expect(mod.DonutChart).toBeDefined();
  });

  it('CategoryBar module exports correctly', async () => {
    const mod = await import('@/components/tremor/CategoryBar');
    expect(mod.CategoryBar).toBeDefined();
  });

  it('BarList module exports correctly', async () => {
    const mod = await import('@/components/tremor/BarList');
    expect(mod.BarList).toBeDefined();
  });

  it('barrel export re-exports all components', async () => {
    const mod = await import('@/components/tremor');
    expect(mod.AreaChart).toBeDefined();
    expect(mod.BarChart).toBeDefined();
    expect(mod.DonutChart).toBeDefined();
    expect(mod.CategoryBar).toBeDefined();
    expect(mod.BarList).toBeDefined();
  });
});
