import { getPasscode, setPasscode, setSession } from '../shared/storage.ts';
import { icons } from '../shared/utils/icons.ts';
import './auth.css';

export function renderAuth(onSuccess: () => void): void {
  const app = document.getElementById('app')!;
  const hasPasscode = !!getPasscode();

  app.innerHTML = `
    <div class="auth-screen">
      <div class="auth-card glass-strong">
        <div class="auth-icon">${icons.lock}</div>
        <h1 class="auth-title">Trip Planner</h1>
        <p class="auth-subtitle">${hasPasscode ? 'Enter your passcode to continue' : 'Create a passcode to get started'}</p>
        <form class="auth-form">
          <input
            type="password"
            class="form-input auth-input"
            placeholder="••••"
            minlength="4"
            maxlength="16"
            required
            autocomplete="${hasPasscode ? 'current-password' : 'new-password'}"
          />
          ${!hasPasscode ? '<input type="password" class="form-input auth-input" placeholder="Confirm" minlength="4" maxlength="16" required autocomplete="new-password" />' : ''}
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

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const code = inputs[0].value;

    if (hasPasscode) {
      if (code === getPasscode()) {
        setSession();
        onSuccess();
      } else {
        error.textContent = 'Incorrect passcode';
        inputs[0].value = '';
        inputs[0].focus();
      }
    } else {
      const confirm = inputs[1].value;
      if (code !== confirm) {
        error.textContent = 'Passcodes do not match';
        inputs[1].value = '';
        inputs[1].focus();
        return;
      }
      setPasscode(code);
      setSession();
      onSuccess();
    }
  });

  inputs[0].focus();
}
