// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppData, TripData } from './types.ts';

const pushToCloud = vi.fn<(...args: unknown[]) => Promise<boolean>>().mockResolvedValue(true);
const isSyncEnabled = vi.fn<() => boolean>(() => false);
const normalizePasscode = vi.fn((value: string) => value.trim());

vi.mock('./sync.ts', () => ({
  isSyncEnabled,
  pushToCloud,
}));

vi.mock('./passcode.ts', () => ({
  normalizePasscode,
}));

function makeTrip(overrides: Partial<TripData> = {}): TripData {
  return {
    version: 1,
    id: overrides.id ?? 'trip-1',
    destination: {
      name: '',
      startDate: '',
      endDate: '',
      notes: '',
      image: '',
      mapLink: '',
      photos: [],
      ...overrides.destination,
    },
    events: overrides.events ?? [],
    accommodations: overrides.accommodations ?? [],
    restaurants: overrides.restaurants ?? [],
  };
}

function createStorageMock(): Storage {
  const store = new Map<string, string>();

  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}

function readStoredApp(): AppData {
  const raw = localStorage.getItem('trip-planner-data');
  expect(raw).not.toBeNull();
  return JSON.parse(raw as string) as AppData;
}

describe('storage', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: createStorageMock(),
    });
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: createStorageMock(),
    });
    localStorage.clear();
    sessionStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    pushToCloud.mockClear();
    pushToCloud.mockResolvedValue(true);
    isSyncEnabled.mockReset();
    isSyncEnabled.mockReturnValue(false);
    normalizePasscode.mockClear();
    normalizePasscode.mockImplementation((value: string) => value.trim());
  });

  it('migrates legacy trip payloads into app data on load', async () => {
    const legacyTrip = makeTrip({ id: '' });
    localStorage.setItem('trip-planner-data', JSON.stringify(legacyTrip));

    const storage = await import('./storage.ts');
    const trip = storage.loadData();
    const storedApp = readStoredApp();

    expect(trip.destination).toEqual(legacyTrip.destination);
    expect(trip.id).toBeTruthy();
    expect(storedApp).toMatchObject({
      version: 2,
      activeTripId: trip.id,
    });
    expect(storedApp.trips).toHaveLength(1);
    expect(storedApp.trips[0]).toMatchObject({
      ...legacyTrip,
      id: trip.id,
    });
  });

  it('normalizes malformed app data with missing trip ids and stale active trip selection', async () => {
    localStorage.setItem(
      'trip-planner-data',
      JSON.stringify({
        version: 2,
        trips: [{ ...makeTrip({ id: '' }), destination: { ...makeTrip().destination, name: 'Paris' } }],
        activeTripId: 'missing-trip',
      } satisfies Omit<AppData, 'trips'> & { trips: Array<Omit<TripData, 'id'> & { id: string }> })
    );

    const storage = await import('./storage.ts');
    const trips = storage.getAllTrips();
    const activeTripId = storage.getActiveTripId();
    const storedApp = readStoredApp();

    expect(trips).toHaveLength(1);
    expect(trips[0].id).toBeTruthy();
    expect(activeTripId).toBe(trips[0].id);
    expect(storedApp.activeTripId).toBe(trips[0].id);
    expect(storedApp.trips[0].destination.name).toBe('Paris');
  });

  it('pushes updated active trip data to cloud when sync is enabled and a passcode exists', async () => {
    const existing = makeTrip({ id: 'trip-a', destination: { ...makeTrip().destination, name: 'Rome' } });
    localStorage.setItem(
      'trip-planner-data',
      JSON.stringify({
        version: 2,
        trips: [existing],
        activeTripId: existing.id,
      } satisfies AppData)
    );
    localStorage.setItem('trip-planner-passcode', '  shared-code  ');
    isSyncEnabled.mockReturnValue(true);

    const storage = await import('./storage.ts');
    const nextTrip = makeTrip({ id: 'ignored-id', destination: { ...existing.destination, name: 'Tokyo' } });

    storage.saveData(nextTrip);

    const storedApp = readStoredApp();
    expect(storedApp.trips[0]).toMatchObject({
      version: 1,
      id: existing.id,
      destination: expect.objectContaining({ name: 'Tokyo' }),
    });
    expect(pushToCloud).toHaveBeenCalledTimes(1);
    expect(pushToCloud).toHaveBeenCalledWith('shared-code', storedApp);
  });

  it('does not change the active trip when an unknown id is selected', async () => {
    const first = makeTrip({ id: 'trip-a' });
    const second = makeTrip({ id: 'trip-b', destination: { ...makeTrip().destination, name: 'Kyoto' } });
    localStorage.setItem(
      'trip-planner-data',
      JSON.stringify({
        version: 2,
        trips: [first, second],
        activeTripId: first.id,
      } satisfies AppData)
    );

    const storage = await import('./storage.ts');
    storage.setActiveTripId('missing');

    expect(storage.getActiveTripId()).toBe(first.id);
    expect(pushToCloud).not.toHaveBeenCalled();
  });

  it('surfaces import failures without overwriting existing stored data', async () => {
    const originalApp: AppData = {
      version: 2,
      trips: [makeTrip({ id: 'trip-original' })],
      activeTripId: 'trip-original',
    };
    localStorage.setItem('trip-planner-data', JSON.stringify(originalApp));

    const storage = await import('./storage.ts');
    const result = storage.importData('{not-json');

    expect(result).toBe(false);
    expect(readStoredApp()).toEqual(originalApp);
  });

  it('stores normalized passcodes, session state, and theme attributes', async () => {
    const storage = await import('./storage.ts');

    storage.setPasscode(' 4321 ');
    expect(storage.getPasscode()).toBe('4321');
    expect(localStorage.getItem('trip-planner-passcode')).toBe('4321');

    expect(storage.isSessionValid()).toBe(false);
    storage.setSession();
    expect(storage.isSessionValid()).toBe(true);

    expect(storage.getTheme()).toBe('dark');
    storage.setTheme('light');
    expect(localStorage.getItem('trip-planner-theme')).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    localStorage.setItem('trip-planner-theme', 'sunset');
    storage.initTheme();
    expect(document.documentElement.getAttribute('data-theme')).toBe('sunset');
  });
});
