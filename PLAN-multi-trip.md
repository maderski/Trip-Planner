# Plan: Multi-Trip Support — Trip Selector in Sidebar (Bottom Left)

## Context

The app currently supports only one trip. All data (destination, events, stays, restaurants) is stored as a single `TripData` object under `'trip-planner-data'` in localStorage. The trip selector lives in the **bottom-left corner of the sidebar** on desktop, always accessible from any tab. On mobile (bottom tab bar), a compact trip selector strip appears at the top of the content area. Each trip in the dropdown has a delete button (hidden when only one trip exists).

---

## Architecture

### Key Insight
`loadData()` and `saveData()` are called by every view with the same signature. Making them internally proxy through the "active trip" means calendar, accommodations, and restaurants views need **zero changes** — they automatically scope to the selected trip.

### New Data Model

**`src/shared/types.ts`** — add `id` to `TripData`, add `AppData` envelope:

```typescript
export interface TripData {
  version: 1;
  id: string;           // NEW
  destination: Destination;
  events: CalendarEvent[];
  accommodations: Accommodation[];
  restaurants: Restaurant[];
}

export interface AppData {
  version: 2;
  trips: TripData[];
  activeTripId: string;
}
```

`Destination` and all other types are unchanged.

### Migration
Existing `version: 1` localStorage data is auto-detected on first load and wrapped into `AppData`. The migrated data is written back immediately so migration only runs once.

---

## Where the Trip Selector Lives

| Screen | Location | How |
|--------|----------|-----|
| Desktop (≥1024px) | **Bottom-left corner of sidebar**, below nav items | Added to `tab-bar.ts`; dropdown opens upward |
| Mobile (<1024px) | Compact strip at top of content area | Added to `main.ts`; dropdown opens downward |

CSS `display: none` media queries ensure only one version is visible at a time.

---

## Implementation Steps

### Step 1 — Update `src/shared/types.ts`
- Add `id: string` to `TripData`
- Add `AppData` interface

### Step 2 — Rewrite data functions in `src/shared/storage.ts`

Passcode/session/theme functions are unchanged.

```typescript
function generateId(): string { return crypto.randomUUID(); }

function defaultTripData(): TripData {
  return {
    version: 1, id: generateId(),
    destination: { name:'', startDate:'', endDate:'', notes:'', image:'', mapLink:'', photos:[] },
    events:[], accommodations:[], restaurants:[],
  };
}

function defaultAppData(): AppData {
  const trip = defaultTripData();
  return { version: 2, trips: [trip], activeTripId: trip.id };
}

function migrateIfNeeded(raw: unknown): AppData {
  if (raw && (raw as any).version === 1 && (raw as any).destination !== undefined) {
    const trip = { ...(raw as TripData), id: (raw as any).id ?? generateId() };
    return { version: 2, trips: [trip], activeTripId: trip.id };
  }
  return raw as AppData;
}

// Internal
function loadAppData(): AppData  // parse localStorage + migrate
function saveAppData(app: AppData): void

// Public — unchanged signatures, now proxy through active trip
export function loadData(): TripData
export function saveData(data: TripData): void

// Public — new trip management API
export function getAllTrips(): TripData[]
export function getActiveTripId(): string
export function setActiveTripId(id: string): void
export function createTrip(): TripData     // creates blank, sets as active
export function deleteTrip(id: string): void  // no-op if only 1 trip remains
```

Update `exportData()` / `importData()` for `AppData`. `importData` must also accept legacy `version: 1` via `migrateIfNeeded`.

### Step 3 — Update `src/shared/components/tab-bar.ts`

**Imports** — add: `getAllTrips`, `getActiveTripId`, `setActiveTripId`, `createTrip`, `deleteTrip`

**Position in HTML** — the trip selector is **appended after** all `.tab-item` elements (not prepended before them). `margin-top: auto` in CSS pushes it to the bottom of the sidebar flex column.

**Helper** — `buildTripSelectorHtml(trips, activeId)` returns:

```html
<div class="sidebar-nav-divider"></div>
<div class="sidebar-trip-selector">
  <button class="sidebar-trip-btn" id="sidebar-trip-toggle" aria-expanded="false">
    <span class="sidebar-trip-icon">[icons.map or icons.trip]</span>
    <span class="sidebar-trip-name">[active trip name or 'No Trip']</span>
    <span class="sidebar-trip-chevron">[icons.chevronRight]</span>
  </button>

  <div class="sidebar-trip-dropdown glass" id="sidebar-trip-dropdown" hidden>
    <ul class="trip-selector-list" role="listbox">
      ${trips.map(t => `
        <li class="trip-selector-item${t.id === activeId ? ' active' : ''}"
            role="option" data-trip-id="${t.id}">
          <span class="trip-selector-item-name">
            ${t.destination.name || 'Untitled Trip'}
          </span>
          ${t.id === activeId
            ? `<span class="trip-selector-item-check">[icons.check]</span>`
            : ''}
          ${trips.length > 1
            ? `<button class="trip-selector-item-delete" data-delete-id="${t.id}" title="Delete trip">
                 [icons.trash or icons.close]
               </button>`
            : ''}
        </li>
      `).join('')}
    </ul>
    <div class="trip-selector-divider"></div>
    <button class="trip-selector-new" id="sidebar-trip-new">
      [icons.plus] New Trip
    </button>
  </div>
</div>
```

