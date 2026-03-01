import { isSessionValid, initTheme } from './shared/storage.ts';
import { initRouter, type Route } from './shared/router.ts';
import { createTabBar, updateTabBar } from './shared/components/tab-bar.ts';
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
    <main class="app-content" id="view-container"></main>
  `;

  app.appendChild(createTabBar());

  initRouter((route: Route) => {
    const container = document.getElementById('view-container')!;
    updateTabBar(route);
    renderView(route, container);
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
