import { exportData, getPasscode, replaceAppData, setPasscode, setSession } from '../shared/storage.ts';
import { isValidPasscode, MAX_PASSCODE_LENGTH, MIN_PASSCODE_LENGTH, normalizePasscode } from '../shared/passcode.ts';
import { getSyncState, isSyncEnabled, pullFromCloud, pushToCloud, startListening } from '../shared/sync.ts';
import type { AppData } from '../shared/types.ts';
import { icons } from '../shared/utils/icons.ts';
import './auth.css';

export function renderAuth(onSuccess: () => void): void {
  const app = document.getElementById('app')!;
  const hasPasscode = !!getPasscode();
  const syncEnabled = isSyncEnabled();

  app.innerHTML = `
    <div class="auth-screen">
      <div class="auth-card glass-strong">
        <div class="auth-icon">${icons.lock}</div>
        <h1 class="auth-title">Trip Planner</h1>
        <p class="auth-subtitle">${hasPasscode ? 'Enter your passcode to continue into this shared trip workspace.' : 'Create a passcode to start your trip workspace.'}</p>
        <p class="auth-helper">${syncEnabled
          ? 'Anyone with this passcode joins the same planner and sees updates after they sync.'
          : 'Firebase is not configured yet, so this device will stay in local-only mode.'}</p>
        <form class="auth-form">
          <input
            type="password"
            class="form-input auth-input"
            placeholder="••••"
            minlength="${MIN_PASSCODE_LENGTH}"
            maxlength="${MAX_PASSCODE_LENGTH}"
            required
            autocomplete="${hasPasscode ? 'current-password' : 'new-password'}"
          />
          ${!hasPasscode ? `<input type="password" class="form-input auth-input" placeholder="Confirm" minlength="${MIN_PASSCODE_LENGTH}" maxlength="${MAX_PASSCODE_LENGTH}" required autocomplete="new-password" />` : ''}
          <p class="auth-error"></p>
          <button type="submit" class="btn btn-primary btn-block">
            ${hasPasscode ? 'Unlock' : 'Create Passcode'}
          </button>
        </form>
      </div>
    </div>
  `;

  const form = app.querySelector('.auth-form') as HTMLFormElement;
  const inputs = form.querySelectorAll<HTMLInputElement>('.auth-input');
  const error = form.querySelector('.auth-error')!;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = normalizePasscode(inputs[0].value);
    const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Loading...';
    error.textContent = '';

    if (!isValidPasscode(code)) {
      error.textContent = `Passcodes must be ${MIN_PASSCODE_LENGTH}-${MAX_PASSCODE_LENGTH} characters.`;
      submitBtn.disabled = false;
      submitBtn.textContent = hasPasscode ? 'Unlock' : 'Create Passcode';
      return;
    }

    if (hasPasscode) {
      if (code === getPasscode()) {
        await syncOnLogin(code);
        setSession();
        onSuccess();
      } else {
        error.textContent = 'Incorrect passcode';
        inputs[0].value = '';
        inputs[0].focus();
        submitBtn.disabled = false;
        submitBtn.textContent = 'Unlock';
      }
    } else {
      const confirm = normalizePasscode(inputs[1].value);
      if (code !== confirm) {
        error.textContent = 'Passcodes do not match';
        inputs[1].value = '';
        inputs[1].focus();
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Passcode';
        return;
      }

      // Check if cloud already has data for this passcode
      if (isSyncEnabled()) {
        const cloudData = await pullFromCloud(code);
        if (cloudData) {
          replaceAppData(cloudData, { syncToCloud: false });
        }
      }

      setPasscode(code);
      await syncOnLogin(code);
      setSession();
      onSuccess();
    }
  });

  inputs[0].focus();
}

async function syncOnLogin(passcode: string): Promise<void> {
  if (!isSyncEnabled()) return;

  const cloudData = await pullFromCloud(passcode);
  if (cloudData) {
    replaceAppData(cloudData, { syncToCloud: false });
  } else if (getSyncState().status !== 'error') {
    // No cloud data yet — push local data up
    const local = JSON.parse(exportData()) as AppData;
    await pushToCloud(passcode, local);
  }

  await startListening(passcode, () => {
    document.dispatchEvent(new CustomEvent('trip-changed'));
  });
}
