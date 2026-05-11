import { describe, expect, it, vi } from 'vitest';

import { openConfirmModal, openModal } from './modal.ts';

describe('modal helpers', () => {
  it('opens a modal, focuses the first input, and stays open when submit returns false', async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 1;
    });
    const onSubmit = vi.fn(async () => false);

    openModal('Edit', '<input name="title" />', onSubmit);

    const overlay = document.querySelector('.modal-overlay') as HTMLElement | null;
    expect(overlay).not.toBeNull();
    expect(overlay?.classList.contains('open')).toBe(true);
    expect(document.activeElement).toBe(overlay?.querySelector('input'));

    overlay?.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await Promise.resolve();

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.modal-overlay')).not.toBeNull();

    vi.useRealTimers();
  });

  it('closes an existing modal when a new one opens and removes confirm modals after actions', () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 1;
    });

    openModal('First', '<input />');
    openModal('Second', '<input />');
    expect(document.querySelectorAll('.modal-overlay')).toHaveLength(1);
    expect(document.querySelector('.modal-title')?.textContent).toBe('Second');

    const onConfirm = vi.fn();
    openConfirmModal('Delete', 'Confirm delete', 'Delete', onConfirm, true);
    const overlay = document.querySelector('.modal-overlay') as HTMLElement;
    const confirm = overlay.querySelector('.modal-confirm') as HTMLButtonElement;

    expect(confirm.className).toContain('btn-danger');
    confirm.click();
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(overlay.classList.contains('closing')).toBe(true);
    vi.advanceTimersByTime(200);
    expect(document.querySelector('.modal-overlay')).toBeNull();

    vi.useRealTimers();
  });
});
