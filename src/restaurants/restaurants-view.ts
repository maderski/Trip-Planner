import { loadData, saveData } from '../shared/storage.ts';
import { openModal, openConfirmModal } from '../shared/components/modal.ts';
import { icons } from '../shared/utils/icons.ts';
import { formatDate } from '../shared/utils/dates.ts';
import { generateId } from '../shared/utils/id.ts';
import { renderMapHtml, hydrateMapPreviews, extractMapLink } from '../shared/utils/maps.ts';
import { renderPhotoGallery, wirePhotoGallery } from '../shared/utils/photos.ts';
import type { Restaurant, MealType, PriceRange } from './types.ts';
import './restaurants.css';

const mealColors: Record<MealType, string> = {
  Breakfast: 'var(--badge-breakfast)',
  Lunch: 'var(--badge-lunch)',
  Dinner: 'var(--badge-dinner)',
  Snacks: 'var(--badge-snacks)',
  Drinks: 'var(--badge-drinks)',
};

let activeFilter: MealType | 'All' = 'All';

export function renderRestaurants(container: HTMLElement): void {
  const data = loadData();
  const filters: (MealType | 'All')[] = ['All', 'Breakfast', 'Lunch', 'Dinner', 'Snacks', 'Drinks'];

  let filtered = data.restaurants;
  if (activeFilter !== 'All') {
    filtered = filtered.filter((r) => r.mealType === activeFilter);
  }

  const sorted = [...filtered].sort((a, b) => {
    if (a.visited !== b.visited) return a.visited ? 1 : -1;
    return a.name.localeCompare(b.name);
  });

  container.innerHTML = `
    <div class="view">
      <div class="view-header">
        <h1 class="view-title">Restaurants</h1>
        <button class="view-header-btn" id="add-rest">${icons.plus}</button>
      </div>
      <div class="filter-bar">
        <div class="pill-filter">
          ${filters.map((f) => `<button class="pill${f === activeFilter ? ' active' : ''}" data-filter="${f}">${f}</button>`).join('')}
        </div>
      </div>
      <div class="restaurants-list" id="rest-list"></div>
    </div>
  `;

  container.querySelectorAll('.pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      activeFilter = (pill as HTMLElement).dataset.filter as MealType | 'All';
      renderRestaurants(container);
    });
  });

  const list = container.querySelector('#rest-list')!;

  if (sorted.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        ${icons.restaurant}
        <p>No restaurants yet.<br/>Tap + to add one.</p>
      </div>
    `;
  } else {
    const scheduled = sorted.filter((r) => !!r.visitDate);
    const unscheduled = sorted.filter((r) => !r.visitDate);
    const dateGroups = new Map<string, Restaurant[]>();
    for (const rest of scheduled) {
      const key = rest.visitDate!;
      if (!dateGroups.has(key)) dateGroups.set(key, []);
      dateGroups.get(key)!.push(rest);
    }

    const groups: Array<{ label: string; items: Restaurant[] }> = [];
    Array.from(dateGroups.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([date, items]) => {
        groups.push({ label: formatDate(date), items });
      });
    if (unscheduled.length > 0) {
      groups.push({ label: 'Unscheduled', items: unscheduled });
    }

    groups.forEach((group) => {
      const groupEl = document.createElement('div');
      groupEl.className = 'date-group';
      groupEl.innerHTML = `<div class="date-group-label">${group.label}</div>`;

      group.items.forEach((rest) => {
        const photos = rest.photos || [];
        const card = document.createElement('div');
        card.className = `glass-card item-card${rest.visited ? ' dimmed' : ''}`;

        const badgeColor = mealColors[rest.mealType];
        const suggestedBadge = rest.suggested ? ' <span class="badge badge-suggested">Suggested</span>' : '';
        const bodyParts: string[] = [];

        if (rest.priceRange) {
          bodyParts.push(`<span class="restaurant-price">${rest.priceRange}</span>`);
        }
        if (rest.cuisineType) {
          bodyParts.push(`<span>${escapeHtml(rest.cuisineType)}</span>`);
        }
        if (rest.address) {
          bodyParts.push(`<div class="card-detail">${icons.mapPin} <a href="https://maps.google.com/?q=${encodeURIComponent(rest.address)}" target="_blank" rel="noopener">${escapeHtml(rest.address)}</a></div>`);
        }
        if (rest.menuLink) {
          bodyParts.push(`<div class="card-detail">${icons.menu} <a href="${escapeAttr(rest.menuLink)}" target="_blank" rel="noopener">Menu</a></div>`);
        }
        if (rest.visitDate || rest.suggested) {
          const dateText = rest.suggested ? 'TBD' : formatDate(rest.visitDate!);
          const tbdClass = rest.suggested ? ' suggested-tbd' : '';
          bodyParts.push(`<div class="card-detail${tbdClass}">${icons.calendar} <span>${dateText}</span></div>`);
        }
        if (rest.notes) {
          bodyParts.push(`<div style="margin-top: 4px;">${escapeHtml(rest.notes)}</div>`);
        }

        const mapHtml = rest.mapLink ? `<div class="map-inline">${renderMapHtml(rest.mapLink, icons, true, rest.photos?.[0])}</div>` : '';
        const photoHtml = `<div class="photo-gallery-inline">${renderPhotoGallery(photos, `rest-${rest.id}`)}</div>`;

        card.innerHTML = `
          <div class="card-header">
            <div class="card-header-text">
              <div class="card-title-row">
                <h3 class="card-title">${escapeHtml(rest.name)}</h3>
                <span class="badge" style="background: ${badgeColor}20; color: ${badgeColor}">${rest.mealType}</span>${suggestedBadge}
              </div>
            </div>
            <div class="card-actions">
              <button class="btn btn-ghost card-action-btn edit-rest" title="Edit"><span>${icons.edit}</span></button>
              <button class="btn btn-ghost card-action-btn danger delete-rest" title="Delete"><span>${icons.trash}</span></button>
            </div>
          </div>
          <div class="card-body">
            ${bodyParts.join(' ')}
            ${mapHtml}
            ${photoHtml}
            <div class="restaurant-visited">
              <input type="checkbox" id="visited-${rest.id}" ${rest.visited ? 'checked' : ''} />
              <label for="visited-${rest.id}">Visited</label>
            </div>
          </div>
        `;

        card.querySelector('.edit-rest')!.addEventListener('click', (e) => {
          e.stopPropagation();
          openRestModal(container, rest);
        });

        card.querySelector('.delete-rest')!.addEventListener('click', (e) => {
          e.stopPropagation();
          deleteRest(container, rest.id);
        });

        const checkbox = card.querySelector<HTMLInputElement>(`#visited-${rest.id}`)!;
        checkbox.addEventListener('change', () => {
          const d = loadData();
          const r = d.restaurants.find((x) => x.id === rest.id);
          if (r) {
            r.visited = checkbox.checked;
            saveData(d);
            renderRestaurants(container);
          }
        });

        groupEl.appendChild(card);

        wirePhotoGallery(card, `rest-${rest.id}`, photos, (updatedPhotos) => {
          const d = loadData();
          const target = d.restaurants.find((x) => x.id === rest.id);
          if (target) {
            target.photos = updatedPhotos;
            saveData(d);
            renderRestaurants(container);
          }
        });
      });

      list.appendChild(groupEl);
    });
  }

  container.querySelector('#add-rest')!.addEventListener('click', () => openRestModal(container, null));

  // Hydrate any map placeholders that need geocoding
  void hydrateMapPreviews(container);
}

