import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  daysUntil,
  formatDate,
  formatDateRange,
  formatTime,
  getDaysInMonth,
  getFirstDayOfMonth,
  isDateInRange,
  toDateString,
} from './dates';

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
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { location: { hash: '' } },
  });
}

installTestGlobals();

describe('formatDate', () => {
  it('formats ISO calendar dates in a compact US format', () => {
    expect(formatDate('2024-02-29')).toBe('Feb 29, 2024');
  });
});

describe('formatDateRange', () => {
  it('formats ranges within the same month compactly', () => {
    expect(formatDateRange('2024-06-01', '2024-06-05')).toBe('Jun 1-5, 2024');
  });

  it('formats ranges across months in the same year', () => {
    expect(formatDateRange('2024-06-30', '2024-07-02')).toBe('Jun 30 - Jul 2, 2024');
  });

  it('formats ranges across years using full dates', () => {
    expect(formatDateRange('2024-12-31', '2025-01-02')).toBe('Dec 31, 2024 - Jan 2, 2025');
  });
});

describe('formatTime', () => {
  it('handles midnight, noon, and zero-padded minutes', () => {
    expect(formatTime('00:05')).toBe('12:05 AM');
    expect(formatTime('12:00')).toBe('12:00 PM');
    expect(formatTime('23:09')).toBe('11:09 PM');
  });
});

describe('calendar helpers', () => {
  it('returns the correct number of days for leap and non-leap months', () => {
    expect(getDaysInMonth(2024, 1)).toBe(29);
    expect(getDaysInMonth(2023, 1)).toBe(28);
  });

  it('returns the first weekday index for a known month', () => {
    expect(getFirstDayOfMonth(2024, 8)).toBe(0);
  });

  it('converts Date objects to yyyy-mm-dd strings', () => {
    expect(toDateString(new Date('2024-06-15T12:30:00.000Z'))).toBe('2024-06-15');
  });

  it('checks inclusive date ranges lexicographically', () => {
    expect(isDateInRange('2024-06-10', '2024-06-10', '2024-06-12')).toBe(true);
    expect(isDateInRange('2024-06-12', '2024-06-10', '2024-06-12')).toBe(true);
    expect(isDateInRange('2024-06-09', '2024-06-10', '2024-06-12')).toBe(false);
  });
});

describe('daysUntil', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('counts whole days relative to the start of today', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-10T15:30:00'));

    expect(daysUntil('2024-06-10')).toBe(0);
    expect(daysUntil('2024-06-12')).toBe(2);
    expect(daysUntil('2024-06-09')).toBe(-1);
  });
});
