import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const initializeApp = vi.fn();
const getFirestore = vi.fn();

vi.mock('firebase/app', () => ({
  initializeApp,
}));

vi.mock('firebase/firestore', () => ({
  getFirestore,
}));

async function importFirebaseModule() {
  return import('./firebase.ts');
}

describe('firebase config helpers', () => {
  beforeEach(() => {
    vi.resetModules();
    initializeApp.mockReset();
    getFirestore.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reports missing env vars when firebase is not configured', async () => {
    const firebase = await importFirebaseModule();

    expect(firebase.getFirebaseConfigErrors()).toEqual([
      'VITE_FIREBASE_API_KEY',
      'VITE_FIREBASE_AUTH_DOMAIN',
      'VITE_FIREBASE_PROJECT_ID',
      'VITE_FIREBASE_STORAGE_BUCKET',
      'VITE_FIREBASE_MESSAGING_SENDER_ID',
      'VITE_FIREBASE_APP_ID',
    ]);
    expect(firebase.isFirebaseConfigured()).toBe(false);
    expect(() => firebase.getDb()).toThrowError(
      'Firebase is not configured. Missing: VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_STORAGE_BUCKET, VITE_FIREBASE_MESSAGING_SENDER_ID, VITE_FIREBASE_APP_ID'
    );
  });

  it('initializes firestore once when env vars are present', async () => {
    vi.stubEnv('VITE_FIREBASE_API_KEY', 'api-key');
    vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', 'planner.firebaseapp.com');
    vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'planner');
    vi.stubEnv('VITE_FIREBASE_STORAGE_BUCKET', 'planner.firebasestorage.app');
    vi.stubEnv('VITE_FIREBASE_MESSAGING_SENDER_ID', '123');
    vi.stubEnv('VITE_FIREBASE_APP_ID', 'app-id');

    const app = { name: 'firebase-app' };
    const db = { name: 'firestore-db' };
    initializeApp.mockReturnValue(app);
    getFirestore.mockReturnValue(db);

    const firebase = await importFirebaseModule();

    expect(firebase.getFirebaseConfigErrors()).toEqual([]);
    expect(firebase.isFirebaseConfigured()).toBe(true);
    expect(firebase.getDb()).toBe(db);
    expect(firebase.getDb()).toBe(db);
    expect(initializeApp).toHaveBeenCalledTimes(1);
    expect(getFirestore).toHaveBeenCalledTimes(1);
    expect(getFirestore).toHaveBeenCalledWith(app);
  });
});