**Note on delete icon**: Use `icons.trash` if it exists in `src/shared/utils/icons.ts`; otherwise use `icons.close`. Check at implementation time and add a trash SVG to icons.ts if needed.

**Event wiring** — add inside `createTabBar()`:

```typescript
// Toggle dropdown
sidebarToggle.addEventListener('click', (e) => {
  e.stopPropagation();
  const open = sidebarDropdown.hidden;
  sidebarDropdown.hidden = !open;
  sidebarToggle.setAttribute('aria-expanded', String(open));
});

// Close on outside click
document.addEventListener('click', function close(e) {
  if (!sidebarDropdown.contains(e.target as Node) && e.target !== sidebarToggle) {
    sidebarDropdown.hidden = true;
    sidebarToggle.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', close);
  }
});

// Trip item selection (stop propagation so delete button doesn't also trigger this)
nav.querySelectorAll('.trip-selector-item').forEach(el => {
  el.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('.trip-selector-item-delete')) return;
    setActiveTripId((el as HTMLElement).dataset.tripId!);
    sidebarDropdown.hidden = true;
    document.dispatchEvent(new CustomEvent('trip-changed'));
  });
});

// Delete trip
nav.querySelectorAll('.trip-selector-item-delete').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const id = (btn as HTMLElement).dataset.deleteId!;
    deleteTrip(id);  // storage handles switching active trip if needed
    document.dispatchEvent(new CustomEvent('trip-changed'));
  });
});

// New trip
nav.querySelector('#sidebar-trip-new')!.addEventListener('click', () => {
  createTrip();
  sidebarDropdown.hidden = true;
  document.dispatchEvent(new CustomEvent('trip-changed'));
});
```

**CSS** — add to embedded `<style>` block in `tab-bar.ts`:

```css
/* Sidebar trip selector — bottom of sidebar */
.sidebar-trip-selector {
  position: relative;
  margin-top: auto;          /* pushes to bottom of flex column */
  padding: 0 var(--space-xs);
}

.sidebar-nav-divider {
  height: 1px;
  background: var(--border);
  margin: var(--space-sm) var(--space-md);
  margin-top: auto;          /* also pushed down */
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
  transform: rotate(-90deg);   /* rotates up since dropdown opens upward */
}
.sidebar-trip-chevron svg { width: 14px; height: 14px; }

/* Dropdown opens UPWARD from bottom-left */
.sidebar-trip-dropdown {
  position: absolute;
  bottom: calc(100% + var(--space-xs));   /* above the button */
  left: 0;
  right: 0;
  z-index: 50;
  padding: var(--space-xs) 0;
  animation: sidebarDropUpIn var(--transition-fast) ease;
}

@keyframes sidebarDropUpIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Delete button on trip items */
.trip-selector-item-delete {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  padding: 2px;
  border-radius: var(--radius-sm);
  color: var(--text-tertiary);
  opacity: 0;
  transition: opacity var(--transition-fast), color var(--transition-fast),
              background var(--transition-fast);
}
.trip-selector-item:hover .trip-selector-item-delete {
  opacity: 1;
}
.trip-selector-item-delete:hover {
  color: var(--error, #f87171);
  background: rgba(248, 113, 113, 0.1);
}
.trip-selector-item-delete svg { width: 13px; height: 13px; }

/* Hide on mobile */
.sidebar-trip-selector,
.sidebar-nav-divider {
  display: none;
}

@media (min-width: 1024px) {
  .sidebar-trip-selector,
  .sidebar-nav-divider {
    display: block;
  }
}
```

### Step 4 — Update `src/main.ts`

**Listen for `trip-changed` event** — re-render the current view and refresh the sidebar trip selector:

```typescript
document.addEventListener('trip-changed', () => {
  renderView(getCurrentRoute(), container);
  rebuildSidebarTripSelector();   // refreshes name + list in sidebar
  rebuildMobileTripHeader();      // refreshes name + list in mobile strip
});
```

`rebuildSidebarTripSelector()` and `rebuildMobileTripHeader()` replace only the inner HTML of the respective selectors without recreating the full tab bar.

**Mobile trip strip** — inject a `<div class="mobile-trip-header">` immediately before `view-container` in the DOM:

