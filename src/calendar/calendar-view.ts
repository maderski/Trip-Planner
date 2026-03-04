import { loadData, saveData } from '../shared/storage.ts';
import { openModal, openConfirmModal } from '../shared/components/modal.ts';
import { icons } from '../shared/utils/icons.ts';
import { formatDate, formatDateRange, formatTime, toDateString } from '../shared/utils/dates.ts';
import { generateId } from '../shared/utils/id.ts';
import { renderMapHtml, hydrateMapPreviews } from '../shared/utils/maps.ts';
import { renderPhotoGallery, wirePhotoGallery } from '../shared/utils/photos.ts';
import type { CalendarEvent } from './types.ts';
import './calendar.css';

let activeFilter: 'Upcoming' | 'All' = 'Upcoming';

export function renderCalendar(container: HTMLElement): void {
  const data = loadData();
  const today = toDateString(new Date());

  let events = [...data.events];
  if (activeFilter === 'Upcoming') {
    events = events.filter((e) => (e.endDate || e.date) >= today);
  }

  events.sort((a, b) => {
    const byDate = a.date.localeCompare(b.date);
    if (byDate !== 0) return byDate;
    return (a.time || '').localeCompare(b.time || '');
  });

  container.innerHTML = `
    <div class="view">
      <div class="view-header">
        <h1 class="view-title">Events</h1>
        <button class="view-header-btn" id="add-event">${icons.plus}</button>
      </div>
      <div class="filter-bar">
        <div class="pill-filter">
          <button class="pill${activeFilter === 'Upcoming' ? ' active' : ''}" data-filter="Upcoming">Upcoming</button>
          <button class="pill${activeFilter === 'All' ? ' active' : ''}" data-filter="All">All</button>
        </div>
      </div>
      <div class="events-list" id="events-list"></div>
    </div>
  `;

  container.querySelectorAll('.pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      activeFilter = (pill as HTMLElement).dataset.filter as 'Upcoming' | 'All';
      renderCalendar(container);
    });
  });

  container.querySelector('#add-event')!.addEventListener('click', () => {
    openEventModal(container, null);
  });

  const list = container.querySelector('#events-list') as HTMLElement;

  if (events.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        ${icons.calendar}
        <p>No events found.<br/>Tap + to add one.</p>
      </div>
    `;
    return;
  }

  const dateGroups = new Map<string, CalendarEvent[]>();
  for (const ev of events) {
    if (!dateGroups.has(ev.date)) dateGroups.set(ev.date, []);
    dateGroups.get(ev.date)!.push(ev);
  }

  list.innerHTML = '';
  Array.from(dateGroups.entries()).forEach(([date, groupEvents]) => {
    const groupEl = document.createElement('div');
    groupEl.className = 'date-group';
    groupEl.innerHTML = `<div class="date-group-label">${formatDate(date)}</div>`;

    groupEvents.forEach((ev) => {
      const card = document.createElement('div');
      const dateLabel = ev.endDate && ev.endDate !== ev.date
        ? formatDateRange(ev.date, ev.endDate)
        : formatDate(ev.date);
      const photos = ev.photos || [];
      const mapHtml = ev.mapLink
        ? `<div class="map-inline">${renderMapHtml(ev.mapLink, icons, true, ev.photos?.[0])}</div>`
        : '';
      const photoHtml = `<div class="photo-gallery-inline">${renderPhotoGallery(photos, `event-${ev.id}`)}</div>`;

      card.className = 'glass-card item-card calendar-event-card';
      card.dataset.id = ev.id;
      const suggestedBadge = ev.suggested ? '<span class="badge badge-suggested">Suggested</span>' : '';
      const multiDayBadge = ev.endDate && ev.endDate !== ev.date ? '<span class="badge" style="background: var(--accent-glow); color: var(--accent-light)">Multi-day</span>' : '';
      const displayDate = ev.suggested ? 'TBD' : dateLabel;
      const displayTime = ev.suggested ? 'TBD' : (ev.time ? formatTime(ev.time) : '');
      const tbdClass = ev.suggested ? ' suggested-tbd' : '';
      card.innerHTML = `
        <div class="card-header">
          <div class="card-header-text">
            <div class="card-title-row">
              <h3 class="card-title">${escapeHtml(ev.title)}</h3>
              ${suggestedBadge}
              ${multiDayBadge}
            </div>
          </div>
          <div class="card-actions">
            <button class="btn btn-ghost card-action-btn edit-event" title="Edit"><span>${icons.edit}</span></button>
            <button class="btn btn-ghost card-action-btn danger delete-event" title="Delete"><span>${icons.trash}</span></button>
          </div>
        </div>
        <div class="card-body">
          <div class="card-detail${tbdClass}">${icons.calendar} ${displayDate}</div>
          ${displayTime ? `<div class="card-detail${tbdClass}">${icons.clock} ${displayTime}</div>` : ''}
          ${ev.location ? `<div class="card-detail">${icons.mapPin} ${escapeHtml(ev.location)}</div>` : ''}
          ${ev.description ? `<div style="margin-top: 4px;">${escapeHtml(ev.description)}</div>` : ''}
          ${mapHtml}
          ${photoHtml}
        </div>
      `;
      groupEl.appendChild(card);
    });

    list.appendChild(groupEl);
  });

  list.querySelectorAll('.edit-event').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = (btn.closest('.calendar-event-card') as HTMLElement).dataset.id!;
      const event = data.events.find((e) => e.id === id)!;
      openEventModal(container, event);
    });
  });

  list.querySelectorAll('.delete-event').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = (btn.closest('.calendar-event-card') as HTMLElement).dataset.id!;
      openConfirmModal('Delete Event', 'Are you sure you want to delete this event?', 'Delete', () => {
        const d = loadData();
        d.events = d.events.filter((e) => e.id !== id);
        saveData(d);
        renderCalendar(container);
      }, true);
    });
  });

  void hydrateMapPreviews(list);

  events.forEach((ev) => {
    const photos = ev.photos || [];
    wirePhotoGallery(list, `event-${ev.id}`, photos, (updatedPhotos) => {
      const d = loadData();
      const target = d.events.find((e) => e.id === ev.id);
      if (target) {
        target.photos = updatedPhotos;
        saveData(d);
        renderCalendar(container);
      }
    });
  });
}

export function openEventModal(container: HTMLElement, event: CalendarEvent | null, onSave?: () => void): void {
  const isEdit = !!event;
  openModal(
    isEdit ? 'Edit Event' : 'Add Event',
    `
    <div class="form-group">
      <label class="form-label">Title</label>
      <input class="form-input" name="title" value="${escapeAttr(event?.title || '')}" placeholder="Event name" required />
    </div>
    <div class="form-group">
      <label class="checkbox-label">
        <input type="checkbox" name="suggested" ${event?.suggested ? 'checked' : ''} />
        Suggested (Date & Time TBD)
      </label>
    </div>
    <div class="form-row date-time-fields"${event?.suggested ? ' style="opacity:0.4;pointer-events:none"' : ''}>
      <div class="form-group">
        <label class="form-label">Date</label>
        <input class="form-input" type="date" name="date" value="${event?.date || toDateString(new Date())}" required />
      </div>
      <div class="form-group">
        <label class="form-label">Time</label>
        <input class="form-input" type="time" name="time" value="${event?.time || ''}" />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Location</label>
      <input class="form-input" name="location" value="${escapeAttr(event?.location || '')}" placeholder="Where?" />
    </div>
    <div class="form-group">
      <label class="form-label">Maps Link</label>
      <input class="form-input" name="mapLink" value="${escapeAttr(event?.mapLink || '')}" placeholder="Paste a Google Maps share link" />
      <span class="form-hint">Paste a shared link to show a map preview</span>
    </div>
    <div class="form-group">
      <label class="form-label">Description</label>
      <textarea class="form-input" name="description" placeholder="Details...">${escapeHtml(event?.description || '')}</textarea>
    </div>
    `,
    (form) => {
      const fd = new FormData(form);
      const data = loadData();

      const updated: CalendarEvent = {
        id: event?.id || generateId(),
        title: fd.get('title') as string,
        date: fd.get('date') as string,
        time: fd.get('time') as string,
        location: fd.get('location') as string,
        mapLink: fd.get('mapLink') as string,
        description: fd.get('description') as string,
        photos: event?.photos || [],
        suggested: form.querySelector<HTMLInputElement>('input[name="suggested"]')!.checked,
      };

      if (isEdit) {
        const idx = data.events.findIndex((e) => e.id === event!.id);
        if (idx >= 0) data.events[idx] = updated;
      } else {
        data.events.push(updated);
      }

      saveData(data);
      onSave ? onSave() : renderCalendar(container);
    }
  );

  // Wire up suggested checkbox to toggle date/time field visibility
  const overlay = document.querySelector('.modal-overlay')!;
  const suggestedCb = overlay.querySelector<HTMLInputElement>('input[name="suggested"]')!;
  const dateTimeFields = overlay.querySelector<HTMLElement>('.date-time-fields')!;
  suggestedCb.addEventListener('change', () => {
    dateTimeFields.style.opacity = suggestedCb.checked ? '0.4' : '';
    dateTimeFields.style.pointerEvents = suggestedCb.checked ? 'none' : '';
  });
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str: string): string {
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
