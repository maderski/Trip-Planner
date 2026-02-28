import { icons } from '../utils/icons.ts';

interface CardAction {
  icon: string;
  label: string;
  onClick: () => void;
  danger?: boolean;
}

interface CardOptions {
  title: string;
  subtitle?: string;
  badge?: { label: string; color: string };
  body: string;
  actions?: CardAction[];
  dimmed?: boolean;
}

export function createCard(options: CardOptions): HTMLElement {
  const card = document.createElement('div');
  card.className = `glass-card item-card${options.dimmed ? ' dimmed' : ''}`;

  const badgeHtml = options.badge
    ? `<span class="badge" style="background: ${options.badge.color}20; color: ${options.badge.color}">${options.badge.label}</span>`
    : '';

  const subtitleHtml = options.subtitle
    ? `<span class="card-subtitle">${options.subtitle}</span>`
    : '';

  const actionsHtml = options.actions
    ? `<div class="card-actions">
        ${options.actions.map((a) => `<button class="btn btn-ghost card-action-btn${a.danger ? ' danger' : ''}" title="${a.label}">${a.icon}</button>`).join('')}
      </div>`
    : '';

  card.innerHTML = `
    <div class="card-header">
      <div class="card-header-text">
        <div class="card-title-row">
          <h3 class="card-title">${options.title}</h3>
          ${badgeHtml}
        </div>
        ${subtitleHtml}
      </div>
      ${actionsHtml}
    </div>
    <div class="card-body">${options.body}</div>
  `;

  if (options.actions) {
    const btns = card.querySelectorAll('.card-action-btn');
    options.actions.forEach((action, i) => {
      btns[i].addEventListener('click', (e) => {
        e.stopPropagation();
        action.onClick();
      });
    });
  }

  return card;
}

// Inject card styles
const style = document.createElement('style');
style.textContent = `
.item-card {
  padding: var(--space-md);
  margin-bottom: var(--space-sm);
}

.item-card.dimmed {
  opacity: 0.5;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-sm);
  margin-bottom: var(--space-sm);
}

.card-header-text {
  flex: 1;
  min-width: 0;
}

.card-title-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-wrap: wrap;
}

.card-title {
  font-size: var(--font-base);
  font-weight: 600;
}

.card-subtitle {
  font-size: var(--font-sm);
  color: var(--text-secondary);
  display: block;
  margin-top: 2px;
}

.card-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}

.card-action-btn {
  width: 36px;
  height: 36px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  color: var(--text-tertiary);
}

.card-action-btn:hover {
  color: var(--text-primary);
}

.card-action-btn.danger:hover {
  color: var(--danger);
}

.card-action-btn svg {
  width: 16px;
  height: 16px;
}

.card-body {
  font-size: var(--font-sm);
  color: var(--text-secondary);
  line-height: 1.6;
}

.card-body .card-detail {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  margin-bottom: 2px;
}

.card-body .card-detail svg {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  color: var(--text-tertiary);
}

.card-body a {
  color: var(--accent-light);
  text-decoration: underline;
  text-decoration-color: transparent;
  transition: text-decoration-color var(--transition-fast);
}

.card-body a:hover {
  text-decoration-color: currentColor;
}
`;
document.head.appendChild(style);

export { icons };
