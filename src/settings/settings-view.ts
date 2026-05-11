import { clearData, exportData, getPasscode, importData, setPasscode } from '../shared/storage.ts';
import { getTheme, setTheme } from '../shared/storage.ts';
import { openModal, openConfirmModal } from '../shared/components/modal.ts';
import { showToast } from '../shared/components/toast.ts';
import { isValidPasscode, MAX_PASSCODE_LENGTH, MIN_PASSCODE_LENGTH, normalizePasscode } from '../shared/passcode.ts';
import { getSyncState, isSyncEnabled, pushToCloud, startListening, type SyncStatus } from '../shared/sync.ts';
import type { AppData } from '../shared/types.ts';
import { icons } from '../shared/utils/icons.ts';
import './settings.css';

export function renderSettings(container: HTMLElement): void {
  const isDark = getTheme() === 'dark';
  const passcode = getPasscode();
  const syncState = getSyncState();
  const syncEnabled = isSyncEnabled();
  const statusMeta = getStatusMeta(syncState.status);

  container.innerHTML = `
    <div class="view">
      <div class="view-header">
        <h1 class="view-title">Settings</h1>
      </div>

      <div class="settings-list">
        <div class="settings-collab glass-card">
          <div class="settings-collab-header">
            <div class="settings-item-icon">${statusMeta.icon}</div>
            <div class="settings-item-text">
              <h3>Shared Workspace</h3>
              <p>${statusMeta.label}</p>
            </div>
          </div>
          <div class="settings-collab-details">
            <div class="settings-status-badge settings-status-${syncState.status}">${statusMeta.badge}</div>
            <p class="settings-collab-note">${syncState.detail}</p>
            <p class="settings-collab-note">${syncEnabled
              ? 'Anyone with this passcode joins the same trip planner. Collaboration uses last-write-wins syncing.'
              : 'Add Firebase config values to enable cloud sync. Until then, this browser stores data locally only.'}</p>
            <div class="settings-passcode-row">
              <span class="settings-passcode-label">Workspace passcode</span>
              <code class="settings-passcode-value">${escapeHtml(passcode || 'Not set')}</code>
            </div>
            ${syncState.lastSyncedAt ? `<p class="settings-collab-note">Last synced: ${new Date(syncState.lastSyncedAt).toLocaleString()}</p>` : ''}
          </div>
        </div>

        <div class="settings-item glass-card">
          <div class="settings-item-info">
            <div class="settings-item-icon">${isDark ? icons.moon : icons.sun}</div>
            <div class="settings-item-text">
              <h3>Theme</h3>
              <p>${isDark ? 'Dark mode' : 'Light mode'}</p>
            </div>
          </div>
          <label class="theme-switch">
            <input type="checkbox" id="theme-toggle" ${!isDark ? 'checked' : ''} />
            <span class="theme-slider"></span>
          </label>
        </div>

        <div class="settings-item glass-card" id="change-passcode" style="cursor: pointer;">
          <div class="settings-item-info">
            <div class="settings-item-icon">${icons.lock}</div>
            <div class="settings-item-text">
              <h3>Change Passcode</h3>
              <p>Update your access passcode</p>
            </div>
          </div>
          <div class="settings-item-icon">${icons.chevronRight}</div>
        </div>

        <div class="settings-item glass-card" id="export-data" style="cursor: pointer;">
          <div class="settings-item-info">
            <div class="settings-item-icon">${icons.download}</div>
            <div class="settings-item-text">
              <h3>Export Data</h3>
              <p>Download your trip data as JSON</p>
            </div>
          </div>
          <div class="settings-item-icon">${icons.chevronRight}</div>
        </div>

        <div class="settings-item glass-card" id="import-data" style="cursor: pointer;">
          <div class="settings-item-info">
            <div class="settings-item-icon">${icons.upload}</div>
            <div class="settings-item-text">
              <h3>Import Data</h3>
              <p>Restore from a JSON backup</p>
            </div>
          </div>
          <div class="settings-item-icon">${icons.chevronRight}</div>
          <input type="file" id="import-file" accept=".json" style="display: none;" />
        </div>
      </div>

      <div class="settings-danger">
        <h3>Danger Zone</h3>
        <button class="btn btn-danger btn-block" id="clear-data">
          ${icons.trash} Clear All Data
        </button>
      </div>
    </div>
  `;

  // Theme toggle
  container.querySelector('#theme-toggle')!.addEventListener('change', (e) => {
    const isLight = (e.target as HTMLInputElement).checked;
    setTheme(isLight ? 'light' : 'dark');
    renderSettings(container);
  });

  // Change passcode
  container.querySelector('#change-passcode')!.addEventListener('click', () => {
    openModal(
      'Change Passcode',
      `
      <p class="settings-modal-note">Changing the passcode creates a new shared workspace for future syncs. Share the new passcode with collaborators.</p>
      <div class="form-group">
        <label class="form-label">Current Passcode</label>
        <input class="form-input" type="password" name="current" required />
      </div>
      <div class="form-group">
        <label class="form-label">New Passcode</label>
        <input class="form-input" type="password" name="newPass" minlength="${MIN_PASSCODE_LENGTH}" maxlength="${MAX_PASSCODE_LENGTH}" required />
      </div>
      <div class="form-group">
        <label class="form-label">Confirm New Passcode</label>
        <input class="form-input" type="password" name="confirm" minlength="${MIN_PASSCODE_LENGTH}" maxlength="${MAX_PASSCODE_LENGTH}" required />
      </div>
      `,
      async (form) => {
        const fd = new FormData(form);
        const current = normalizePasscode(fd.get('current') as string);
        const newPass = normalizePasscode(fd.get('newPass') as string);
        const confirm = normalizePasscode(fd.get('confirm') as string);

        if (current !== getPasscode()) {
          showToast('Current passcode is incorrect', 'error');
          return false;
        }
        if (!isValidPasscode(newPass)) {
          showToast(`Passcodes must be ${MIN_PASSCODE_LENGTH}-${MAX_PASSCODE_LENGTH} characters`, 'error');
          return false;
        }
        if (newPass !== confirm) {
          showToast('New passcodes do not match', 'error');
          return false;
        }

        setPasscode(newPass);
        if (isSyncEnabled()) {
          const appData = JSON.parse(exportData()) as AppData;
          const pushed = await pushToCloud(newPass, appData);
          if (pushed) {
            await startListening(newPass, () => {
              document.dispatchEvent(new CustomEvent('trip-changed'));
            });
          } else {
            showToast('Passcode updated locally, but cloud sync failed', 'error');
            renderSettings(container);
            return true;
          }
        }
        showToast('Passcode updated', 'success');
        renderSettings(container);
        return true;
      }
    );
  });

  // Export
  container.querySelector('#export-data')!.addEventListener('click', () => {
    const json = exportData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trip-planner-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Data exported', 'success');
  });

  // Import
  const importBtn = container.querySelector('#import-data')!;
  const importFile = container.querySelector('#import-file') as HTMLInputElement;

  importBtn.addEventListener('click', () => importFile.click());

  importFile.addEventListener('change', () => {
    const file = importFile.files?.[0];
    if (!file) return;

    openConfirmModal(
      'Import Data',
      'This will overwrite all existing data. Are you sure?',
      'Import',
      () => {
        const reader = new FileReader();
        reader.onload = () => {
          const success = importData(reader.result as string);
          if (success) {
            showToast('Data imported successfully', 'success');
            renderSettings(container);
            document.dispatchEvent(new CustomEvent('trip-changed'));
          } else {
            showToast('Invalid backup file', 'error');
          }
        };
        reader.readAsText(file);
      },
      true
    );
  });

  // Clear data
  container.querySelector('#clear-data')!.addEventListener('click', () => {
    openConfirmModal(
      'Clear All Data',
      'This will permanently delete all your trip data. This cannot be undone.',
      'Clear Everything',
      () => {
        openConfirmModal(
          'Are you absolutely sure?',
          'All events, accommodations, and restaurants will be lost forever.',
          'Yes, delete all',
          () => {
            clearData();
            showToast('All data cleared', 'success');
            renderSettings(container);
            document.dispatchEvent(new CustomEvent('trip-changed'));
          },
          true
        );
      },
      true
    );
  });
}

function getStatusMeta(status: SyncStatus): { badge: string; icon: string; label: string } {
  switch (status) {
    case 'synced':
      return { badge: 'Synced', icon: icons.check, label: 'Cloud sync is active.' };
    case 'syncing':
      return { badge: 'Syncing', icon: icons.clock, label: 'Cloud sync is in progress.' };
    case 'error':
      return { badge: 'Sync Error', icon: icons.alertTriangle, label: 'Cloud sync needs attention.' };
    case 'idle':
      return { badge: 'Ready', icon: icons.lock, label: 'Cloud sync is connected and waiting for changes.' };
    case 'disabled':
    default:
      return { badge: 'Local Only', icon: icons.alertTriangle, label: 'Firebase is not configured.' };
  }
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
