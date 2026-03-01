import { icons } from '../utils/icons.ts';
import type { Route } from '../router.ts';
import { navigateTo, getCurrentRoute } from '../router.ts';
import { getAllTrips, getActiveTripId, setActiveTripId, createTrip, deleteTrip } from '../storage.ts';

const tabs: { route: Route; icon: string; label: string }[] = [
  { route: 'trip', icon: icons.trip, label: 'Trip' },
  { route: 'calendar', icon: icons.calendar, label: 'Events' },
  { route: 'accommodations', icon: icons.bed, label: 'Stays' },
  { route: 'restaurants', icon: icons.restaurant, label: 'Food' },
  { route: 'settings', icon: icons.settings, label: 'Settings' },
];

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function buildTripSelectorHtml(): string {
  const trips = getAllTrips();
  const activeId = getActiveTripId();
  const activeTrip = trips.find((trip) => trip.id === activeId);
  const activeName = activeTrip?.destination.name || 'No Trip';

  return `
    <div class="sidebar-trip-wrap">
      <div class="sidebar-nav-divider"></div>
      <div class="sidebar-trip-selector">
        <button class="sidebar-trip-btn" id="sidebar-trip-toggle" aria-expanded="false">
          <span class="sidebar-trip-icon">${icons.trip}</span>
          <span class="sidebar-trip-name">${escapeHtml(activeName)}</span>
          <span class="sidebar-trip-chevron">${icons.chevronRight}</span>
        </button>
        <div class="trip-selector-dropdown sidebar-trip-dropdown glass" id="sidebar-trip-dropdown" hidden>
          <ul class="trip-selector-list" role="listbox">
            ${trips.map((trip) => `
              <li class="trip-selector-item${trip.id === activeId ? ' active' : ''}" role="option" data-trip-id="${trip.id}">
                <span class="trip-selector-item-name">${trip.destination.name ? escapeHtml(trip.destination.name) : 'Untitled Trip'}</span>
                ${trip.id === activeId ? `<span class="trip-selector-item-check">${icons.check}</span>` : ''}
                ${trips.length > 1 ? `<button class="trip-selector-item-delete" data-delete-id="${trip.id}" title="Delete trip">${icons.trash}</button>` : ''}
              </li>
            `).join('')}
          </ul>
          <div class="trip-selector-divider"></div>
          <button class="trip-selector-new" id="sidebar-trip-new">
            <span class="trip-selector-new-icon">${icons.plus}</span>
            New Trip
          </button>
        </div>
      </div>
    </div>
  `;
}

function wireTripSelectorEvents(nav: HTMLElement): void {
  const sidebarToggle = nav.querySelector('#sidebar-trip-toggle') as HTMLButtonElement | null;
  const sidebarDropdown = nav.querySelector('#sidebar-trip-dropdown') as HTMLElement | null;
  const newBtn = nav.querySelector('#sidebar-trip-new') as HTMLButtonElement | null;

  if (!sidebarToggle || !sidebarDropdown || !newBtn) return;

  const closeOnOutsideClick = (e: MouseEvent): void => {
    if (!sidebarDropdown.contains(e.target as Node) && e.target !== sidebarToggle) {
      sidebarDropdown.hidden = true;
      sidebarToggle.setAttribute('aria-expanded', 'false');
      document.removeEventListener('click', closeOnOutsideClick);
    }
  };

  sidebarToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = sidebarDropdown.hidden;
    sidebarDropdown.hidden = !open;
    sidebarToggle.setAttribute('aria-expanded', String(open));
    if (open) {
      document.addEventListener('click', closeOnOutsideClick);
    } else {
      document.removeEventListener('click', closeOnOutsideClick);
    }
  });

  nav.querySelectorAll('.trip-selector-item').forEach((el) => {
    el.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.trip-selector-item-delete')) return;
      setActiveTripId((el as HTMLElement).dataset.tripId!);
      sidebarDropdown.hidden = true;
      document.removeEventListener('click', closeOnOutsideClick);
      document.dispatchEvent(new CustomEvent('trip-changed'));
    });
  });

  nav.querySelectorAll('.trip-selector-item-delete').forEach((el) => {
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
    sidebarDropdown.hidden = true;
    document.removeEventListener('click', closeOnOutsideClick);
    document.dispatchEvent(new CustomEvent('trip-created'));
  });
}

export function createTabBar(): HTMLElement {
  const nav = document.createElement('nav');
  nav.className = 'tab-bar';
  nav.innerHTML = `
    ${tabs
      .map(
        (tab) => `
      <button class="tab-item${tab.route === getCurrentRoute() ? ' active' : ''}" data-route="${tab.route}">
        <span class="tab-icon">${tab.icon}</span>
        <span class="tab-label">${tab.label}</span>
      </button>
    `
      )
      .join('')}
    ${buildTripSelectorHtml()}
  `;

  nav.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('.tab-item') as HTMLElement | null;
    if (!btn) return;
    const route = btn.dataset.route as Route;
    navigateTo(route);
  });

  wireTripSelectorEvents(nav);
  return nav;
}

