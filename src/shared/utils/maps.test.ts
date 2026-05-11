import { describe, expect, it, vi } from 'vitest';

import {
  buildMapLinkUrl,
  extractMapLink,
  hydrateMapPreviews,
  parseMapCoords,
  renderMapHtml,
  resolveLocation,
} from './maps.ts';

describe('maps utilities', () => {
  it('parses coordinates from several map URL formats', () => {
    expect(parseMapCoords('https://www.google.com/maps/@40.7128,-74.0060,12z')).toEqual({
      lat: 40.7128,
      lng: -74.006,
    });
    expect(parseMapCoords('https://maps.apple.com/?ll=48.8566,2.3522')).toEqual({
      lat: 48.8566,
      lng: 2.3522,
    });
    expect(parseMapCoords('https://maps.google.com/?q=34.0522,-118.2437')).toEqual({
      lat: 34.0522,
      lng: -118.2437,
    });
    expect(parseMapCoords('https://www.google.com/maps/place/foo/data=!3d51.5!4d-0.12')).toEqual({
      lat: 51.5,
      lng: -0.12,
    });
    expect(parseMapCoords('not-a-map-link')).toBeNull();
  });

  it('extracts iframe src values and preserves raw links', () => {
    expect(extractMapLink('<iframe src="https://www.google.com/maps/embed?pb=test"></iframe>')).toBe(
      'https://www.google.com/maps/embed?pb=test'
    );
    expect(extractMapLink('https://maps.apple.com/?ll=1,2')).toBe('https://maps.apple.com/?ll=1,2');
  });

  it('resolves direct coordinate URLs without using fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await expect(resolveLocation('https://maps.apple.com/?ll=48.8566,2.3522')).resolves.toEqual({
      lat: 48.8566,
      lng: 2.3522,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('geocodes uncached queries and caches follow-up lookups', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [{ lat: '35.6895', lon: '139.6917' }],
    } as Response);

    await expect(resolveLocation('Tokyo Station')).resolves.toEqual({
      lat: 35.6895,
      lng: 139.6917,
    });
    await expect(resolveLocation('  tokyo station  ')).resolves.toEqual({
      lat: 35.6895,
      lng: 139.6917,
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('builds openstreetmap links predictably', () => {
    expect(buildMapLinkUrl({ lat: 12.34, lng: 56.78 })).toBe(
      'https://www.openstreetmap.org/?mlat=12.34&mlon=56.78#map=15/12.34/56.78'
    );
  });

  it('renders google embed URLs directly with a Google Maps open link', () => {
    const html = renderMapHtml(
      'https://www.google.com/maps/embed/v1/place?q=Space+Needle',
      null,
      true
    );

    expect(html).toContain('class="map-iframe"');
    expect(html).toContain('height:140px;');
    expect(html).toContain(
      'https://www.google.com/maps/search/?api=1&query=Space%20Needle'
    );
  });

  it('renders coordinate links as OSM embeds and escapes photo URLs', () => {
    const html = renderMapHtml(
      'https://maps.apple.com/?ll=48.8566,2.3522',
      null,
      false,
      `https://example.com/photo?caption="Paris'"`
    );

    expect(html).toContain('class="map-coords">48.8566, 2.3522</span>');
    expect(html).toContain('height:180px;');
    expect(html).toContain('https://maps.apple.com/?ll=48.8566,2.3522');
    expect(html).toContain('https://example.com/photo?caption=&quot;Paris&#39;&quot;');
  });

  it('hydrates placeholder previews into embeds or fallbacks', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ lat: '37.7749', lon: '-122.4194' }],
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response);

    const root = document.createElement('div');
    root.innerHTML = [
      renderMapHtml('San Francisco Ferry Building', null, false, ''),
      renderMapHtml('Unknown Place', null, true, ''),
    ].join('');

    await hydrateMapPreviews(root);

    expect(root.querySelectorAll('.map-iframe').length).toBe(1);
    expect(root.querySelector('.map-coords')?.textContent).toContain('37.7749');
    expect(root.querySelector('.map-link-fallback')?.getAttribute('href')).toBe('Unknown Place');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
