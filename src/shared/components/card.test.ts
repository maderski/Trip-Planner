import { describe, expect, it, vi } from 'vitest';

import { createCard } from './card.ts';

describe('createCard', () => {
  it('renders optional subtitle, badge, dimmed state, and action buttons', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const card = createCard({
      title: 'Hotel',
      subtitle: 'Check-in 4pm',
      badge: { label: 'Booked', color: '#00ff00' },
      body: '<p>Body copy</p>',
      dimmed: true,
      actions: [
        { icon: '<svg></svg>', label: 'Edit', onClick: onEdit },
        { icon: '<svg></svg>', label: 'Delete', onClick: onDelete, danger: true },
      ],
    });

    document.body.appendChild(card);

    expect(card.className).toContain('dimmed');
    expect(card.querySelector('.card-title')?.textContent).toBe('Hotel');
    expect(card.querySelector('.card-subtitle')?.textContent).toBe('Check-in 4pm');
    expect(card.querySelector('.badge')?.textContent).toBe('Booked');
    expect(card.querySelectorAll('.card-action-btn')).toHaveLength(2);
    expect(card.querySelector('.card-action-btn.danger')).not.toBeNull();

    const stopPropagation = vi.fn();
    card.querySelectorAll<HTMLButtonElement>('.card-action-btn')[0].dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true })
    );
    expect(onEdit).toHaveBeenCalledTimes(1);

    card.querySelectorAll<HTMLButtonElement>('.card-action-btn')[1].dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true })
    );
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(stopPropagation).not.toHaveBeenCalled();
  });

  it('renders cards without optional sections cleanly', () => {
    const card = createCard({
      title: 'Dinner',
      body: 'Reservations pending',
    });

    expect(card.querySelector('.card-subtitle')).toBeNull();
    expect(card.querySelector('.badge')).toBeNull();
    expect(card.querySelector('.card-actions')).toBeNull();
    expect(card.querySelector('.card-body')?.textContent).toContain('Reservations pending');
  });
});
