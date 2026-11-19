// Per-device conveniences only. Everything stays in this browser.
import type { BudgetModel } from './types';

const KEY = 'budget-dad:v1:model';
const THEME = 'budget-dad:theme';
const REMEMBER = 'budget-dad:remember';

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export const loadModel = (): BudgetModel | null => safe(() => {
  const s = localStorage.getItem(KEY);
  return s ? (JSON.parse(s) as BudgetModel) : null;
}, null);
export const saveModel = (m: BudgetModel) => safe(() => localStorage.setItem(KEY, JSON.stringify(m)), undefined);
export const clearModel = () => safe(() => localStorage.removeItem(KEY), undefined);

export type Theme = 'auto' | 'light' | 'dark';
export const loadTheme = (): Theme => safe(() => (localStorage.getItem(THEME) as Theme) || 'auto', 'auto');
export const saveTheme = (t: Theme) => safe(() => localStorage.setItem(THEME, t), undefined);
export const loadRemember = (): boolean => safe(() => localStorage.getItem(REMEMBER) !== '0', true);
export const saveRemember = (v: boolean) => safe(() => localStorage.setItem(REMEMBER, v ? '1' : '0'), undefined);
