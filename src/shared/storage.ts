import type { AppData, TripData } from './types.ts';
import { normalizePasscode } from './passcode.ts';
import { isSyncEnabled, pushToCloud } from './sync.ts';

const DATA_KEY = 'trip-planner-data';
const PASSCODE_KEY = 'trip-planner-passcode';
const SESSION_KEY = 'trip-planner-session';
const THEME_KEY = 'trip-planner-theme';

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `trip-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function defaultTripData(): TripData {
  return {
    version: 1,
    id: generateId(),
    destination: { name: '', startDate: '', endDate: '', notes: '', image: '', mapLink: '', photos: [] },
    events: [],
    accommodations: [],
    restaurants: [],
  };
}

function defaultAppData(): AppData {
  const trip = defaultTripData();
  return {
    version: 2,
    trips: [trip],
    activeTripId: trip.id,
  };
}

function isLegacyTripData(raw: unknown): raw is TripData {
  return !!raw
    && typeof raw === 'object'
    && (raw as { version?: unknown }).version === 1
    && 'destination' in (raw as object);
}

function isAppData(raw: unknown): raw is AppData {
  return !!raw
    && typeof raw === 'object'
    && (raw as { version?: unknown }).version === 2
    && Array.isArray((raw as { trips?: unknown }).trips)
    && typeof (raw as { activeTripId?: unknown }).activeTripId === 'string';
}

function migrateIfNeeded(raw: unknown): { app: AppData; migrated: boolean } {
  if (isLegacyTripData(raw)) {
    const trip: TripData = {
      ...raw,
      id: raw.id || generateId(),
    };
    return {
      app: {
        version: 2,
        trips: [trip],
        activeTripId: trip.id,
      },
      migrated: true,
    };
  }

  if (isAppData(raw)) {
    const normalizedTrips = raw.trips.length > 0
      ? raw.trips.map((trip) => ({ ...trip, id: trip.id || generateId(), version: 1 as const }))
      : [defaultTripData()];

    const activeExists = normalizedTrips.some((trip) => trip.id === raw.activeTripId);
    const app: AppData = {
      version: 2,
      trips: normalizedTrips,
      activeTripId: activeExists ? raw.activeTripId : normalizedTrips[0].id,
    };

    const migrated = normalizedTrips.length !== raw.trips.length
      || !activeExists
      || normalizedTrips.some((trip, i) => trip.id !== raw.trips[i]?.id);

    return { app, migrated };
  }

  return { app: defaultAppData(), migrated: true };
}

function writeAppData(app: AppData, syncToCloud: boolean): void {
  localStorage.setItem(DATA_KEY, JSON.stringify(app));
  if (syncToCloud && isSyncEnabled()) {
    const passcode = getPasscode();
    if (passcode) void pushToCloud(passcode, app);
  }
}

export function replaceAppData(app: AppData, options: { syncToCloud?: boolean } = {}): void {
  writeAppData(app, options.syncToCloud ?? false);
}

function loadAppData(): AppData {
  try {
    const raw = localStorage.getItem(DATA_KEY);
    if (!raw) {
      const app = defaultAppData();
      writeAppData(app, false);
      return app;
    }

    const parsed = JSON.parse(raw) as unknown;
    const { app, migrated } = migrateIfNeeded(parsed);
    if (migrated) writeAppData(app, false);
    return app;
  } catch {
    const app = defaultAppData();
    writeAppData(app, false);
    return app;
  }
}

export function loadData(): TripData {
  const app = loadAppData();
  const active = app.trips.find((trip) => trip.id === app.activeTripId);
  return active || app.trips[0];
}

export function saveData(data: TripData): void {
  const app = loadAppData();
  const idx = app.trips.findIndex((trip) => trip.id === app.activeTripId);

  if (idx >= 0) {
    app.trips[idx] = { ...data, id: app.activeTripId, version: 1 };
  } else {
    app.trips.push({ ...data, id: app.activeTripId || generateId(), version: 1 });
    app.activeTripId = app.trips[app.trips.length - 1].id;
  }

  writeAppData(app, true);
}

export function getAllTrips(): TripData[] {
  return loadAppData().trips;
}

export function getActiveTripId(): string {
  return loadAppData().activeTripId;
}

export function setActiveTripId(id: string): void {
  const app = loadAppData();
  if (!app.trips.some((trip) => trip.id === id)) return;
  app.activeTripId = id;
  writeAppData(app, true);
}

export function createTrip(): TripData {
  const app = loadAppData();
  const trip = defaultTripData();
  app.trips.push(trip);
  app.activeTripId = trip.id;
  writeAppData(app, true);
  return trip;
}

export function deleteTrip(id: string): void {
  const app = loadAppData();
  if (app.trips.length <= 1) return;

  const nextTrips = app.trips.filter((trip) => trip.id !== id);
  if (nextTrips.length === app.trips.length) return;

  app.trips = nextTrips;
  if (app.activeTripId === id) {
    app.activeTripId = app.trips[0].id;
  }
  writeAppData(app, true);
}

export function clearData(): void {
  writeAppData(defaultAppData(), true);
}

export function exportData(): string {
  return JSON.stringify(loadAppData());
}

export function importData(json: string): boolean {
  try {
    const parsed = JSON.parse(json) as unknown;
    const { app } = migrateIfNeeded(parsed);
    writeAppData(app, true);
    return true;
  } catch {
    return false;
  }
}

export function getPasscode(): string | null {
  const raw = localStorage.getItem(PASSCODE_KEY);
  return raw ? normalizePasscode(raw) : null;
}

export function setPasscode(code: string): void {
  localStorage.setItem(PASSCODE_KEY, normalizePasscode(code));
}

export function isSessionValid(): boolean {
  return sessionStorage.getItem(SESSION_KEY) === 'true';
}

export function setSession(): void {
  sessionStorage.setItem(SESSION_KEY, 'true');
}

export function getTheme(): string {
  return localStorage.getItem(THEME_KEY) || 'dark';
}

export function setTheme(theme: string): void {
  localStorage.setItem(THEME_KEY, theme);
  document.documentElement.setAttribute('data-theme', theme);
}

export function initTheme(): void {
  const theme = getTheme();
  document.documentElement.setAttribute('data-theme', theme);
}
