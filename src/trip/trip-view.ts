import { loadData, saveData } from '../shared/storage.ts';
import { openModal } from '../shared/components/modal.ts';
import { icons } from '../shared/utils/icons.ts';
import { formatDateRange, daysUntil } from '../shared/utils/dates.ts';
import { navigateTo } from '../shared/router.ts';
import './trip.css';

export function renderTrip(container: HTMLElement): void {
  const data = loadData();
  const dest = data.destination;
  const hasDestination = !!dest.name;

  let countdownHtml = '';
  if (dest.startDate) {
    const days = daysUntil(dest.startDate);
    if (days > 0) {
      countdownHtml = `<span class="trip-countdown">${days} day${days !== 1 ? 's' : ''} away</span>`;
    } else if (days === 0) {
      countdownHtml = `<span class="trip-countdown">Today!</span>`;
    }
  }

  container.innerHTML = `
    <div class="view">
      <div class="trip-hero glass">
        <div class="trip-destination ${!hasDestination ? 'empty' : ''}">
          ${hasDestination ? dest.name : 'Tap to set destination'}
        </div>
        ${dest.startDate && dest.endDate ? `<div class="trip-dates">${formatDateRange(dest.startDate, dest.endDate)}</div>` : ''}
        ${countdownHtml}
        ${dest.notes ? `<div class="trip-notes">${escapeHtml(dest.notes)}</div>` : ''}
        <button class="btn btn-secondary trip-edit-btn" id="edit-trip">
          ${icons.edit} ${hasDestination ? 'Edit Trip' : 'Set Up Trip'}
        </button>
      </div>

      <div class="bento-grid">
        <div class="bento-card glass-card" data-nav="calendar">
          <div class="bento-icon">${icons.calendar}</div>
          <div class="bento-count">${data.events.length}</div>
          <div class="bento-label">Events</div>
        </div>
        <div class="bento-card glass-card" data-nav="accommodations">
          <div class="bento-icon">${icons.bed}</div>
          <div class="bento-count">${data.accommodations.length}</div>
          <div class="bento-label">Stays</div>
        </div>
        <div class="bento-card glass-card" data-nav="restaurants" style="grid-column: span 2;">
          <div class="bento-icon">${icons.restaurant}</div>
          <div class="bento-count">${data.restaurants.length}</div>
          <div class="bento-label">Restaurants</div>
        </div>
      </div>
    </div>
  `;

  container.querySelector('#edit-trip')!.addEventListener('click', () => openTripModal(container));

  container.querySelectorAll('.bento-card').forEach((card) => {
    card.addEventListener('click', () => {
      const route = (card as HTMLElement).dataset.nav;
      if (route) navigateTo(route as 'calendar' | 'accommodations' | 'restaurants');
    });
  });
}

function openTripModal(container: HTMLElement): void {
  const data = loadData();
  const dest = data.destination;

  openModal(
    'Trip Details',
    `
    <div class="form-group">
      <label class="form-label">Destination</label>
      <input class="form-input" name="name" value="${escapeAttr(dest.name)}" placeholder="Where are you going?" required />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Start Date</label>
        <input class="form-input" type="date" name="startDate" value="${dest.startDate}" />
      </div>
      <div class="form-group">
        <label class="form-label">End Date</label>
        <input class="form-input" type="date" name="endDate" value="${dest.endDate}" />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Notes</label>
      <textarea class="form-input" name="notes" placeholder="Travel tips, links, reminders...">${escapeHtml(dest.notes)}</textarea>
    </div>
    `,
    (form) => {
      const fd = new FormData(form);
      data.destination = {
        name: fd.get('name') as string,
        startDate: fd.get('startDate') as string,
        endDate: fd.get('endDate') as string,
        notes: fd.get('notes') as string,
      };
      saveData(data);
      renderTrip(container);
    }
  );
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str: string): string {
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
