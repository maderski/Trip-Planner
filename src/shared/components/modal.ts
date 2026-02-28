import { icons } from '../utils/icons.ts';

export function openModal(title: string, contentHtml: string, onSubmit?: (form: HTMLFormElement) => void): void {
  const existing = document.querySelector('.modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal glass-strong">
      <div class="modal-header">
        <h2 class="modal-title">${title}</h2>
        <button class="modal-close" type="button">${icons.close}</button>
      </div>
      <form class="modal-body">
        ${contentHtml}
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary modal-cancel">Cancel</button>
          <button type="submit" class="btn btn-primary">Save</button>
        </div>
      </form>
    </div>
  `;

  const close = () => {
    overlay.classList.add('closing');
    setTimeout(() => overlay.remove(), 200);
  };

  overlay.querySelector('.modal-close')!.addEventListener('click', close);
  overlay.querySelector('.modal-cancel')!.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  if (onSubmit) {
    const form = overlay.querySelector('form')!;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      onSubmit(form);
      close();
    });
  }

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));

  const firstInput = overlay.querySelector<HTMLInputElement>('input, select, textarea');
  firstInput?.focus();
}

export function openConfirmModal(title: string, message: string, confirmLabel: string, onConfirm: () => void, danger = false): void {
  const existing = document.querySelector('.modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal glass-strong">
      <div class="modal-header">
        <h2 class="modal-title">${title}</h2>
        <button class="modal-close" type="button">${icons.close}</button>
      </div>
      <div class="modal-body">
        <p style="color: var(--text-secondary); margin-bottom: var(--space-lg);">${message}</p>
        <div class="modal-actions">
          <button class="btn btn-secondary modal-cancel">Cancel</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'} modal-confirm">${confirmLabel}</button>
        </div>
      </div>
    </div>
  `;

  const close = () => {
    overlay.classList.add('closing');
    setTimeout(() => overlay.remove(), 200);
  };

  overlay.querySelector('.modal-close')!.addEventListener('click', close);
  overlay.querySelector('.modal-cancel')!.addEventListener('click', close);
  overlay.querySelector('.modal-confirm')!.addEventListener('click', () => {
    onConfirm();
    close();
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));
}

// Modal styles
const style = document.createElement('style');
style.textContent = `
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  padding: var(--space-md);
  opacity: 0;
  transition: opacity var(--transition-base);
}

.modal-overlay.open {
  opacity: 1;
}

.modal-overlay.closing {
  opacity: 0;
}

.modal {
  width: 100%;
  max-width: 480px;
  max-height: 85dvh;
  overflow-y: auto;
  padding: var(--space-lg);
  transform: translateY(20px) scale(0.96);
  transition: transform var(--transition-base);
}

.modal-overlay.open .modal {
  transform: translateY(0) scale(1);
}

.modal-overlay.closing .modal {
  transform: translateY(20px) scale(0.96);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-lg);
}

.modal-title {
  font-size: var(--font-lg);
  font-weight: 700;
}

.modal-close {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  color: var(--text-tertiary);
  transition: color var(--transition-fast);
}

.modal-close:hover {
  color: var(--text-primary);
}

.modal-close svg {
  width: 20px;
  height: 20px;
}

.modal-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.modal-actions {
  display: flex;
  gap: var(--space-sm);
  justify-content: flex-end;
  margin-top: var(--space-sm);
}
`;
document.head.appendChild(style);
