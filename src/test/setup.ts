import { beforeEach, vi } from 'vitest';
if (!globalThis.crypto && typeof window !== 'undefined' && window.crypto) {
  Object.defineProperty(globalThis, 'crypto', {
    value: window.crypto,
    configurable: true,
  });
}

beforeEach(() => {
  const local = globalThis.localStorage as Storage | { clear?: () => void } | undefined;
  const session = globalThis.sessionStorage as Storage | { clear?: () => void } | undefined;
  local?.clear?.();
  session?.clear?.();
  document.documentElement?.removeAttribute?.('data-theme');
  if (document.body) {
    document.body.innerHTML = '';
  }
  if (globalThis.window?.location) {
    window.location.hash = '';
  }
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
