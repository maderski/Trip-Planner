import { getTheme, setTheme, exportData, importData, clearData, getPasscode, setPasscode } from '../shared/storage.ts';
import { openModal, openConfirmModal } from '../shared/components/modal.ts';
import { showToast } from '../shared/components/toast.ts';
import { icons } from '../shared/utils/icons.ts';
import './settings.css';

export function renderSettings(container: HTMLElement): void {
  const isDark = getTheme() === 'dark';

  container.innerHTML = `
    <div class="view">
      <div class="view-header">
        <h1 class="view-title">Settings</h1>
      </div>

      <div class="settings-list">
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
      <div class="form-group">
        <label class="form-label">Current Passcode</label>
        <input class="form-input" type="password" name="current" required />
      </div>
      <div class="form-group">
        <label class="form-label">New Passcode</label>
        <input class="form-input" type="password" name="newPass" minlength="4" maxlength="16" required />
      </div>
      <div class="form-group">
        <label class="form-label">Confirm New Passcode</label>
        <input class="form-input" type="password" name="confirm" minlength="4" maxlength="16" required />
      </div>
      `,
      (form) => {
        const fd = new FormData(form);
        const current = fd.get('current') as string;
        const newPass = fd.get('newPass') as string;
        const confirm = fd.get('confirm') as string;

        if (current !== getPasscode()) {
          showToast('Current passcode is incorrect', 'error');
          return;
        }
        if (newPass !== confirm) {
          showToast('New passcodes do not match', 'error');
          return;
        }
        setPasscode(newPass);
        showToast('Passcode updated', 'success');
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
          },
          true
        );
      },
      true
    );
  });
}
