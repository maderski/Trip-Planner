import { describe, expect, it, vi } from 'vitest';

import { showToast } from './toast.ts';

describe('showToast', () => {
  it('renders a toast, replaces existing toasts, and removes it after timers run', () => {
    vi.useFakeTimers();
    const raf = vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 1;
    });

    showToast('First', 'success');
    showToast('Second', 'error');

    const toast = document.querySelector('.toast') as HTMLElement | null;
    expect(toast).not.toBeNull();
    expect(toast?.textContent).toBe('Second');
    expect(toast?.className).toContain('toast-error');
    expect(toast?.classList.contains('show')).toBe(true);
    expect(document.querySelectorAll('.toast')).toHaveLength(1);

    vi.advanceTimersByTime(2500);
    expect(toast?.classList.contains('show')).toBe(false);
    vi.advanceTimersByTime(300);
    expect(document.querySelector('.toast')).toBeNull();

    raf.mockRestore();
    vi.useRealTimers();
  });
});
