import { loadData, saveData } from '../shared/storage.ts';
import { openModal, openConfirmModal } from '../shared/components/modal.ts';
import { icons } from '../shared/utils/icons.ts';
import { generateId } from '../shared/utils/id.ts';
import { renderMapHtml, hydrateMapPreviews } from '../shared/utils/maps.ts';
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
      </div>
      <div class="filter-bar">
        <div class="pill-filter">
          ${filters.map((f) => `<button class="pill${f === activeFilter ? ' active' : ''}" data-filter="${f}">${f}</button>`).join('')}
        </div>
      </div>
      <div class="restaurants-list" id="rest-list"></div>
    </div>
    <button class="fab" id="add-rest">${icons.plus}</button>
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
    sorted.forEach((rest) => {
      const photos = rest.photos || [];
      const card = document.createElement('div');
      card.className = `glass-card item-card${rest.visited ? ' dimmed' : ''}`;

      const badgeColor = mealColors[rest.mealType];
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
      if (rest.link) {
        bodyParts.push(`<div class="card-detail">${icons.link} <a href="${escapeAttr(rest.link)}" target="_blank" rel="noopener">Website</a></div>`);
      }
      if (rest.notes) {
        bodyParts.push(`<div style="margin-top: 4px;">${escapeHtml(rest.notes)}</div>`);
      }

      // Map preview
      const mapHtml = rest.mapLink ? `<div class="map-inline">${renderMapHtml(rest.mapLink, icons, true, rest.photos?.[0])}</div>` : '';

      // Photo gallery
      const photoHtml = `<div class="photo-gallery-inline">${renderPhotoGallery(photos, `rest-${rest.id}`)}</div>`;

      card.innerHTML = `
        <div class="card-header">
          <div class="card-header-text">
            <div class="card-title-row">
              <h3 class="card-title">${escapeHtml(rest.name)}</h3>
              <span class="badge" style="background: ${badgeColor}20; color: ${badgeColor}">${rest.mealType}</span>
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

      // Edit
      card.querySelector('.edit-rest')!.addEventListener('click', (e) => {
        e.stopPropagation();
        openRestModal(container, rest);
      });

      // Delete
      card.querySelector('.delete-rest')!.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteRest(container, rest.id);
      });

      // Visited toggle
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

      list.appendChild(card);

      // Wire photo gallery for this restaurant
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
  }

  container.querySelector('#add-rest')!.addEventListener('click', () => openRestModal(container, null));

  // Hydrate any map placeholders that need geocoding
  void hydrateMapPreviews(container);
}

function openRestModal(container: HTMLElement, rest: Restaurant | null): void {
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
      <input class="form-input" name="mapLink" value="${escapeAttr(rest?.mapLink || '')}" placeholder="Paste a Google Maps share link" />
      <span class="form-hint">Paste a shared link to show a map preview</span>
    </div>
    <div class="form-group">
      <label class="form-label">Website</label>
      <input class="form-input" type="url" name="link" value="${escapeAttr(rest?.link || '')}" placeholder="https://..." />
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
        mapLink: fd.get('mapLink') as string,
        link: fd.get('link') as string,
        notes: fd.get('notes') as string,
        visited: rest?.visited || false,
        photos: rest?.photos || [],
      };

      if (isEdit) {
        const idx = data.restaurants.findIndex((r) => r.id === rest!.id);
        if (idx >= 0) data.restaurants[idx] = updated;
      } else {
        data.restaurants.push(updated);
      }

      saveData(data);
      renderRestaurants(container);
    }
  );
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