```html
<div class="mobile-trip-header" id="mobile-trip-header">
  <button class="mobile-trip-btn" id="mobile-trip-toggle" aria-expanded="false">
    <span class="mobile-trip-name">[active trip name]</span>
    <span class="mobile-trip-chevron">[icons.chevronRight]</span>
  </button>
  <div class="mobile-trip-dropdown trip-selector-dropdown glass"
       id="mobile-trip-dropdown" hidden>
    <!-- same .trip-selector-list with delete buttons; reuses trip-selector-* classes -->
  </div>
</div>
```

Wire the same toggle/outside-click/selection/delete/new-trip events. On any change dispatch `trip-changed`.

**Mobile CSS** — add to `src/shared/styles/layout.css`:

```css
.mobile-trip-header {
  position: relative;
  display: flex;
  align-items: center;
  padding: var(--space-xs) var(--space-md);
  border-bottom: 1px solid var(--border);
  z-index: 10;
}

.mobile-trip-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  cursor: pointer;
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-full);
  transition: background var(--transition-fast);
}
.mobile-trip-btn:hover { background: var(--surface-hover); }

.mobile-trip-name {
  font-size: var(--font-sm);
  font-weight: 600;
  color: var(--text-primary);
}

.mobile-trip-chevron {
  display: flex;
  align-items: center;
  color: var(--text-tertiary);
  transition: transform var(--transition-fast);
}
.mobile-trip-btn[aria-expanded="true"] .mobile-trip-chevron {
  transform: rotate(90deg);
}
.mobile-trip-chevron svg { width: 14px; height: 14px; }

.mobile-trip-dropdown {
  position: absolute;
  top: 100%;
  left: var(--space-md);
  right: var(--space-md);
  z-index: 50;
  transform: none;
  min-width: unset;
  max-width: unset;
}

/* Hide mobile strip on desktop */
@media (min-width: 1024px) {
  .mobile-trip-header { display: none; }
}
```

### Step 5 — `src/trip/trip-view.ts` — No Changes

The trip selector is global (sidebar + mobile header). The existing `.trip-destination` div in the hero stays exactly as-is. No modifications to this file.

---

## Files Changed

| File | Change |
|------|--------|
| `src/shared/types.ts` | Add `id: string` to `TripData`; add `AppData` interface |
| `src/shared/storage.ts` | Multi-trip layer; `loadData`/`saveData` proxy through active trip; add `getAllTrips`, `getActiveTripId`, `setActiveTripId`, `createTrip`, `deleteTrip` |
| `src/shared/components/tab-bar.ts` | Sidebar trip selector at bottom of nav; dropdown opens upward; delete button per trip |
| `src/main.ts` | `trip-changed` listener; mobile trip header injection and wiring |
| `src/shared/styles/layout.css` | Mobile trip header CSS |
| `src/shared/utils/icons.ts` | Add `trash` icon if not already present |

## Files NOT Changed
- `src/trip/trip-view.ts` — hero unchanged
- `src/trip/trip.css` — `.trip-selector-*` classes already present; reused
- `src/calendar/calendar-view.ts` — auto-scoped via `loadData()` proxy
- `src/accommodations/accommodations-view.ts` — same
- `src/restaurants/restaurants-view.ts` — same
- `src/shared/router.ts` — unchanged

---

## Delete Trip Behavior

- The `.trip-selector-item-delete` button is **only rendered** when `trips.length > 1` (cannot delete last trip)
- Clicking delete calls `deleteTrip(id)` in storage, which:
  - Removes the trip from `trips[]`
  - If it was the active trip, switches `activeTripId` to `trips[0]`
- After delete, `trip-changed` event fires, sidebar and current view refresh

---

## Icons Used

| Icon | Key | Source |
|------|-----|--------|
| Dropdown arrow | `icons.chevronRight` | Exists |
| Active checkmark | `icons.check` | Exists |
| New trip | `icons.plus` | Exists |
| Delete trip | `icons.trash` | **Add if missing** |

---

## Verification

1. `npm run build` — clean TypeScript compile
2. **Migration**: Open app with existing single-trip data → trip appears in bottom-left sidebar with all data intact
3. **Desktop sidebar**: Trip selector sits at bottom-left corner; click opens dropdown **upward**; trip list shows with delete buttons
4. **Mobile header**: Compact trip strip at top of content; dropdown opens downward
5. **Switch trip**: Select a trip → current tab re-renders; Events/Stays/Food auto-scope
6. **New Trip**: "New Trip" in dropdown creates blank trip; edit modal opens
7. **Delete trip**: Delete button visible only when 2+ trips exist; removing active trip auto-switches to another
8. **Isolation**: Data from Trip A does not bleed into Trip B
9. **Export/Import**: `version: 2` JSON exported; `version: 1` import auto-migrates
