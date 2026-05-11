export const MIN_PASSCODE_LENGTH = 4;
export const MAX_PASSCODE_LENGTH = 16;

export function normalizePasscode(value: string): string {
  return value.trim();
}

export function isValidPasscode(value: string): boolean {
  const normalized = normalizePasscode(value);
  return normalized.length >= MIN_PASSCODE_LENGTH && normalized.length <= MAX_PASSCODE_LENGTH;
}
