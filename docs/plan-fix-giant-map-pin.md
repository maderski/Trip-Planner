# Fix: Giant Map Pin Icon in Event Detail Rows

## Root Cause

`icons.mapPin` is an SVG with only `viewBox="0 0 24 24"` — no `width` or `height` attributes. `reset.css` sets `svg { display: block; max-width: 100%; }` globally, making unsized SVGs expand to fill their container.

The `.event-detail` class in `calendar.css` is the only detail-row class missing SVG sizing. For comparison, `.card-detail svg` is already correctly sized at 14px × 14px in `src/shared/components/card.ts`:

```css
/* card.ts (already correct) */
.card-body .card-detail {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}
.card-body .card-detail svg {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  color: var(--text-tertiary);
}
```

`.event-detail` lacks both the flex layout and the SVG sizing rule, causing the pin to render at full card width.

---

## Fix: One file, two CSS additions

### `src/calendar/calendar.css`

Update `.event-detail` to match the pattern used by `.card-detail`:

**Before:**
```css
.event-detail {
  font-size: var(--font-sm);
  color: var(--text-secondary);
}
```

**After:**
```css
.event-detail {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: var(--font-sm);
  color: var(--text-secondary);
}

.event-detail svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: var(--text-tertiary);
}
```

---

## Files Changed

- `src/calendar/calendar.css` — add flex layout + SVG sizing to `.event-detail`

## Files Not Changed

- `src/shared/utils/icons.ts` — do not add width/height to SVG strings
- `src/shared/components/card.ts` — already correct
- `reset.css` — global SVG rules are needed elsewhere

---

## Verification

1. `npm run build` — clean build
2. Open Calendar → select a day with an event that has a location → location row shows a small 16px pin icon beside the address text, not a full-card icon