export function rebuildTripSelector(): void {
  const nav = document.querySelector('.tab-bar') as HTMLElement | null;
  if (!nav) return;

  const oldWrap = nav.querySelector('.sidebar-trip-wrap');
  if (!oldWrap) return;

  const newWrap = document.createElement('div');
  newWrap.innerHTML = buildTripSelectorHtml();
  const replacement = newWrap.firstElementChild;
  if (!replacement) return;

  oldWrap.replaceWith(replacement);
  wireTripSelectorEvents(nav);
}

export function updateTabBar(route: Route): void {
  document.querySelectorAll('.tab-item').forEach((el) => {
    el.classList.toggle('active', (el as HTMLElement).dataset.route === route);
  });
}

const style = document.createElement('style');
style.textContent = `
.tab-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
  display: flex;
  justify-content: space-around;
  align-items: center;
  height: var(--tab-bar-height);
  background: rgba(10, 10, 26, 0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-top: 1px solid var(--border);
  padding-bottom: env(safe-area-inset-bottom, 0);
}

[data-theme='light'] .tab-bar {
  background: rgba(240, 240, 248, 0.85);
}

.tab-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: var(--space-xs) var(--space-sm);
  min-width: 48px;
  min-height: 44px;
  color: var(--text-tertiary);
  transition: color var(--transition-fast), transform var(--transition-fast);
  -webkit-tap-highlight-color: transparent;
}

.tab-item:active {
  transform: scale(0.9);
}

.tab-item.active {
  color: var(--accent-light);
}

.tab-icon {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tab-icon svg {
  width: 100%;
  height: 100%;
}

.tab-label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.3px;
}

@media (min-width: 1024px) {
  .tab-bar {
    top: 0;
    right: auto;
    width: var(--sidebar-width);
    height: 100dvh;
    flex-direction: column;
    justify-content: flex-start;
    align-items: stretch;
    padding: var(--space-2xl) var(--space-md) var(--space-lg);
    gap: var(--space-xs);
    border-top: none;
    border-right: 1px solid var(--border);
  }

  .sidebar-trip-selector {
    position: relative;
    margin-top: auto;
    padding: 0 var(--space-xs);
  }

  .sidebar-trip-btn {
    display: flex;
    align-items: center;
    width: 100%;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-md);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: background var(--transition-fast);
    min-width: 0;
  }

  .sidebar-trip-btn:hover { background: var(--surface-hover); }

  .sidebar-trip-icon {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    color: var(--text-secondary);
  }

  .sidebar-trip-icon svg { width: 18px; height: 18px; }

  .sidebar-trip-name {
    font-size: var(--font-sm);
    font-weight: 600;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
    text-align: left;
  }

  .sidebar-trip-chevron {
    display: flex;
    align-items: center;
    color: var(--text-tertiary);
    transition: transform var(--transition-fast);
    flex-shrink: 0;
  }

  .sidebar-trip-btn[aria-expanded="true"] .sidebar-trip-chevron {
    transform: rotate(-90deg);
  }

  .sidebar-trip-chevron svg { width: 14px; height: 14px; }

  .sidebar-trip-dropdown {
    position: absolute;
    bottom: calc(100% + var(--space-xs));
    left: 0;
    right: 0;
    z-index: 50;
    width: auto;
    min-width: unset;
    max-width: unset;
    transform: none;
    padding: var(--space-xs) 0;
    animation: sidebarDropUpIn var(--transition-fast) ease;
  }

  @keyframes sidebarDropUpIn {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .sidebar-nav-divider {
    height: 1px;
    background: var(--border);
    margin: var(--space-sm) var(--space-md);
    margin-top: auto;
  }

  .tab-item {
    flex-direction: row;
    justify-content: flex-start;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-md);
    border-radius: var(--radius-md);
    min-width: 0;
  }

  .tab-item.active {
    background: var(--surface-active);
  }

  .tab-icon {
    width: 20px;
    height: 20px;
  }

  .tab-label {
    font-size: var(--font-sm);
    letter-spacing: 0;
  }
}

.trip-selector-item-delete {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  padding: 2px;
  border-radius: var(--radius-sm);
  color: var(--text-tertiary);
  opacity: 0;
  transition: opacity var(--transition-fast), color var(--transition-fast), background var(--transition-fast);
}

.trip-selector-item:hover .trip-selector-item-delete {
  opacity: 1;
}

.trip-selector-item-delete:hover {
  color: var(--error, #f87171);
  background: rgba(248, 113, 113, 0.1);
}

.trip-selector-item-delete svg { width: 13px; height: 13px; }

@media (max-width: 1023px) {
  .sidebar-trip-wrap,
  .sidebar-trip-selector,
  .sidebar-nav-divider { display: none; }
}
`;
document.head.appendChild(style);
