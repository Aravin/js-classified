import { describe, expect, it } from 'vitest';
import { createBrowserScopedCache } from './browser-scoped-cache';

describe('createBrowserScopedCache', () => {
  it('stores and returns values when running in the browser', () => {
    const cache = createBrowserScopedCache<{ points: number }>(true);

    cache.set({ points: 22 });

    expect(cache.get()).toEqual({ points: 22 });
  });

  it('ignores writes and always returns null outside the browser', () => {
    const cache = createBrowserScopedCache<{ points: number }>(false);

    cache.set({ points: 22 });

    expect(cache.get()).toBeNull();
  });
});