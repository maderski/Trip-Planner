# Feature: Colored Border on Calendar Days with Events

## Context
Calendar days with events currently show a small 4px dot (`<div class="event-dot">`) at the bottom of the cell. It's hard to notice, especially on smaller screens. Replace it with a visible colored border around the day cell using an inset box-shadow, which is more prominent and easier to scan.

---

## Approach

1. In `calendar-grid.ts`, instead of injecting `<div class="event-dot">`, add a `has-events` class to the day cell itself.
2. In `calendar.css`, replace the `.event-dot` rules with a `.has-events` inset box-shadow border.

Using `box-shadow: inset` rather than `border` avoids layout shifts (box model stays unchanged) and composes cleanly with the existing `border-radius`.

---

## Changes Required

### `src/calendar/calendar-grid.ts`

**Before (line ~35):**
```typescript
const dot = eventDates.has(dateStr) ? '<div class="event-dot"></div>' : '';
// ...
html += `<div class="${classes.join(' ')}" data-date="${dateStr}">${day}${dot}</div>`;
```

**After:**
```typescript
if (eventDates.has(dateStr)) classes.push('has-events');
// ...
html += `<div class="${classes.join(' ')}" data-date="${dateStr}">${day}</div>`;
```

### `src/calendar/calendar.css`

**Remove** the existing event dot rules:
```css
/* DELETE these */
.calendar-day .event-dot { ... }
.calendar-day.selected .event-dot { ... }
```

**Add** has-events border rules in their place:
```css
.calendar-day.has-events {
  box-shadow: inset 0 0 0 2px var(--accent-light);
}

.calendar-day.selected.has-events {
  box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.5);
}
```

The selected state uses a semi-transparent white border so the accent background of the selected cell still reads clearly.

---

## Files Changed

| File | Change |
|------|--------|
| `src/calendar/calendar-grid.ts` | Add `has-events` class instead of `event-dot` div |
| `src/calendar/calendar.css` | Replace `.event-dot` rules with `.has-events` box-shadow |

## Files Not Changed
- `src/calendar/calendar-view.ts` — no changes needed
- `src/shared/styles/` — no changes needed

---

## Verification
1. `npm run build` — clean build
2. `npm run dev` → Calendar → add an event on any day → that day shows a colored border instead of a dot
3. Select the event day → selected accent background with a subtle white inner border
4. Days without events show no border
5. Check "today" + "in-range" (trip dates) states still look correct with the border overlay
