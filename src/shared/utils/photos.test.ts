import { describe, expect, it, vi } from 'vitest';

import { openLightbox, renderPhotoGallery, resizeImage, wirePhotoGallery } from './photos.ts';

describe('photo helpers', () => {
  it('renders empty and populated galleries', () => {
    const emptyHtml = renderPhotoGallery([], 'trip');
    expect(emptyHtml).toContain('Add photos');
    expect(emptyHtml).toContain('photo-input-trip');

    const populatedHtml = renderPhotoGallery(['a.jpg', 'b.jpg'], 'trip');
    expect(populatedHtml).toContain('gallery-trip');
    expect(populatedHtml).toContain('Photo 1');
    expect(populatedHtml).toContain('Photo 2');
    expect(populatedHtml).toContain('photo-remove');
  });

  it('opens and closes the lightbox overlay', () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 1;
    });

    openLightbox('https://example.com/photo.jpg');

    const overlay = document.querySelector('.lightbox-overlay') as HTMLElement;
    expect(overlay).not.toBeNull();
    expect(overlay.classList.contains('open')).toBe(true);
    expect((overlay.querySelector('.lightbox-img') as HTMLImageElement).src).toContain('photo.jpg');

    overlay.click();
    expect(overlay.classList.contains('closing')).toBe(true);
    vi.advanceTimersByTime(200);
    expect(document.querySelector('.lightbox-overlay')).toBeNull();

    vi.useRealTimers();
  });

  it('wires remove and preview actions in an existing gallery', () => {
    const root = document.createElement('div');
    root.innerHTML = renderPhotoGallery(['https://example.com/a.jpg', 'https://example.com/b.jpg'], 'trip');
    const onUpdate = vi.fn();
    const lightboxSpy = vi.spyOn(document.body, 'appendChild');

    wirePhotoGallery(root, 'trip', ['https://example.com/a.jpg', 'https://example.com/b.jpg'], onUpdate);

    root.querySelectorAll<HTMLElement>('.photo-remove')[1].click();
    expect(onUpdate).toHaveBeenCalledWith(['https://example.com/a.jpg']);

    root.querySelector<HTMLImageElement>('.photo-thumb img')?.click();
    expect(lightboxSpy).toHaveBeenCalled();
  });

  it('wires add-photo buttons to the hidden file input', () => {
    const root = document.createElement('div');
    root.innerHTML = renderPhotoGallery([], 'trip');
    const onUpdate = vi.fn();
    const input = root.querySelector('#photo-input-trip') as HTMLInputElement;
    input.click = vi.fn();

    wirePhotoGallery(root, 'trip', [], onUpdate);
    root.querySelector<HTMLElement>('.add-photo-btn')?.click();

    expect(input.click).toHaveBeenCalledTimes(1);
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('resizes images through the reader/image/canvas pipeline', async () => {
    class FileReaderMock {
      result: string | ArrayBuffer | null = 'data:image/png;base64,abc';
      onload: null | (() => void) = null;

      readAsDataURL() {
        this.onload?.();
      }
    }

    class ImageMock {
      width = 2400;
      height = 1200;
      onload: null | (() => void) = null;

      set src(_value: string) {
        this.onload?.();
      }
    }

    const drawImage = vi.fn();
    const toDataURL = vi.fn(() => 'data:image/jpeg;base64,resized');
    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation(((tagName: string) => {
      if (tagName === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: () => ({ drawImage }),
          toDataURL,
        } as unknown as HTMLCanvasElement;
      }
      return originalCreateElement(tagName);
    }) as typeof document.createElement);

    Object.defineProperty(globalThis, 'FileReader', {
      configurable: true,
      value: FileReaderMock,
    });
    Object.defineProperty(globalThis, 'Image', {
      configurable: true,
      value: ImageMock,
    });

    const file = new File(['abc'], 'photo.png', { type: 'image/png' });
    await expect(resizeImage(file, 1200, 900)).resolves.toBe('data:image/jpeg;base64,resized');

    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1200, 600);
    expect(toDataURL).toHaveBeenCalledWith('image/jpeg', 0.88);
    createElementSpy.mockRestore();
  });
});
