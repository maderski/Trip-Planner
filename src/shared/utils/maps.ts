export interface Coords {
  lat: number;
  lng: number;
}

// ── Coord extraction from URLs ────────────────────────────────────────────────

export function parseMapCoords(url: string): Coords | null {
  if (!url) return null;
  try {
    // /@lat,lng
    const atMatch = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (atMatch) return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };

    // ?q=lat,lng or &q=lat,lng
    const qMatch = url.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (qMatch) return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) };

    // ?ll=lat,lng  (Apple Maps)
    const llMatch = url.match(/[?&]ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (llMatch) return { lat: parseFloat(llMatch[1]), lng: parseFloat(llMatch[2]) };

    // !3d(lat)!4d(lng)  (Google Maps data URLs)
    const placeMatch = url.match(/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/);
    if (placeMatch) return { lat: parseFloat(placeMatch[1]), lng: parseFloat(placeMatch[2]) };

    // /lat,lng in path
    const pathMatch = url.match(/\/(-?\d{1,3}\.\d{3,}),(-?\d{1,3}\.\d{3,})/);
    if (pathMatch) return { lat: parseFloat(pathMatch[1]), lng: parseFloat(pathMatch[2]) };
  } catch {
    // ignore
  }
  return null;
}

// ── Nominatim geocoding ───────────────────────────────────────────────────────

const geocodeCache = new Map<string, Coords | null>();

async function nominatimSearch(query: string): Promise<Coords | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { lat: string; lon: string }[];
    if (data.length === 0) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

export async function resolveLocation(query: string): Promise<Coords | null> {
  if (!query) return null;

  const cacheKey = query.trim().toLowerCase();
  if (geocodeCache.has(cacheKey)) return geocodeCache.get(cacheKey) ?? null;

  // Fast path: parse coords directly from URL
  const direct = parseMapCoords(query);
  if (direct) {
    geocodeCache.set(cacheKey, direct);
    return direct;
  }

  // Slow path: geocode via Nominatim (works for place names, addresses, and
  // short links like maps.app.goo.gl that don't embed coords)
  const result = await nominatimSearch(query);
  geocodeCache.set(cacheKey, result);
  return result;
}

export function buildMapLinkUrl(coords: Coords): string {
  return `https://www.openstreetmap.org/?mlat=${coords.lat}&mlon=${coords.lng}#map=15/${coords.lat}/${coords.lng}`;
}

// ── OSM embed map rendering ───────────────────────────────────────────────────

function buildOsmEmbedHtml(coords: Coords, originalLink: string, height: number, photoUrl?: string): string {
  const delta = 0.008;
  const bbox = [
    coords.lng - delta,
    coords.lat - delta,
    coords.lng + delta,
    coords.lat + delta,
  ].join(',');

  const osmLink = buildMapLinkUrl(coords);
  const openLink = isUrl(originalLink) ? originalLink : osmLink;

  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${coords.lat},${coords.lng}`;

  const photoMarker = photoUrl
    ? `<div class="map-photo-marker"><img src="${escapeAttr(photoUrl)}" alt="" /></div>`
    : '';

  return `<div class="map-container">`
    + `<div class="map-iframe-wrap">`
    + `<iframe class="map-iframe" src="${src}" style="height:${height}px;" loading="lazy" referrerpolicy="no-referrer"></iframe>`
    + photoMarker
    + `</div>`
    + `<div class="map-footer">`
    + `<span class="map-coords">${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}</span>`
    + `<a href="${escapeAttr(openLink)}" target="_blank" rel="noopener" class="map-open-label">Open in Maps ↗</a>`
    + `</div></div>`;
}

// ── Public HTML helpers ───────────────────────────────────────────────────────

export function renderMapHtml(mapLink: string, _icons: unknown, compact = false, photoUrl?: string): string {
  if (!mapLink) return '';
  const height = compact ? 140 : 180;
  const attr = escapeAttr(mapLink);
  const photoAttr = escapeAttr(photoUrl ?? '');

  // Fast path: coords already in the URL → render synchronously
  const coords = parseMapCoords(mapLink);
  if (coords) {
    return buildOsmEmbedHtml(coords, mapLink, height, photoUrl);
  }

  // Slow path: needs geocoding — emit a placeholder, hydration fills it in
  return `<div class="map-preview-placeholder glass-card" `
    + `data-query="${attr}" data-compact="${compact}" data-photo="${photoAttr}" `
    + `style="height:${height + 36}px;display:flex;align-items:center;justify-content:center;">`
    + `<span class="map-loading-text">Loading map…</span>`
    + `</div>`;
}

/** Call after inserting map HTML into the DOM — resolves placeholders. */
export async function hydrateMapPreviews(root: HTMLElement): Promise<void> {
  const placeholders = Array.from(root.querySelectorAll<HTMLElement>('.map-preview-placeholder'));
  for (const el of placeholders) {
    const query = el.dataset.query ?? '';
    const compact = el.dataset.compact === 'true';
    const height = compact ? 140 : 180;
    const photoUrl = el.dataset.photo ?? undefined;
    const coords = await resolveLocation(query);
    if (coords) {
      el.outerHTML = buildOsmEmbedHtml(coords, query, height, photoUrl);
    } else {
      el.outerHTML = `<a href="${escapeAttr(query)}" target="_blank" rel="noopener" class="map-link-fallback glass-card">`
        + `<span>📍</span>`
        + `<span>Open in Maps</span></a>`;
    }
  }
}

function isUrl(s: string): boolean {
  return s.startsWith('http://') || s.startsWith('https://');
}

function escapeAttr(str: string): string {
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
