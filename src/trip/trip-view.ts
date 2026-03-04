import { loadData, saveData } from '../shared/storage.ts';
import { openModal } from '../shared/components/modal.ts';
import { icons } from '../shared/utils/icons.ts';
import { formatDate, formatDateRange, formatTime, isDateInRange, toDateString, daysUntil } from '../shared/utils/dates.ts';
import { navigateTo } from '../shared/router.ts';
import { renderMapHtml, hydrateMapPreviews, extractMapLink } from '../shared/utils/maps.ts';
import { resizeImage, renderPhotoGallery, wirePhotoGallery } from '../shared/utils/photos.ts';
import { renderCalendarGrid } from '../calendar/calendar-grid.ts';
import { openEventModal } from '../calendar/calendar-view.ts';
import { openAccModal } from '../accommodations/accommodations-view.ts';
import { openRestModal } from '../restaurants/restaurants-view.ts';
import type { CalendarEvent } from '../calendar/types.ts';
import type { Accommodation } from '../accommodations/types.ts';
import type { Restaurant } from '../restaurants/types.ts';
import type { TripData } from '../shared/types.ts';
import './trip.css';

let calYear: number = new Date().getFullYear();
let calMonth: number = new Date().getMonth();
let calSelectedDate: string | null = null;

export function renderTrip(container: HTMLElement): void {
  const data = loadData();
  const dest = data.destination;
  const hasDestination = !!dest.name;
  const photos = dest.photos || [];
  const today = toDateString(new Date());
  const upcomingEvents = data.events
    .filter((e) => (e.endDate || e.date) >= today)
    .map((e) => ({ type: 'event' as const, sortDate: e.date, item: e }));
  const upcomingStays = data.accommodations
    .filter((a) => a.checkOut >= today)
    .map((a) => ({ type: 'stay' as const, sortDate: a.checkIn, item: a }));
  const upcomingRestaurants = data.restaurants
    .filter((r) => r.visitDate && r.visitDate >= today)
    .map((r) => ({ type: 'restaurant' as const, sortDate: r.visitDate!, item: r }));
  const upcomingItems = [...upcomingEvents, ...upcomingStays, ...upcomingRestaurants]
    .sort((a, b) => a.sortDate.localeCompare(b.sortDate));

  let countdownHtml = '';
  if (dest.startDate) {
    const days = daysUntil(dest.startDate);
    if (days > 0) {
      countdownHtml = `<span class="trip-countdown">${days} day${days !== 1 ? 's' : ''} away</span>`;
    } else if (days === 0) {
      countdownHtml = `<span class="trip-countdown">Today!</span>`;
    }
  }

  const heroStyle = dest.image
    ? `style="background-image: url('${dest.image}');"`
    : '';

  let mapHtml = '';
  if (dest.mapLink) {
    mapHtml = `
      <div class="trip-section">
        <div class="trip-section-header">
          <h2 class="trip-section-title">Location</h2>
        </div>
        ${renderMapHtml(dest.mapLink, icons, undefined, dest.photos?.[0] ?? dest.image)}
      </div>
    `;
  }

  const photosHtml = `
    <div class="trip-section">
      <div class="trip-section-header">
        <h2 class="trip-section-title">Highlights</h2>
        ${photos.length > 0 ? `<span class="trip-section-count">${photos.length} photo${photos.length !== 1 ? 's' : ''}</span>` : ''}
      </div>
      ${renderPhotoGallery(photos, 'trip')}
    </div>
  `;

  const accColors: Record<string, string> = {
    Hotel: 'var(--badge-hotel)', Airbnb: 'var(--badge-airbnb)',
    Campground: 'var(--badge-campground)', Cabin: 'var(--badge-cabin)',
    Other: 'var(--text-tertiary)',
  };
  const dateGroups = new Map<string, typeof upcomingItems>();
  for (const ui of upcomingItems) {
    if (!dateGroups.has(ui.sortDate)) dateGroups.set(ui.sortDate, []);
    dateGroups.get(ui.sortDate)!.push(ui);
  }

  const upcomingHtml = upcomingItems.length === 0 ? '' : `
    <div class="trip-section">
      <div class="trip-section-header">
        <h2 class="trip-section-title">Upcoming</h2>
        <span class="trip-section-count">${upcomingItems.length} item${upcomingItems.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="upcoming-list">
        ${Array.from(dateGroups.entries()).map(([date, groupItems]) => `
          <div class="upcoming-date-group">
            <div class="upcoming-date-label">${formatDate(date)}</div>
            ${groupItems.map(({ type, item }) => {
              if (type === 'event') {
                const ev = item as CalendarEvent;
                const meta = [ev.time ? formatTime(ev.time) : '', ev.location].filter(Boolean).join(' · ');
                return `
                  <div class="upcoming-item glass-card" data-id="${ev.id}" data-type="event">
                    <span class="upcoming-icon" style="color:var(--accent-light)">${icons.calendar}</span>
                    <div class="upcoming-info">
                      <div class="upcoming-title">${escapeHtml(ev.title)}</div>
                      ${meta ? `<div class="upcoming-meta">${escapeHtml(meta)}</div>` : ''}
                    </div>
                  </div>`;
              } else if (type === 'stay') {
                const acc = item as Accommodation;
                const color = accColors[acc.type] ?? 'var(--text-tertiary)';
                return `
                  <div class="upcoming-item glass-card" data-id="${acc.id}" data-type="stay">
                    <span class="upcoming-icon" style="color:var(--badge-airbnb)">${icons.bed}</span>
                    <div class="upcoming-info">
                      <div class="upcoming-title">${escapeHtml(acc.name)}</div>
                      <div class="upcoming-meta">${formatDateRange(acc.checkIn, acc.checkOut)} · <span style="color:${color}">${acc.type}</span></div>
                    </div>
                  </div>`;
              }
              const rest = item as Restaurant;
              const meta = [rest.mealType, rest.cuisineType].filter(Boolean).join(' · ');
              return `
                <div class="upcoming-item glass-card" data-id="${rest.id}" data-type="restaurant">
                  <span class="upcoming-icon" style="color:var(--badge-lunch)">${icons.restaurant}</span>
                  <div class="upcoming-info">
                    <div class="upcoming-title">${escapeHtml(rest.name)}</div>
                    ${meta ? `<div class="upcoming-meta">${escapeHtml(meta)}</div>` : ''}
                  </div>
                </div>`;
            }).join('')}
          </div>
        `).join('')}
      </div>
    </div>
  `;

  const calendarWidgetHtml = `
    <div class="trip-calendar-widget glass-card" style="padding: var(--space-md);">
      <div class="trip-calendar-nav">
        <button id="trip-cal-prev">${icons.chevronLeft}</button>
        <span class="trip-calendar-month"></span>
        <button id="trip-cal-next">${icons.chevronRight}</button>
      </div>
      <div id="trip-cal-grid" class="calendar-grid"></div>
      <div id="trip-day-panel"></div>
    </div>
  `;

  container.innerHTML = `
    <div class="view">
      <div class="trip-layout">
        <div class="trip-col-left">
          <div class="trip-hero glass ${dest.image ? 'has-image' : ''}" ${heroStyle}>
            ${dest.image ? '<div class="trip-hero-overlay"></div>' : ''}
            <div class="trip-hero-content">
              <div class="trip-destination ${!hasDestination ? 'empty' : ''}">
                ${hasDestination ? escapeHtml(dest.name) : 'Tap to set destination'}
              </div>
              ${dest.startDate && dest.endDate ? `<div class="trip-dates">${formatDateRange(dest.startDate, dest.endDate)}</div>` : ''}
              ${countdownHtml}
              ${dest.notes ? `<div class="trip-notes">${escapeHtml(dest.notes)}</div>` : ''}
              <button class="btn btn-secondary trip-edit-btn" id="edit-trip">
                ${icons.edit} ${hasDestination ? 'Edit Trip' : 'Set Up Trip'}
              </button>
            </div>
          </div>

          ${mapHtml}
          ${photosHtml}

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
          ${upcomingHtml}
        </div>
        <div class="trip-col-right">
          ${calendarWidgetHtml}
        </div>
      </div>
    </div>
  `;

  void hydrateMapPreviews(container);

  container.querySelector('#edit-trip')!.addEventListener('click', () => openTripModal(container));
  container.querySelectorAll('.bento-card').forEach((card) => {
    card.addEventListener('click', () => {
      const route = (card as HTMLElement).dataset.nav;
      if (route) navigateTo(route as 'calendar' | 'accommodations' | 'restaurants');
    });
  });
  container.querySelectorAll('.upcoming-item[data-id]').forEach((el) => {
    const id = (el as HTMLElement).dataset.id!;
    const type = (el as HTMLElement).dataset.type!;
    el.addEventListener('click', () => {
      if (type === 'event') {
        const ev = data.events.find((e) => e.id === id);
        if (ev) openEventModal(container, ev, () => renderTrip(container));
      } else if (type === 'stay') {
        const acc = data.accommodations.find((a) => a.id === id);
        if (acc) openAccModal(container, acc, () => renderTrip(container));
      } else {
        const rest = data.restaurants.find((r) => r.id === id);
        if (rest) openRestModal(container, rest, () => renderTrip(container));
      }
    });
  });

  container.querySelector('#trip-cal-prev')!.addEventListener('click', () => {
    calMonth--;
    if (calMonth < 0) { calMonth = 11; calYear--; }
    renderCalWidget();
  });
  container.querySelector('#trip-cal-next')!.addEventListener('click', () => {
    calMonth++;
    if (calMonth > 11) { calMonth = 0; calYear++; }
    renderCalWidget();
  });

  function renderCalWidget(): void {
    const d = loadData();
    const monthLabel = new Date(calYear, calMonth).toLocaleDateString('en-US', {
      month: 'long', year: 'numeric',
    });
    container.querySelector('.trip-calendar-month')!.textContent = monthLabel;

    const eventDates = new Set(d.events.map((e) => e.date));
    const stayDates = new Set<string>();
    for (const acc of d.accommodations) {
      if (!acc.checkIn || !acc.checkOut) continue;
      let cur = new Date(acc.checkIn + 'T00:00:00');
      const last = new Date(acc.checkOut + 'T00:00:00');
      while (cur <= last) {
        stayDates.add(toDateString(cur));
        cur.setDate(cur.getDate() + 1);
      }
    }
    const restaurantDates = new Set(d.restaurants.flatMap((r) => r.visitDate ? [r.visitDate] : []));

    renderCalendarGrid(container.querySelector('#trip-cal-grid') as HTMLElement, {
      year: calYear,
      month: calMonth,
      selectedDate: calSelectedDate,
      tripStart: d.destination.startDate,
      tripEnd: d.destination.endDate,
      eventDates,
      stayDates,
      restaurantDates,
      onDayClick: (date) => {
        calSelectedDate = date;
        renderCalWidget();
      },
    });

    if (calSelectedDate) {
      renderTripDayPanel(container, d, calSelectedDate);
    } else {
      const panel = container.querySelector('#trip-day-panel') as HTMLElement;
      panel.innerHTML = '';
    }
  }

  renderCalWidget();

  wirePhotoGallery(container, 'trip', photos, (updatedPhotos) => {
    const d = loadData();
    d.destination.photos = updatedPhotos;
    saveData(d);
    renderTrip(container);
  });
}

