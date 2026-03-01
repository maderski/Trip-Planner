import { loadData, saveData } from '../shared/storage.ts';
import { openModal } from '../shared/components/modal.ts';
import { icons } from '../shared/utils/icons.ts';
import { formatDate, formatDateRange, formatTime, toDateString, daysUntil } from '../shared/utils/dates.ts';
import { navigateTo } from '../shared/router.ts';
import { renderMapHtml, hydrateMapPreviews } from '../shared/utils/maps.ts';
import { resizeImage, renderPhotoGallery, wirePhotoGallery } from '../shared/utils/photos.ts';
import type { CalendarEvent } from '../calendar/types.ts';
import type { Accommodation } from '../accommodations/types.ts';
import type { Restaurant } from '../restaurants/types.ts';
import './trip.css';

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

  // Map section
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

  // Photo gallery section
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
  const mealColors: Record<string, string> = {
    Breakfast: 'var(--badge-breakfast)', Lunch: 'var(--badge-lunch)',
    Dinner: 'var(--badge-dinner)', Snacks: 'var(--badge-snacks)',
    Drinks: 'var(--badge-drinks)',
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
                  <div class="upcoming-item glass-card">
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
                  <div class="upcoming-item glass-card">
                    <span class="upcoming-icon" style="color:${color}">${icons.bed}</span>
                    <div class="upcoming-info">
                      <div class="upcoming-title">${escapeHtml(acc.name)}</div>
                      <div class="upcoming-meta">${formatDateRange(acc.checkIn, acc.checkOut)} · <span style="color:${color}">${acc.type}</span></div>
                    </div>
                  </div>`;
              } else {
                const rest = item as Restaurant;
                const color = mealColors[rest.mealType] ?? 'var(--text-tertiary)';
                const meta = [rest.mealType, rest.cuisineType].filter(Boolean).join(' · ');
                return `
                  <div class="upcoming-item glass-card">
                    <span class="upcoming-icon" style="color:${color}">${icons.restaurant}</span>
                    <div class="upcoming-info">
                      <div class="upcoming-title">${escapeHtml(rest.name)}</div>
                      ${meta ? `<div class="upcoming-meta">${escapeHtml(meta)}</div>` : ''}
                    </div>
                  </div>`;
              }
            }).join('')}
          </div>
        `).join('')}
      </div>
    </div>
  `;

  container.innerHTML = `
    <div class="view">
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
  `;

  // Hydrate any map placeholders that need geocoding
  void hydrateMapPreviews(container);

  container.querySelector('#edit-trip')!.addEventListener('click', () => openTripModal(container));

  container.querySelectorAll('.bento-card').forEach((card) => {
    card.addEventListener('click', () => {
      const route = (card as HTMLElement).dataset.nav;
      if (route) navigateTo(route as 'calendar' | 'accommodations' | 'restaurants');
    });
  });

  // Wire photo gallery
  wirePhotoGallery(container, 'trip', photos, (updatedPhotos) => {
    const d = loadData();
    d.destination.photos = updatedPhotos;
    saveData(d);
    renderTrip(container);
  });
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
      <input class="form-input" name="mapLink" value="${escapeAttr(dest.mapLink || '')}" placeholder="Paste a Google Maps share link" />
      <span class="form-hint">Paste a shared link from Google Maps, Apple Maps, etc.</span>
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
        mapLink: fd.get('mapLink') as string,
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
    resizeImage(file, 800, 600).then((dataUrl) => {
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
