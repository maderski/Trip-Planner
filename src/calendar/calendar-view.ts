import { loadData, saveData } from '../shared/storage.ts';
import { openModal, openConfirmModal } from '../shared/components/modal.ts';
import { icons } from '../shared/utils/icons.ts';
import { formatDate, formatDateRange, formatTime, isDateInRange, toDateString } from '../shared/utils/dates.ts';
import { generateId } from '../shared/utils/id.ts';
import { renderMapHtml, hydrateMapPreviews } from '../shared/utils/maps.ts';
import { renderPhotoGallery, wirePhotoGallery } from '../shared/utils/photos.ts';
import { renderCalendarGrid } from './calendar-grid.ts';
import type { CalendarEvent } from './types.ts';
import './calendar.css';

const mealColors: Record<string, string> = {
  Breakfast: 'var(--badge-breakfast)',
  Lunch: 'var(--badge-lunch)',
  Dinner: 'var(--badge-dinner)',
  Snacks: 'var(--badge-snacks)',
  Drinks: 'var(--badge-drinks)',
};

const typeColors: Record<string, string> = {
  Hotel: 'var(--badge-hotel)',
  Airbnb: 'var(--badge-airbnb)',
  Campground: 'var(--badge-campground)',
  Cabin: 'var(--badge-cabin)',
  Other: 'var(--text-tertiary)',
};

let currentYear: number;
let currentMonth: number;
let selectedDate: string | null = null;

export function renderCalendar(container: HTMLElement): void {
  const now = new Date();
  if (!currentYear) {
    currentYear = now.getFullYear();
    currentMonth = now.getMonth();
  }

  render(container);
}

function render(container: HTMLElement): void {
  const data = loadData();
  const monthLabel = new Date(currentYear, currentMonth).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const eventDates = new Set(data.events.map((e) => e.date));
  const stayDates = new Set<string>();
  for (const acc of data.accommodations) {
    if (!acc.checkIn || !acc.checkOut) continue;
    let cur = new Date(acc.checkIn + 'T00:00:00');
    const last = new Date(acc.checkOut + 'T00:00:00');
    while (cur <= last) {
      stayDates.add(toDateString(cur));
      cur.setDate(cur.getDate() + 1);
    }
  }
  const restaurantDates = new Set(
    data.restaurants.flatMap((r) => r.visitDate ? [r.visitDate] : [])
  );

  container.innerHTML = `
    <div class="view">
      <div class="view-header">
        <h1 class="view-title">Calendar</h1>
        <button class="view-header-btn" id="add-event">${icons.plus}</button>
      </div>
      <div class="calendar-nav">
        <button id="cal-prev">${icons.chevronLeft}</button>
        <span class="calendar-month-label">${monthLabel}</span>
        <button id="cal-next">${icons.chevronRight}</button>
      </div>
      <div class="calendar-grid" id="cal-grid"></div>
      <div id="day-events"></div>
    </div>
  `;

  const grid = container.querySelector('#cal-grid') as HTMLElement;
  renderCalendarGrid(grid, {
    year: currentYear,
    month: currentMonth,
    selectedDate,
    tripStart: data.destination.startDate,
    tripEnd: data.destination.endDate,
    eventDates,
    stayDates,
    restaurantDates,
    onDayClick: (date) => {
      selectedDate = date;
      render(container);
    },
  });

  container.querySelector('#cal-prev')!.addEventListener('click', () => {
    currentMonth--;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    render(container);
  });

  container.querySelector('#cal-next')!.addEventListener('click', () => {
    currentMonth++;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    render(container);
  });

  container.querySelector('#add-event')!.addEventListener('click', () => {
    openEventModal(container, null);
  });

  if (selectedDate) {
    renderDayEvents(container, selectedDate);
  }
}

