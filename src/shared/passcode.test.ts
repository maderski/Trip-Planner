import { describe, expect, it } from 'vitest';

import {
  MAX_PASSCODE_LENGTH,
  MIN_PASSCODE_LENGTH,
  isValidPasscode,
  normalizePasscode,
} from './passcode';

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

describe('normalizePasscode', () => {
  it('trims surrounding whitespace and preserves interior characters', () => {
    expect(normalizePasscode('  trip  plan  ')).toBe('trip  plan');
  });
});

describe('isValidPasscode', () => {
  it('accepts values at the inclusive min and max lengths', () => {
    expect(isValidPasscode('a'.repeat(MIN_PASSCODE_LENGTH))).toBe(true);
    expect(isValidPasscode('b'.repeat(MAX_PASSCODE_LENGTH))).toBe(true);
  });

  it('rejects values outside the allowed length range', () => {
    expect(isValidPasscode('a'.repeat(MIN_PASSCODE_LENGTH - 1))).toBe(false);
    expect(isValidPasscode('b'.repeat(MAX_PASSCODE_LENGTH + 1))).toBe(false);
  });

  it('validates against the normalized passcode length', () => {
    expect(isValidPasscode(`  ${'a'.repeat(MIN_PASSCODE_LENGTH)}  `)).toBe(true);
    expect(isValidPasscode(` ${'a'.repeat(MIN_PASSCODE_LENGTH - 1)} `)).toBe(false);
  });
});
