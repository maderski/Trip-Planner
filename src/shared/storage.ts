import type { TripData } from './types.ts';

const DATA_KEY = 'trip-planner-data';
const PASSCODE_KEY = 'trip-planner-passcode';
const SESSION_KEY = 'trip-planner-session';
const THEME_KEY = 'trip-planner-theme';

function defaultData(): TripData {
  return {
    version: 1,
    destination: { name: '', startDate: '', endDate: '', notes: '', image: '' },
    events: [],
    accommodations: [],
    restaurants: [],
  };
}

export function loadData(): TripData {
  try {
    const raw = localStorage.getItem(DATA_KEY);
    if (!raw) return defaultData();
    return JSON.parse(raw) as TripData;
  } catch {
    return defaultData();
  }
}

export function saveData(data: TripData): void {
  localStorage.setItem(DATA_KEY, JSON.stringify(data));
}

export function clearData(): void {
  localStorage.removeItem(DATA_KEY);
}

export function exportData(): string {
  return localStorage.getItem(DATA_KEY) || JSON.stringify(defaultData());
}

export function importData(json: string): boolean {
  try {
    const data = JSON.parse(json) as TripData;
    if (data.version !== 1) return false;
    saveData(data);
    return true;
  } catch {
    return false;
  }
}

export function getPasscode(): string | null {
  return localStorage.getItem(PASSCODE_KEY);
}

export function setPasscode(code: string): void {
  localStorage.setItem(PASSCODE_KEY, code);
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