function renderTripDayPanel(container: HTMLElement, data: TripData, date: string): void {
  const panel = container.querySelector('#trip-day-panel') as HTMLElement;
  const dayEvents = data.events.filter((e) => isDateInRange(date, e.date, e.endDate || e.date));
  const dayStays = data.accommodations.filter((a) => a.checkIn && a.checkOut && isDateInRange(date, a.checkIn, a.checkOut));
  const dayRestaurants = data.restaurants.filter((r) => r.visitDate === date);

  const items: string[] = [];
  dayEvents.forEach((ev) => {
    items.push(`
      <div class="trip-day-item">
        <span class="trip-day-item-icon" style="color:var(--accent-light)">${icons.calendar}</span>
        <span>${escapeHtml(ev.title)}</span>
      </div>
    `);
  });
  dayStays.forEach((acc) => {
    items.push(`
      <div class="trip-day-item">
        <span class="trip-day-item-icon" style="color:var(--badge-airbnb)">${icons.bed}</span>
        <span>${escapeHtml(acc.name)}</span>
      </div>
    `);
  });
  dayRestaurants.forEach((rest) => {
    items.push(`
      <div class="trip-day-item">
        <span class="trip-day-item-icon" style="color:var(--badge-lunch)">${icons.restaurant}</span>
        <span>${escapeHtml(rest.name)}</span>
      </div>
    `);
  });

  panel.innerHTML = `
    <div class="trip-day-panel">
      <div class="trip-day-panel-title">${formatDate(date)}</div>
      ${items.length > 0 ? items.join('') : `<div class="trip-day-empty">Nothing on ${formatDate(date)}</div>`}
    </div>
  `;
}

