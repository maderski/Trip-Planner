export function showToast(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('show'));

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

const style = document.createElement('style');
style.textContent = `
.toast {
  position: fixed;
  top: var(--space-md);
  left: 50%;
  transform: translateX(-50%) translateY(-100%);
  z-index: 300;
  padding: var(--space-sm) var(--space-lg);
  border-radius: var(--radius-full);
  font-size: var(--font-sm);
  font-weight: 600;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: var(--shadow-lg);
  transition: transform var(--transition-base);
  pointer-events: none;
  white-space: nowrap;
}

.toast.show {
  transform: translateX(-50%) translateY(0);
}

.toast-success {
  background: rgba(0, 214, 143, 0.2);
  color: var(--success);
  border: 1px solid rgba(0, 214, 143, 0.3);
}

.toast-error {
  background: rgba(255, 68, 102, 0.2);
  color: var(--danger);
  border: 1px solid rgba(255, 68, 102, 0.3);
}

.toast-info {
  background: rgba(124, 92, 255, 0.2);
  color: var(--accent-light);
  border: 1px solid rgba(124, 92, 255, 0.3);
}
`;
document.head.appendChild(style);
