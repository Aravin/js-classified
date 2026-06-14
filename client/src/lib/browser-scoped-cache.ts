export interface BrowserScopedCache<T> {
  get(): T | null;
  set(value: T | null): void;
}

export function createBrowserScopedCache<T>(canUseCache: boolean): BrowserScopedCache<T> {
  let cachedValue: T | null = null;

  return {
    get() {
      return canUseCache ? cachedValue : null;
    },
    set(value) {
      if (!canUseCache) {
        return;
      }

      cachedValue = value;
    },
  };
}