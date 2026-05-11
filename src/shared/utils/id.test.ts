import { describe, expect, it, vi } from 'vitest';

import { generateId } from './id.ts';

describe('generateId', () => {
  it('delegates to crypto.randomUUID', () => {
    const randomUUID = vi.fn(() => 'generated-id');
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: { randomUUID },
    });

    expect(generateId()).toBe('generated-id');
    expect(randomUUID).toHaveBeenCalledTimes(1);
  });
});
