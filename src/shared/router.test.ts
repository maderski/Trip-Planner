import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type HashChangeListener = () => void;

function installTestGlobals() {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { clear() {} },
  });
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: { clear() {} },
  });
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      body: { innerHTML: '' },
      documentElement: { removeAttribute() {} },
    },
  });
}

installTestGlobals();

function createWindowMock(initialHash = '') {
  const listeners = new Set<HashChangeListener>();
  let hash = initialHash;

  const windowMock = {
    location: {
      get hash() {
        return hash;
      },
      set hash(value: string) {
        hash = value.startsWith('#') ? value : `#${value}`;
      },
    },
    addEventListener(event: string, listener: HashChangeListener) {
      if (event === 'hashchange') {
        listeners.add(listener);
      }
    },
    dispatchHashChange() {
      listeners.forEach((listener) => listener());
    },
  };

  return windowMock;
}

describe('router', () => {
  let windowMock: ReturnType<typeof createWindowMock>;

  beforeEach(() => {
    vi.resetModules();
    windowMock = createWindowMock();
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: windowMock,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { location: { hash: '' } },
    });
  });

  it('returns the current valid route and falls back to trip for invalid hashes', async () => {
    const { getCurrentRoute } = await import('./router');

    windowMock.location.hash = 'calendar';
    expect(getCurrentRoute()).toBe('calendar');

    windowMock.location.hash = 'unknown';
    expect(getCurrentRoute()).toBe('trip');

    windowMock.location.hash = '';
    expect(getCurrentRoute()).toBe('trip');
  });

  it('updates the hash when navigating', async () => {
    const { navigateTo } = await import('./router');

    navigateTo('restaurants');

    expect(windowMock.location.hash).toBe('#restaurants');
  });

  it('calls the handler immediately and on subsequent route changes', async () => {
    windowMock.location.hash = 'settings';
    const { initRouter } = await import('./router');
    const handler = vi.fn();

    initRouter(handler);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenLastCalledWith('settings');

    windowMock.location.hash = 'calendar';
    windowMock.dispatchHashChange();
    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler).toHaveBeenLastCalledWith('calendar');
  });

  it('ignores repeated hashes and normalizes invalid routes back to trip', async () => {
    windowMock.location.hash = 'calendar';
    const { initRouter } = await import('./router');
    const handler = vi.fn();

    initRouter(handler);
    handler.mockClear();

    windowMock.location.hash = 'calendar';
    windowMock.dispatchHashChange();
    expect(handler).not.toHaveBeenCalled();

    windowMock.location.hash = 'not-a-route';
    windowMock.dispatchHashChange();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenLastCalledWith('trip');
  });
});
