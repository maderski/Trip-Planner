import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { getDb, isFirebaseConfigured } from './firebase.ts';
import { normalizePasscode } from './passcode.ts';
import type { AppData } from './types.ts';

const COLLECTION = 'planners';
const DATA_KEY = 'trip-planner-data';

export type SyncStatus = 'disabled' | 'idle' | 'syncing' | 'synced' | 'error';

export interface SyncState {
  status: SyncStatus;
  detail: string;
  lastSyncedAt: string | null;
}

let unsubscribe: Unsubscribe | null = null;
let lastWriteId = '';
let syncState: SyncState = isFirebaseConfigured()
  ? { status: 'idle', detail: 'Cloud sync is ready.', lastSyncedAt: null }
  : { status: 'disabled', detail: 'Firebase is not configured. The app is running locally only.', lastSyncedAt: null };

export function isSyncEnabled(): boolean {
  return isFirebaseConfigured();
}

export function getSyncState(): SyncState {
  return syncState;
}

function setSyncState(next: SyncState): void {
  syncState = next;
  document.dispatchEvent(new CustomEvent('sync-status-changed', { detail: next }));
}

function createWriteId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `write-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function getPlannerDocId(passcode: string): Promise<string> {
  const normalized = normalizePasscode(passcode);
  const encoder = new TextEncoder();
  const input = encoder.encode(normalized);

  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', input);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  return Array.from(input)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function pushToCloud(passcode: string, app: AppData): Promise<boolean> {
  if (!isSyncEnabled()) return false;

  try {
    const db = getDb();
    const plannerId = await getPlannerDocId(passcode);
    lastWriteId = createWriteId();
    setSyncState({ status: 'syncing', detail: 'Syncing shared trip workspace...', lastSyncedAt: syncState.lastSyncedAt });
    await setDoc(doc(db, COLLECTION, plannerId), {
      data: app,
      version: app.version,
      updatedAt: serverTimestamp(),
      clientWriteId: lastWriteId,
    });
    setSyncState({ status: 'synced', detail: 'Shared workspace synced.', lastSyncedAt: new Date().toISOString() });
    return true;
  } catch (e) {
    console.error('Sync push failed:', e);
    setSyncState({ status: 'error', detail: 'Unable to sync changes to Firebase.', lastSyncedAt: syncState.lastSyncedAt });
    return false;
  }
}

export async function pullFromCloud(passcode: string): Promise<AppData | null> {
  if (!isSyncEnabled()) return null;

  try {
    const db = getDb();
    const plannerId = await getPlannerDocId(passcode);
    setSyncState({ status: 'syncing', detail: 'Loading shared trip workspace...', lastSyncedAt: syncState.lastSyncedAt });
    const snap = await getDoc(doc(db, COLLECTION, plannerId));
    if (!snap.exists()) {
      setSyncState({ status: 'idle', detail: 'No remote workspace exists yet.', lastSyncedAt: syncState.lastSyncedAt });
      return null;
    }

    const raw = snap.data();
    setSyncState({ status: 'synced', detail: 'Shared workspace loaded.', lastSyncedAt: new Date().toISOString() });
    return raw.data as AppData;
  } catch (e) {
    console.error('Sync pull failed:', e);
    setSyncState({ status: 'error', detail: 'Unable to load the shared workspace from Firebase.', lastSyncedAt: syncState.lastSyncedAt });
    return null;
  }
}

export async function startListening(passcode: string, onRemoteChange: () => void): Promise<void> {
  stopListening();
  if (!isSyncEnabled()) return;

  const db = getDb();
  const plannerId = await getPlannerDocId(passcode);
  unsubscribe = onSnapshot(
    doc(db, COLLECTION, plannerId),
    (snap) => {
      if (!snap.exists()) return;

      const raw = snap.data();
      if ((raw.clientWriteId as string | undefined) === lastWriteId) {
        return;
      }

      const remoteData = raw.data as AppData;
      localStorage.setItem(DATA_KEY, JSON.stringify(remoteData));
      setSyncState({ status: 'synced', detail: 'Shared workspace updated.', lastSyncedAt: new Date().toISOString() });
      onRemoteChange();
    },
    (error) => {
      console.error('Sync listener failed:', error);
      setSyncState({ status: 'error', detail: 'Live sync connection failed.', lastSyncedAt: syncState.lastSyncedAt });
    }
  );

  setSyncState({ status: 'idle', detail: 'Listening for collaborator updates.', lastSyncedAt: syncState.lastSyncedAt });
}

export function stopListening(): void {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }

  if (isSyncEnabled()) {
    setSyncState({ status: 'idle', detail: 'Cloud sync is ready.', lastSyncedAt: syncState.lastSyncedAt });
  }
}
