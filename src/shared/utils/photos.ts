import { icons } from './icons.ts';

export function resizeImage(file: File, maxWidth: number, maxHeight: number): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.88));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function openLightbox(src: string): void {
  const overlay = document.createElement('div');
  overlay.className = 'lightbox-overlay';
  overlay.innerHTML = `
    <img src="${src}" class="lightbox-img" />
    <button class="lightbox-close">${icons.close}</button>
  `;
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || (e.target as HTMLElement).closest('.lightbox-close')) {
      overlay.classList.add('closing');
      setTimeout(() => overlay.remove(), 200);
    }
  });
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));
}

export function renderPhotoGallery(photos: string[], containerId: string): string {
  if (photos.length > 0) {
    return `
      <div class="photo-gallery" id="gallery-${containerId}">
        ${photos.map((p, i) => `
          <div class="photo-thumb" data-index="${i}">
            <img src="${p}" alt="Photo ${i + 1}" />
            <button class="photo-remove" data-index="${i}" title="Remove">${icons.close}</button>
          </div>
        `).join('')}
        <button class="photo-add-btn add-photo-btn" data-gallery="${containerId}">
          ${icons.plus}
        </button>
      </div>
      <input type="file" id="photo-input-${containerId}" accept="image/*" multiple style="display: none;" />
    `;
  }
  return `
    <button class="photo-add-empty glass-card add-photo-btn" data-gallery="${containerId}">
      ${icons.plus}
      <span>Add photos</span>
    </button>
    <input type="file" id="photo-input-${containerId}" accept="image/*" multiple style="display: none;" />
  `;
}

export function wirePhotoGallery(
  root: HTMLElement,
  containerId: string,
  photos: string[],
  onUpdate: (updatedPhotos: string[]) => void,
): void {
  const fileInput = root.querySelector(`#photo-input-${containerId}`) as HTMLInputElement | null;
  const addBtn = root.querySelector(`.add-photo-btn[data-gallery="${containerId}"]`);

  if (addBtn && fileInput) {
    addBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      const files = fileInput.files;
      if (!files || files.length === 0) return;
      const promises = Array.from(files).map((f) => resizeImage(f, 1200, 900));
      Promise.all(promises).then((results) => {
        onUpdate([...photos, ...results]);
      });
    });
  }

  root.querySelectorAll(`#gallery-${containerId} .photo-remove`).forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt((btn as HTMLElement).dataset.index!, 10);
      const updated = [...photos];
      updated.splice(idx, 1);
      onUpdate(updated);
    });
  });

  root.querySelectorAll(`#gallery-${containerId} .photo-thumb img`).forEach((img) => {
    img.addEventListener('click', () => {
      openLightbox((img as HTMLImageElement).src);
    });
  });
}