// --- Trip edit modal ---

let pendingImage: string | null = null;

function openTripModal(container: HTMLElement): void {
  const data = loadData();
  const dest = data.destination;
  pendingImage = dest.image || null;

  const previewHtml = dest.image
    ? `<img src="${dest.image}" class="image-preview" />`
    : '<div class="image-preview-empty">No image selected</div>';

  openModal(
    'Trip Details',
    `
    <div class="form-group">
      <label class="form-label">Cover Photo</label>
      <div class="image-picker" id="image-picker">
        <div id="image-preview-container">${previewHtml}</div>
        <div class="image-picker-actions">
          <button type="button" class="btn btn-secondary" id="pick-image">Choose Image</button>
          <button type="button" class="btn btn-ghost" id="remove-image" ${!dest.image ? 'style="display:none"' : ''}>Remove</button>
        </div>
        <input type="file" id="image-file" accept="image/*" style="display: none;" />
      </div>
    </div>
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
      <label class="form-label">Maps Link</label>
      <input class="form-input" name="mapLink" value="${escapeAttr(dest.mapLink || '')}" placeholder="Paste a Maps share link or embed code" />
      <span class="form-hint">Paste a shared link or embed code to show a map preview</span>
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
        image: pendingImage || '',
        mapLink: extractMapLink(fd.get('mapLink') as string),
        photos: dest.photos || [],
      };
      saveData(data);
      pendingImage = null;
      renderTrip(container);
    }
  );

  const fileInput = document.getElementById('image-file') as HTMLInputElement;
  const pickBtn = document.getElementById('pick-image')!;
  const removeBtn = document.getElementById('remove-image')!;
  const previewContainer = document.getElementById('image-preview-container')!;

  pickBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    resizeImage(file, 1600, 900).then((dataUrl) => {
      pendingImage = dataUrl;
      previewContainer.innerHTML = `<img src="${dataUrl}" class="image-preview" />`;
      removeBtn.style.display = '';
    });
  });

  removeBtn.addEventListener('click', () => {
    pendingImage = null;
    previewContainer.innerHTML = '<div class="image-preview-empty">No image selected</div>';
    removeBtn.style.display = 'none';
    fileInput.value = '';
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
