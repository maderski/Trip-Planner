// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppData } from './types.ts';

function makeAppData(): AppData {
  return {
    version: 2,
    activeTripId: 'trip-1',
    trips: [
      {
        version: 1,
        id: 'trip-1',
        destination: {
          name: 'Lisbon',
          startDate: '',
          endDate: '',
          notes: '',
          image: '',
          mapLink: '',
          photos: [],
        },
        events: [],
        accommodations: [],
        restaurants: [],
      },
    ],
  };
}

type SnapshotSuccess = (snap: { exists: () => boolean; data: () => { data: AppData; clientWriteId?: string } }) => void;
type SnapshotError = (error: unknown) => void;

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

async function loadSyncModule(options: {
  configured?: boolean;
  setDocImpl?: () => Promise<void>;
  getDocResult?: { exists: boolean; data?: { data: AppData } };
} = {}) {
  vi.resetModules();

  const setDoc = vi.fn(async () => {
    await options.setDocImpl?.();
  });
  const getDoc = vi.fn(async () => ({
    exists: () => options.getDocResult?.exists ?? false,
    data: () => options.getDocResult?.data ?? { data: makeAppData() },
  }));
  const unsubscribe = vi.fn();
  const docRef = { collection: 'planners', id: 'planner-doc-id' };
  const doc = vi.fn(() => docRef);
  const serverTimestamp = vi.fn(() => 'server-ts');

  let onSnapshotSuccess: SnapshotSuccess | undefined;
  let onSnapshotError: SnapshotError | undefined;

  const onSnapshot = vi.fn((_ref, success: SnapshotSuccess, error: SnapshotError) => {
    onSnapshotSuccess = success;
    onSnapshotError = error;
    return unsubscribe;
  });

  const isFirebaseConfigured = vi.fn(() => options.configured ?? true);
  const getDb = vi.fn(() => ({ name: 'db' }));
  const normalizePasscode = vi.fn((value: string) => value.trim().toUpperCase());

  vi.doMock('firebase/firestore', () => ({
    doc,
    getDoc,
    onSnapshot,
    serverTimestamp,
    setDoc,
  }));

  vi.doMock('./firebase.ts', () => ({
    getDb,
    isFirebaseConfigured,
  }));

  vi.doMock('./passcode.ts', () => ({
    normalizePasscode,
  }));

  const sync = await import('./sync.ts');

  return {
    sync,
    mocks: {
      doc,
      getDb,
      getDoc,
      isFirebaseConfigured,
      normalizePasscode,
      onSnapshot,
      onSnapshotError: (error: unknown) => onSnapshotError?.(error),
      onSnapshotSuccess: (payload: { exists: boolean; data: AppData; clientWriteId?: string }) =>
        onSnapshotSuccess?.({
          exists: () => payload.exists,
          data: () => ({ data: payload.data, clientWriteId: payload.clientWriteId }),
        }),
      serverTimestamp,
      setDoc,
      unsubscribe,
    },
  };
}

describe('sync', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: createStorageMock(),
    });
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('stays disabled when Firebase is not configured', async () => {
    const { sync, mocks } = await loadSyncModule({ configured: false });

    expect(sync.isSyncEnabled()).toBe(false);
    expect(sync.getSyncState()).toMatchObject({
      status: 'disabled',
      detail: 'Firebase is not configured. The app is running locally only.',
      lastSyncedAt: null,
    });
    await expect(sync.pushToCloud(' 1234 ', makeAppData())).resolves.toBe(false);
    await expect(sync.pullFromCloud(' 1234 ')).resolves.toBeNull();
    await expect(sync.startListening(' 1234 ', vi.fn())).resolves.toBeUndefined();
    expect(mocks.getDb).not.toHaveBeenCalled();
    expect(mocks.onSnapshot).not.toHaveBeenCalled();
  });

  it('pushes app data to Firestore and emits status changes on success', async () => {
    const events: Array<string> = [];
    document.addEventListener('sync-status-changed', ((event: Event) => {
      const detail = (event as CustomEvent).detail as { status: string };
      events.push(detail.status);
    }) as EventListener);

    const { sync, mocks } = await loadSyncModule();
    const app = makeAppData();

    await expect(sync.pushToCloud(' 1234 ', app)).resolves.toBe(true);

    expect(mocks.normalizePasscode).toHaveBeenCalledWith(' 1234 ');
    expect(mocks.doc).toHaveBeenCalledWith({ name: 'db' }, 'planners', expect.any(String));
    expect(mocks.serverTimestamp).toHaveBeenCalledTimes(1);
    expect(mocks.setDoc).toHaveBeenCalledWith(docRefMatcher(), {
      data: app,
      version: 2,
      updatedAt: 'server-ts',
      clientWriteId: expect.any(String),
    });
    expect(events).toEqual(['syncing', 'synced']);
    expect(sync.getSyncState().status).toBe('synced');
    expect(sync.getSyncState().lastSyncedAt).toEqual(expect.any(String));
  });

  it('returns null and moves back to idle when no remote workspace exists', async () => {
    const { sync } = await loadSyncModule({ getDocResult: { exists: false } });

    await expect(sync.pullFromCloud('shared')).resolves.toBeNull();
    expect(sync.getSyncState()).toMatchObject({
      status: 'idle',
      detail: 'No remote workspace exists yet.',
    });
  });

  it('updates local storage and invokes the remote change callback for collaborator writes only', async () => {
    const remoteChange = vi.fn();
    const { sync, mocks } = await loadSyncModule();
    const app = makeAppData();

    await sync.pushToCloud('team-code', app);
    await sync.startListening('team-code', remoteChange);

    const setDocCalls = mocks.setDoc.mock.calls as unknown[][];
    const setDocPayload = setDocCalls[0]?.[1];
    expect(setDocPayload).toBeDefined();
    const writePayload = setDocPayload as { clientWriteId: string };
    mocks.onSnapshotSuccess({
      exists: true,
      data: {
        ...app,
        activeTripId: 'trip-remote-ignored',
      },
      clientWriteId: writePayload.clientWriteId,
    });
    expect(remoteChange).not.toHaveBeenCalled();
    expect(localStorage.getItem('trip-planner-data')).toBeNull();

    const remoteApp = {
      ...app,
      activeTripId: 'trip-remote',
    };
    mocks.onSnapshotSuccess({
      exists: true,
      data: remoteApp,
      clientWriteId: 'different-write',
    });

    expect(localStorage.getItem('trip-planner-data')).toBe(JSON.stringify(remoteApp));
    expect(remoteChange).toHaveBeenCalledTimes(1);
    expect(sync.getSyncState()).toMatchObject({
      status: 'synced',
      detail: 'Shared workspace updated.',
    });
  });

  it('surfaces listener failures and restores idle state when listening stops', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { sync, mocks } = await loadSyncModule();

    await sync.startListening('team-code', vi.fn());
    expect(sync.getSyncState()).toMatchObject({
      status: 'idle',
      detail: 'Listening for collaborator updates.',
    });

    mocks.onSnapshotError(new Error('network'));
    expect(errorSpy).toHaveBeenCalled();
    expect(sync.getSyncState()).toMatchObject({
      status: 'error',
      detail: 'Live sync connection failed.',
    });

    sync.stopListening();
    expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
    expect(sync.getSyncState()).toMatchObject({
      status: 'idle',
      detail: 'Cloud sync is ready.',
    });
  });
});

function docRefMatcher() {
  return expect.objectContaining({
    collection: 'planners',
    id: expect.any(String),
  });
}
