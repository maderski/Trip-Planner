import { loadData, saveData } from '../shared/storage.ts';
import { openModal, openConfirmModal } from '../shared/components/modal.ts';
import { createCard } from '../shared/components/card.ts';
import { icons } from '../shared/utils/icons.ts';
import { formatDate, formatDateRange } from '../shared/utils/dates.ts';
import { generateId } from '../shared/utils/id.ts';
import { renderMapHtml, hydrateMapPreviews, extractMapLink } from '../shared/utils/maps.ts';
import type { Accommodation, AccommodationType } from './types.ts';
import './accommodations.css';

const typeColors: Record<AccommodationType, string> = {
  Hotel: 'var(--badge-hotel)',
  Airbnb: 'var(--badge-airbnb)',
  Campground: 'var(--badge-campground)',
  Cabin: 'var(--badge-cabin)',
  Other: 'var(--text-tertiary)',
};

export function renderAccommodations(container: HTMLElement): void {
  const data = loadData();
  const sorted = [...data.accommodations].sort((a, b) => a.checkIn.localeCompare(b.checkIn));

  container.innerHTML = `
    <div class="view">
      <div class="view-header">
        <h1 class="view-title">Accommodations</h1>
        <button class="view-header-btn" id="add-acc">${icons.plus}</button>
      </div>
      <div class="accommodations-list" id="acc-list"></div>
    </div>
  `;

  const list = container.querySelector('#acc-list')!;

  if (sorted.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        ${icons.bed}
        <p>No accommodations yet.<br/>Tap + to add your first stay.</p>
      </div>
    `;
  } else {
    const dateGroups = new Map<string, Accommodation[]>();
    for (const acc of sorted) {
      const key = acc.checkIn || '';
      if (!dateGroups.has(key)) dateGroups.set(key, []);
      dateGroups.get(key)!.push(acc);
    }

    Array.from(dateGroups.entries()).forEach(([checkIn, groupStays]) => {
      const groupEl = document.createElement('div');
      groupEl.className = 'date-group';
      groupEl.innerHTML = `<div class="date-group-label">${checkIn ? formatDate(checkIn) : 'Unscheduled'}</div>`;

      groupStays.forEach((acc) => {
        const bodyParts: string[] = [];
        if (acc.checkIn && acc.checkOut) {
          const dateText = acc.suggested ? 'TBD' : formatDateRange(acc.checkIn, acc.checkOut);
          const tbdClass = acc.suggested ? ' suggested-tbd' : '';
          bodyParts.push(`<div class="card-detail${tbdClass}">${icons.calendar} ${dateText}</div>`);
        }
        if (acc.address) {
          bodyParts.push(`<div class="card-detail">${icons.mapPin} <a href="https://maps.google.com/?q=${encodeURIComponent(acc.address)}" target="_blank" rel="noopener">${escapeHtml(acc.address)}</a></div>`);
        }
        if (acc.link) {
          bodyParts.push(`<div class="card-detail">${icons.link} <a href="${escapeAttr(acc.link)}" target="_blank" rel="noopener">Booking Link</a></div>`);
        }
        if (acc.confirmationCode) {
          bodyParts.push(`<div class="card-detail">Conf: <span class="acc-confirm">${escapeHtml(acc.confirmationCode)}</span></div>`);
        }
        if (acc.notes) {
          bodyParts.push(`<div style="margin-top: 4px;">${escapeHtml(acc.notes)}</div>`);
        }
        if (acc.mapLink) {
          bodyParts.push(`<div class="map-inline">${renderMapHtml(acc.mapLink, icons, true)}</div>`);
        }

        const suggestedBadgeHtml = acc.suggested ? '<span class="badge badge-suggested" style="margin-bottom: 4px;">Suggested</span> ' : '';
        const card = createCard({
          title: acc.name,
          badge: { label: acc.type, color: typeColors[acc.type] },
          body: suggestedBadgeHtml + bodyParts.join(''),
          actions: [
            { icon: icons.edit, label: 'Edit', onClick: () => openAccModal(container, acc) },
            { icon: icons.trash, label: 'Delete', danger: true, onClick: () => deleteAcc(container, acc.id) },
          ],
        });
        groupEl.appendChild(card);
      });

      list.appendChild(groupEl);
    });
  }

  container.querySelector('#add-acc')!.addEventListener('click', () => openAccModal(container, null));

  void hydrateMapPreviews(container);
}

export function openAccModal(container: HTMLElement, acc: Accommodation | null, onSave?: () => void): void {
  const isEdit = !!acc;
  const types: AccommodationType[] = ['Hotel', 'Airbnb', 'Campground', 'Cabin', 'Other'];

  openModal(
    isEdit ? 'Edit Stay' : 'Add Stay',
    `
    <div class="form-group">
      <label class="form-label">Name</label>
      <input class="form-input" name="name" value="${escapeAttr(acc?.name || '')}" placeholder="e.g. Hilton Downtown" required />
    </div>
    <div class="form-group">
      <label class="form-label">Type</label>
      <select class="form-input" name="type">
        ${types.map((t) => `<option value="${t}"${acc?.type === t ? ' selected' : ''}>${t}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="checkbox-label">
        <input type="checkbox" name="suggested" ${acc?.suggested ? 'checked' : ''} />
        Suggested (Dates TBD)
      </label>
    </div>
    <div class="form-row date-time-fields"${acc?.suggested ? ' style="opacity:0.4;pointer-events:none"' : ''}>
      <div class="form-group">
        <label class="form-label">Check-in</label>
        <input class="form-input" type="date" name="checkIn" value="${acc?.checkIn || ''}" />
      </div>
      <div class="form-group">
        <label class="form-label">Check-out</label>
        <input class="form-input" type="date" name="checkOut" value="${acc?.checkOut || ''}" />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Address</label>
      <input class="form-input" name="address" value="${escapeAttr(acc?.address || '')}" placeholder="123 Main St" />
    </div>
    <div class="form-group">
      <label class="form-label">Booking Link</label>
      <input class="form-input" type="url" name="link" value="${escapeAttr(acc?.link || '')}" placeholder="https://..." />
    </div>
    <div class="form-group">
      <label class="form-label">Maps Link</label>
      <input class="form-input" name="mapLink" value="${escapeAttr(acc?.mapLink || '')}" placeholder="Paste a Maps share link or embed code" />
      <span class="form-hint">Paste a shared link or embed code to show a map preview</span>
    </div>
    <div class="form-group">
      <label class="form-label">Confirmation Code</label>
      <input class="form-input" name="confirmationCode" value="${escapeAttr(acc?.confirmationCode || '')}" placeholder="ABC123" />
    </div>
    <div class="form-group">
      <label class="form-label">Notes</label>
      <textarea class="form-input" name="notes" placeholder="Special instructions...">${escapeHtml(acc?.notes || '')}</textarea>
    </div>
    `,
    (form) => {
      const fd = new FormData(form);
      const data = loadData();
      const updated: Accommodation = {
        id: acc?.id || generateId(),
        name: fd.get('name') as string,
        type: fd.get('type') as AccommodationType,
        checkIn: fd.get('checkIn') as string,
        checkOut: fd.get('checkOut') as string,
        address: fd.get('address') as string,
        link: fd.get('link') as string,
        confirmationCode: fd.get('confirmationCode') as string,
        mapLink: extractMapLink(fd.get('mapLink') as string),
        notes: fd.get('notes') as string,
        suggested: form.querySelector<HTMLInputElement>('input[name="suggested"]')!.checked,
      };

      if (isEdit) {
        const idx = data.accommodations.findIndex((a) => a.id === acc!.id);
        if (idx >= 0) data.accommodations[idx] = updated;
      } else {
        data.accommodations.push(updated);
      }

      saveData(data);
      onSave ? onSave() : renderAccommodations(container);
    }
  );

  // Wire up suggested checkbox to toggle date field visibility
  const overlay = document.querySelector('.modal-overlay')!;
  const suggestedCb = overlay.querySelector<HTMLInputElement>('input[name="suggested"]')!;
  const dateTimeFields = overlay.querySelector<HTMLElement>('.date-time-fields')!;
  suggestedCb.addEventListener('change', () => {
    dateTimeFields.style.opacity = suggestedCb.checked ? '0.4' : '';
    dateTimeFields.style.pointerEvents = suggestedCb.checked ? 'none' : '';
  });
}

function deleteAcc(container: HTMLElement, id: string): void {
  openConfirmModal('Delete Stay', 'Are you sure you want to delete this accommodation?', 'Delete', () => {
    const data = loadData();
    data.accommodations = data.accommodations.filter((a) => a.id !== id);
    saveData(data);
    renderAccommodations(container);
  }, true);
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str: string): string {
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
