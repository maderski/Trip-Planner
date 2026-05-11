import { beforeEach, describe, expect, it, vi } from 'vitest';

type Trip = {
  id: string;
  destination: { name: string };
};

const navigateTo = vi.fn();
const getCurrentRoute = vi.fn(() => 'calendar');
const setActiveTripId = vi.fn();
const createTrip = vi.fn();
const deleteTrip = vi.fn();

let trips: Trip[] = [
  { id: 'trip-1', destination: { name: 'Paris' } },
  { id: 'trip-2', destination: { name: 'Tokyo' } },
];
let activeTripId = 'trip-1';

vi.mock('../router.ts', () => ({
  navigateTo,
  getCurrentRoute,
}));

vi.mock('../storage.ts', () => ({
  getAllTrips: () => trips,
  getActiveTripId: () => activeTripId,
  setActiveTripId,
  createTrip,
  deleteTrip,
}));

describe('tab-bar', () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = '';
    navigateTo.mockReset();
    getCurrentRoute.mockReset();
    getCurrentRoute.mockReturnValue('calendar');
    setActiveTripId.mockReset();
    createTrip.mockReset();
    deleteTrip.mockReset();
    trips = [
      { id: 'trip-1', destination: { name: 'Paris' } },
      { id: 'trip-2', destination: { name: 'Tokyo' } },
    ];
    activeTripId = 'trip-1';
  });

  it('renders tabs and routes clicks through navigateTo', async () => {
    const { createTabBar } = await import('./tab-bar.ts');
    const nav = createTabBar();
    document.body.appendChild(nav);

    expect(nav.querySelectorAll('.tab-item')).toHaveLength(5);
    expect(nav.querySelector('.tab-item.active')?.getAttribute('data-route')).toBe('calendar');
    expect(nav.querySelector('#sidebar-trip-toggle')?.textContent).toContain('Paris');

    nav.querySelector<HTMLElement>('.tab-item[data-route="restaurants"]')?.click();
    expect(navigateTo).toHaveBeenCalledWith('restaurants');
  });

  it('wires trip selector interactions and rebuilds with updated trip data', async () => {
    const tripChanged = vi.fn();
    const tripCreated = vi.fn();
    document.addEventListener('trip-changed', tripChanged);
    document.addEventListener('trip-created', tripCreated);

    const { createTabBar, rebuildTripSelector, updateTabBar } = await import('./tab-bar.ts');
    const nav = createTabBar();
    document.body.appendChild(nav);

    const toggle = nav.querySelector('#sidebar-trip-toggle') as HTMLButtonElement;
    const dropdown = nav.querySelector('#sidebar-trip-dropdown') as HTMLElement;
    toggle.click();
    expect(dropdown.hidden).toBe(false);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    nav.querySelector<HTMLElement>('.trip-selector-item[data-trip-id="trip-2"]')?.click();
    expect(setActiveTripId).toHaveBeenCalledWith('trip-2');
    expect(tripChanged).toHaveBeenCalledTimes(1);

    nav.querySelector<HTMLElement>('.trip-selector-item-delete[data-delete-id="trip-2"]')?.click();
    expect(deleteTrip).toHaveBeenCalledWith('trip-2');
    expect(tripChanged).toHaveBeenCalledTimes(2);

    nav.querySelector<HTMLElement>('#sidebar-trip-new')?.click();
    expect(createTrip).toHaveBeenCalledTimes(1);
    expect(tripCreated).toHaveBeenCalledTimes(1);

    activeTripId = 'trip-2';
    trips = [
      { id: 'trip-1', destination: { name: 'Paris' } },
      { id: 'trip-2', destination: { name: 'Kyoto' } },
    ];
    rebuildTripSelector();
    expect(nav.querySelector('#sidebar-trip-toggle')?.textContent).toContain('Kyoto');

    updateTabBar('settings');
    expect(nav.querySelector('.tab-item.active')?.getAttribute('data-route')).toBe('settings');
  });
});
