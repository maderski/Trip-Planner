import { loadData, saveData } from '../shared/storage.ts';
import { openModal, openConfirmModal } from '../shared/components/modal.ts';
import { createCard } from '../shared/components/card.ts';
import { icons } from '../shared/utils/icons.ts';
import { generateId } from '../shared/utils/id.ts';
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

  // Sort: unvisited first, then by name
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

      bodyParts.push(`
        <div class="restaurant-visited">
          <input type="checkbox" id="visited-${rest.id}" ${rest.visited ? 'checked' : ''} />
          <label for="visited-${rest.id}">Visited</label>
        </div>
      `);

      const card = createCard({
        title: rest.name,
        badge: { label: rest.mealType, color: mealColors[rest.mealType] },
        body: bodyParts.join(' '),
        dimmed: rest.visited,
        actions: [
          { icon: icons.edit, label: 'Edit', onClick: () => openRestModal(container, rest) },
          { icon: icons.trash, label: 'Delete', danger: true, onClick: () => deleteRest(container, rest.id) },
        ],
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

      list.appendChild(card);
    });
  }

  container.querySelector('#add-rest')!.addEventListener('click', () => openRestModal(container, null));
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
        link: fd.get('link') as string,
        notes: fd.get('notes') as string,
        visited: rest?.visited || false,
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