function renderDayEvents(container: HTMLElement, date: string): void {
  const data = loadData();
  const dayEvents = data.events
    .filter((e) => isDateInRange(date, e.date, e.endDate || e.date))
    .sort((a, b) => a.time.localeCompare(b.time));
  const dayStays = data.accommodations.filter(
    (a) => a.checkIn && a.checkOut && isDateInRange(date, a.checkIn, a.checkOut)
  );
  const dayRestaurants = data.restaurants.filter((r) => r.visitDate === date);

  const eventsContainer = container.querySelector('#day-events')!;

  if (dayEvents.length === 0 && dayStays.length === 0 && dayRestaurants.length === 0) {
    eventsContainer.innerHTML = `
      <div class="day-events-header">
        <span class="day-events-title">${formatDate(date)}</span>
      </div>
      <p style="color: var(--text-tertiary); font-size: var(--font-sm);">Nothing scheduled for this day</p>
    `;
    return;
  }

  const eventsHtml = dayEvents.length === 0 ? '' : `
    <div class="day-section-header">Events</div>
    ${dayEvents.map((ev) => {
      const photos = ev.photos || [];
      const mapHtml = ev.mapLink ? `<div class="map-inline">${renderMapHtml(ev.mapLink, icons, true, ev.photos?.[0])}</div>` : '';
      const photoHtml = photos.length > 0
        ? `<div class="photo-gallery-inline">${renderPhotoGallery(photos, `event-${ev.id}`)}</div>`
        : `<div class="photo-gallery-inline">${renderPhotoGallery([], `event-${ev.id}`)}</div>`;

      return `
        <div class="event-item glass-card" data-id="${ev.id}">
          ${ev.time ? `<div class="event-time">${formatTime(ev.time)}</div>` : ''}
          <div class="event-title">${escapeHtml(ev.title)}</div>
          ${ev.location ? `<div class="event-detail">${icons.mapPin} ${escapeHtml(ev.location)}</div>` : ''}
          ${ev.description ? `<div class="event-detail">${escapeHtml(ev.description)}</div>` : ''}
          ${mapHtml}
          ${photoHtml}
          <div class="event-actions">
            <button class="edit-event" title="Edit">${icons.edit}</button>
            <button class="delete-event danger" title="Delete">${icons.trash}</button>
          </div>
        </div>
      `;
    }).join('')}
  `;

  const staysHtml = dayStays.length === 0 ? '' : `
    <div class="day-section-header">Staying</div>
    ${dayStays.map((acc) => {
      const badgeColor = typeColors[acc.type];
      const bodyParts: string[] = [];
      if (acc.checkIn && acc.checkOut) {
        bodyParts.push(`<div class="card-detail">${icons.calendar} ${formatDateRange(acc.checkIn, acc.checkOut)}</div>`);
      }
      if (acc.address) {
        bodyParts.push(`<div class="card-detail">${icons.mapPin} ${escapeHtml(acc.address)}</div>`);
      }
      if (acc.link) {
        bodyParts.push(`<div class="card-detail">${icons.link} <a href="${escapeAttr(acc.link)}" target="_blank" rel="noopener">Booking Link</a></div>`);
      }
      if (acc.confirmationCode) {
        bodyParts.push(`<div class="card-detail">Conf: <span class="acc-confirm">${escapeHtml(acc.confirmationCode)}</span></div>`);
      }
      if (acc.notes) {
        bodyParts.push(`<div style="margin-top:4px">${escapeHtml(acc.notes)}</div>`);
      }
      return `
        <div class="glass-card item-card">
          <div class="card-header">
            <div class="card-header-text">
              <div class="card-title-row">
                <h3 class="card-title">${escapeHtml(acc.name)}</h3>
                <span class="badge" style="background:${badgeColor}20;color:${badgeColor}">${acc.type}</span>
              </div>
            </div>
          </div>
          <div class="card-body">${bodyParts.join(' ')}</div>
        </div>
      `;
    }).join('')}
  `;

  const restaurantsHtml = dayRestaurants.length === 0 ? '' : `
    <div class="day-section-header">Eating</div>
    ${dayRestaurants.map((rest) => {
      const mealColor = mealColors[rest.mealType];
      const bodyParts: string[] = [];
      if (rest.priceRange) bodyParts.push(`<span class="restaurant-price">${rest.priceRange}</span>`);
      if (rest.cuisineType) bodyParts.push(`<span>${escapeHtml(rest.cuisineType)}</span>`);
      if (rest.address) {
        bodyParts.push(`<div class="card-detail">${icons.mapPin} <a href="https://maps.google.com/?q=${encodeURIComponent(rest.address)}" target="_blank" rel="noopener">${escapeHtml(rest.address)}</a></div>`);
      }
      if (rest.menuLink) {
        bodyParts.push(`<div class="card-detail">${icons.menu} <a href="${escapeAttr(rest.menuLink)}" target="_blank" rel="noopener">Menu</a></div>`);
      }
      if (rest.notes) bodyParts.push(`<div style="margin-top:4px">${escapeHtml(rest.notes)}</div>`);
      const mapHtml = rest.mapLink
        ? `<div class="map-inline">${renderMapHtml(rest.mapLink, icons, true, rest.photos?.[0])}</div>`
        : '';
      const photos = rest.photos || [];
      const photoHtml = photos.length > 0
        ? `<div class="photo-gallery-inline">${renderPhotoGallery(photos, `cal-rest-${rest.id}`)}</div>`
        : '';
      return `
        <div class="glass-card item-card">
          <div class="card-header">
            <div class="card-header-text">
              <div class="card-title-row">
                <h3 class="card-title">${escapeHtml(rest.name)}</h3>
                <span class="badge" style="background:${mealColor}20;color:${mealColor}">${rest.mealType}</span>
              </div>
            </div>
          </div>
          <div class="card-body">
            ${bodyParts.join(' ')}
            ${mapHtml}
            ${photoHtml}
          </div>
        </div>
      `;
    }).join('')}
  `;

  eventsContainer.innerHTML = `
    <div class="day-events-header">
      <span class="day-events-title">${formatDate(date)}</span>
    </div>
    ${eventsHtml}
    ${staysHtml}
    ${restaurantsHtml}
  `;

  // Wire edit/delete
  eventsContainer.querySelectorAll('.edit-event').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = (btn.closest('.event-item') as HTMLElement).dataset.id!;
      const event = data.events.find((e) => e.id === id)!;
      openEventModal(container, event);
    });
  });

  eventsContainer.querySelectorAll('.delete-event').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = (btn.closest('.event-item') as HTMLElement).dataset.id!;
      openConfirmModal('Delete Event', 'Are you sure you want to delete this event?', 'Delete', () => {
        const d = loadData();
        d.events = d.events.filter((e) => e.id !== id);
        saveData(d);
        render(container);
      }, true);
    });
  });

  // Hydrate any map placeholders that need geocoding
  void hydrateMapPreviews(eventsContainer as HTMLElement);

  // Wire photo galleries for each event
  dayEvents.forEach((ev) => {
    const photos = ev.photos || [];
    wirePhotoGallery(eventsContainer as HTMLElement, `event-${ev.id}`, photos, (updatedPhotos) => {
      const d = loadData();
      const target = d.events.find((e) => e.id === ev.id);
      if (target) {
        target.photos = updatedPhotos;
        saveData(d);
        render(container);
      }
    });
  });

  // Wire lightbox for restaurant photos in day panel (read-only)
  dayRestaurants.forEach((rest) => {
    const photos = rest.photos || [];
    if (photos.length === 0) return;
    wirePhotoGallery(eventsContainer as HTMLElement, `cal-rest-${rest.id}`, photos, () => {});
  });
}

function openEventModal(container: HTMLElement, event: CalendarEvent | null): void {
  const isEdit = !!event;
  openModal(
    isEdit ? 'Edit Event' : 'Add Event',
    `
    <div class="form-group">
      <label class="form-label">Title</label>
      <input class="form-input" name="title" value="${escapeAttr(event?.title || '')}" placeholder="Event name" required />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Date</label>
        <input class="form-input" type="date" name="date" value="${event?.date || selectedDate || ''}" required />
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
      };

      if (isEdit) {
        const idx = data.events.findIndex((e) => e.id === event!.id);
        if (idx >= 0) data.events[idx] = updated;
      } else {
        data.events.push(updated);
      }

      selectedDate = updated.date;
      saveData(data);
      render(container);
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
