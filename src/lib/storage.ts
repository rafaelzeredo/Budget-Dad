// Per-device conveniences only. Everything stays in this browser.
const THEME = 'budget-dad:theme';
const KEY = 'budget-dad:access';

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export type Theme = 'auto' | 'light' | 'dark';
export const loadTheme = (): Theme => safe(() => (localStorage.getItem(THEME) as Theme) || 'auto', 'auto');
export const saveTheme = (t: Theme) => safe(() => localStorage.setItem(THEME, t), undefined);

/** The access key of the private link, remembered on this device after the first visit. */
export const loadAccess = (): string | null => safe(() => localStorage.getItem(KEY), null);
export const saveAccess = (k: string): boolean => safe(() => (localStorage.setItem(KEY, k), localStorage.getItem(KEY) === k), false);
export const clearAccess = () => safe(() => localStorage.removeItem(KEY), undefined);