export function openRestModal(container: HTMLElement, rest: Restaurant | null, onSave?: () => void): void {
  const isEdit = !!rest;
  const meals: MealType[] = ['Breakfast', 'Lunch', 'Dinner', 'Snacks', 'Drinks'];
  const prices: PriceRange[] = ['$', '$$', '$$$', '$$$$'];

  openModal(
    isEdit ? 'Edit Restaurant' : 'Add Restaurant',
    `
    <div class="form-group">
      <label class="form-label">Name</label>
      <input class="form-input" name="name" value="${escapeAttr(rest?.name || '')}" placeholder="Restaurant name" required />
    </div>
    <div class="form-group">
      <label class="checkbox-label">
        <input type="checkbox" name="suggested" ${rest?.suggested ? 'checked' : ''} />
        Suggested (Date TBD)
      </label>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Meal Type</label>
        <select class="form-input" name="mealType">
          ${meals.map((m) => `<option value="${m}"${rest?.mealType === m ? ' selected' : ''}>${m}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Price Range</label>
        <select class="form-input" name="priceRange">
          ${prices.map((p) => `<option value="${p}"${rest?.priceRange === p ? ' selected' : ''}>${p}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Cuisine Type</label>
      <input class="form-input" name="cuisineType" value="${escapeAttr(rest?.cuisineType || '')}" placeholder="e.g. Italian, Mexican" />
    </div>
    <div class="form-group">
      <label class="form-label">Address</label>
      <input class="form-input" name="address" value="${escapeAttr(rest?.address || '')}" placeholder="123 Main St" />
    </div>
    <div class="form-group">
      <label class="form-label">Maps Link</label>
      <input class="form-input" name="mapLink" value="${escapeAttr(rest?.mapLink || '')}" placeholder="Paste a Maps share link or embed code" />
      <span class="form-hint">Paste a shared link or embed code to show a map preview</span>
    </div>
    <div class="form-group">
      <label class="form-label">Menu Link</label>
      <input class="form-input" type="url" name="menuLink" value="${escapeAttr(rest?.menuLink || '')}" placeholder="https://..." />
    </div>
    <div class="form-group date-time-fields"${rest?.suggested ? ' style="opacity:0.4;pointer-events:none"' : ''}>
      <label class="form-label">Visit Date</label>
      <input class="form-input" type="date" name="visitDate" value="${rest?.visitDate || ''}" />
      <span class="form-hint">Pins this restaurant to a day on the calendar</span>
    </div>
    <div class="form-group">
      <label class="form-label">Notes</label>
      <textarea class="form-input" name="notes" placeholder="Recommendations, dietary info...">${escapeHtml(rest?.notes || '')}</textarea>
    </div>
    `,
    (form) => {
      const fd = new FormData(form);
      const data = loadData();
      const updated: Restaurant = {
        id: rest?.id || generateId(),
        name: fd.get('name') as string,
        mealType: fd.get('mealType') as MealType,
        priceRange: fd.get('priceRange') as PriceRange,
        cuisineType: fd.get('cuisineType') as string,
        address: fd.get('address') as string,
        mapLink: extractMapLink(fd.get('mapLink') as string),
        link: rest?.link || '',
        menuLink: fd.get('menuLink') as string,
        visitDate: (fd.get('visitDate') as string) || undefined,
        notes: fd.get('notes') as string,
        visited: rest?.visited || false,
        photos: rest?.photos || [],
        suggested: form.querySelector<HTMLInputElement>('input[name="suggested"]')!.checked,
      };

      if (isEdit) {
        const idx = data.restaurants.findIndex((r) => r.id === rest!.id);
        if (idx >= 0) data.restaurants[idx] = updated;
      } else {
        data.restaurants.push(updated);
      }

      saveData(data);
      onSave ? onSave() : renderRestaurants(container);
    }
  );

  // Wire up suggested checkbox to toggle date field visibility
  const overlay = document.querySelector('.modal-overlay')!;
  const suggestedCb = overlay.querySelector<HTMLInputElement>('input[name="suggested"]')!;
  const dateTimeFields = overlay.querySelector<HTMLElement>('.date-time-fields')!;
  suggestedCb.addEventListener('change', () => {
    dateTimeFields.style.opacity = suggestedCb.checked ? '0.4' : '';
    dateTimeFields.style.pointerEvents = suggestedCb.checked ? 'none' : '';
  });
}

function deleteRest(container: HTMLElement, id: string): void {
  openConfirmModal('Delete Restaurant', 'Are you sure you want to delete this restaurant?', 'Delete', () => {
    const data = loadData();
    data.restaurants = data.restaurants.filter((r) => r.id !== id);
    saveData(data);
    renderRestaurants(container);
  }, true);
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str: string): string {
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
