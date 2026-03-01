import { isSessionValid, initTheme, getAllTrips, getActiveTripId, setActiveTripId, createTrip, deleteTrip } from './shared/storage.ts';
import { initRouter, navigateTo, getCurrentRoute, type Route } from './shared/router.ts';
import { createTabBar, rebuildTripSelector, updateTabBar } from './shared/components/tab-bar.ts';
import { icons } from './shared/utils/icons.ts';
import { renderAuth } from './auth/auth.ts';
import { renderTrip } from './trip/trip-view.ts';
import { renderCalendar } from './calendar/calendar-view.ts';
import { renderAccommodations } from './accommodations/accommodations-view.ts';
import { renderRestaurants } from './restaurants/restaurants-view.ts';
import { renderSettings } from './settings/settings-view.ts';
import './shared/styles/main.css';

initTheme();

function startApp(): void {
  const app = document.getElementById('app')!;
  app.innerHTML = `
    <div class="app-bg"></div>
    ${buildMobileTripHeaderHtml()}
    <main class="app-content" id="view-container"></main>
  `;

  app.appendChild(createTabBar());
  wireMobileTripSelector();

  const container = document.getElementById('view-container')!;

  const renderCurrentView = (route: Route): void => {
    updateTabBar(route);
    renderView(route, container);
    rebuildTripSelector();
    rebuildMobileTripHeader();
    wireMobileTripSelector();
  };

  initRouter(renderCurrentView);

  document.addEventListener('trip-changed', () => {
    renderCurrentView(getCurrentRoute());
  });

  document.addEventListener('trip-created', () => {
    navigateTo('trip');
    renderCurrentView('trip');
    queueMicrotask(() => {
      (document.getElementById('edit-trip') as HTMLButtonElement | null)?.click();
    });
  });
}

function renderView(route: Route, container: HTMLElement): void {
  container.classList.toggle('trip-page', route === 'trip');
  switch (route) {
    case 'trip':
      renderTrip(container);
      break;
    case 'calendar':
      renderCalendar(container);
      break;
    case 'accommodations':
      renderAccommodations(container);
      break;
    case 'restaurants':
      renderRestaurants(container);
      break;
    case 'settings':
      renderSettings(container);
      break;
  }
}

if (isSessionValid()) {
  startApp();
} else {
  renderAuth(startApp);
}

function buildMobileTripHeaderHtml(): string {
  const trips = getAllTrips();
  const activeId = getActiveTripId();
  const activeTrip = trips.find((trip) => trip.id === activeId);
  const activeName = activeTrip?.destination.name || 'No Trip';

  return `
    <div class="mobile-trip-header" id="mobile-trip-header">
      <button class="mobile-trip-btn" id="mobile-trip-toggle" aria-expanded="false">
        <span class="mobile-trip-name">${escapeHtml(activeName)}</span>
        <span class="mobile-trip-chevron">${icons.chevronRight}</span>
      </button>
      <div class="mobile-trip-dropdown trip-selector-dropdown glass" id="mobile-trip-dropdown" hidden>
        <ul class="trip-selector-list" role="listbox">
          ${trips.map((trip) => `
            <li class="trip-selector-item${trip.id === activeId ? ' active' : ''}" role="option" data-trip-id="${trip.id}">
              <span class="trip-selector-item-name">
                ${trip.destination.name ? escapeHtml(trip.destination.name) : 'Untitled Trip'}
              </span>
              ${trip.id === activeId ? `<span class="trip-selector-item-check">${icons.check}</span>` : ''}
              ${trips.length > 1 ? `<button class="trip-selector-item-delete" data-delete-id="${trip.id}" title="Delete trip">${icons.trash}</button>` : ''}
            </li>
          `).join('')}
        </ul>
        <div class="trip-selector-divider"></div>
        <button class="trip-selector-new" id="mobile-trip-new">
          <span class="trip-selector-new-icon">${icons.plus}</span>
          New Trip
        </button>
      </div>
    </div>
  `;
}

function rebuildMobileTripHeader(): void {
  const oldHeader = document.getElementById('mobile-trip-header');
  if (!oldHeader) return;

  const wrapper = document.createElement('div');
  wrapper.innerHTML = buildMobileTripHeaderHtml();
  const newHeader = wrapper.firstElementChild;
  if (!newHeader) return;

  oldHeader.replaceWith(newHeader);
}

function wireMobileTripSelector(): void {
  const toggle = document.getElementById('mobile-trip-toggle') as HTMLButtonElement | null;
  const dropdown = document.getElementById('mobile-trip-dropdown') as HTMLElement | null;
  const newBtn = document.getElementById('mobile-trip-new') as HTMLButtonElement | null;

  if (!toggle || !dropdown || !newBtn) return;

  const closeOnOutsideClick = (e: MouseEvent): void => {
    if (!dropdown.contains(e.target as Node) && e.target !== toggle) {
      dropdown.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
      document.removeEventListener('click', closeOnOutsideClick);
    }
  };

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = dropdown.hidden;
    dropdown.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    if (open) {
      document.addEventListener('click', closeOnOutsideClick);
    } else {
      document.removeEventListener('click', closeOnOutsideClick);
    }
  });

  document.querySelectorAll('#mobile-trip-dropdown .trip-selector-item').forEach((el) => {
    el.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.trip-selector-item-delete')) return;
      setActiveTripId((el as HTMLElement).dataset.tripId!);
      dropdown.hidden = true;
      document.removeEventListener('click', closeOnOutsideClick);
      document.dispatchEvent(new CustomEvent('trip-changed'));
    });
  });

  document.querySelectorAll('#mobile-trip-dropdown .trip-selector-item-delete').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = (el as HTMLElement).dataset.deleteId;
      if (!id) return;
      deleteTrip(id);
      document.removeEventListener('click', closeOnOutsideClick);
      document.dispatchEvent(new CustomEvent('trip-changed'));
    });
  });

  newBtn.addEventListener('click', () => {
    createTrip();
    dropdown.hidden = true;
    document.removeEventListener('click', closeOnOutsideClick);
    document.dispatchEvent(new CustomEvent('trip-created'));
  });
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
