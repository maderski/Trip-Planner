export type Route = 'trip' | 'calendar' | 'accommodations' | 'restaurants' | 'settings';

type RouteHandler = (route: Route) => void;

let currentRoute: Route = 'trip';
let handler: RouteHandler | null = null;

export function getCurrentRoute(): Route {
  const hash = window.location.hash.slice(1) as Route;
  const valid: Route[] = ['trip', 'calendar', 'accommodations', 'restaurants', 'settings'];
  return valid.includes(hash) ? hash : 'trip';
}

export function navigateTo(route: Route): void {
  window.location.hash = route;
}

export function initRouter(onRoute: RouteHandler): void {
  handler = onRoute;
  currentRoute = getCurrentRoute();

  window.addEventListener('hashchange', () => {
    const route = getCurrentRoute();
    if (route !== currentRoute) {
      currentRoute = route;
      handler?.(route);
    }
  });

  handler(currentRoute);
}
