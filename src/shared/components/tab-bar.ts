import { icons } from '../utils/icons.ts';
import type { Route } from '../router.ts';
import { navigateTo, getCurrentRoute } from '../router.ts';

const tabs: { route: Route; icon: string; label: string }[] = [
  { route: 'trip', icon: icons.trip, label: 'Trip' },
  { route: 'calendar', icon: icons.calendar, label: 'Calendar' },
  { route: 'accommodations', icon: icons.bed, label: 'Stays' },
  { route: 'restaurants', icon: icons.restaurant, label: 'Food' },
  { route: 'settings', icon: icons.settings, label: 'Settings' },
];

export function createTabBar(): HTMLElement {
  const nav = document.createElement('nav');
  nav.className = 'tab-bar';
  nav.innerHTML = tabs
    .map(
      (tab) => `
    <button class="tab-item${tab.route === getCurrentRoute() ? ' active' : ''}" data-route="${tab.route}">
      <span class="tab-icon">${tab.icon}</span>
      <span class="tab-label">${tab.label}</span>
    </button>
  `
    )
    .join('');

  nav.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('.tab-item') as HTMLElement | null;
    if (!btn) return;
    const route = btn.dataset.route as Route;
    navigateTo(route);
  });

  return nav;
}

export function updateTabBar(route: Route): void {
  document.querySelectorAll('.tab-item').forEach((el) => {
    el.classList.toggle('active', (el as HTMLElement).dataset.route === route);
  });
}

// Inject tab-bar CSS
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
`;
document.head.appendChild(style);
