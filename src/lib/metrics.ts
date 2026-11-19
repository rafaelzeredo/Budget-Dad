import type { BudgetModel, CategoryId, Txn } from './types';
import { CAT, CATEGORIES } from './categories';
import { addDays, daysBetween } from './format';

export const c = (x: number) => Math.round(x * 100);
export const total = (ts: Txn[]) => ts.reduce((a, t) => a + c(t.amount), 0) / 100;

export type FlowFilter = 'tudo' | 'entradas' | 'saidas';
export interface Filters {
  from: string;
  to: string;
  cats: CategoryId[]; // empty = all
  flow: FlowFilter;
  acertos: boolean; // include "Acertos" in the outflows
}

export function monthRange(m: BudgetModel): { min: string; max: string } {
  const ds = m.transactions.map((t) => t.date).filter(Boolean).sort() as string[];
  const min = ds[0] ?? '2000-01-01';
  const max = ds[ds.length - 1] ?? min;
  return { min, max };
}

export function defaultFilters(m: BudgetModel): Filters {
  const { min, max } = monthRange(m);
  return { from: min, to: max, cats: [], flow: 'tudo', acertos: true };
}

export function isFiltered(f: Filters, m: BudgetModel): boolean {
  const d = defaultFilters(m);
  return f.from !== d.from || f.to !== d.to || f.cats.length > 0 || f.flow !== 'tudo' || !f.acertos;
}

/** Lines that pass the filters (zero-value lines are excluded: they have nothing to chart). */
export function applyFilters(m: BudgetModel, f: Filters, keepZero = false): Txn[] {
  return m.transactions.filter((t) => {
    if (!keepZero && t.amount === 0) return false;
    if (t.date && (t.date < f.from || t.date > f.to)) return false;
    if (f.cats.length && !f.cats.includes(t.category)) return false;
    if (f.flow === 'entradas' && t.kind !== 'receita') return false;
    if (f.flow === 'saidas' && t.kind === 'receita') return false;
    if (!f.acertos && t.kind === 'acerto') return false;
    return true;
  });
}

export interface Totals {
  income: number;
  expenses: number; // "Despesa" lines
  acertos: number;
  out: number; // expenses + acertos
  net: number; // income - out
}

export function totals(ts: Txn[]): Totals {
  const income = total(ts.filter((t) => t.kind === 'receita'));
  const expenses = total(ts.filter((t) => t.kind === 'despesa'));
  const acertos = total(ts.filter((t) => t.kind === 'acerto'));
  const out = (c(expenses) + c(acertos)) / 100;
  return { income, expenses, acertos, out, net: (c(income) - c(out)) / 100 };
}

export interface CatRow {
  id: CategoryId;
  amount: number;
  share: number;
  count: number;
}

export function byCategory(ts: Txn[], kind: 'out' | 'in' = 'out'): CatRow[] {
  const sel = ts.filter((t) => (kind === 'out' ? t.kind !== 'receita' : t.kind === 'receita'));
  const sumAll = total(sel);
  const map = new Map<CategoryId, Txn[]>();
  sel.forEach((t) => map.set(t.category, [...(map.get(t.category) ?? []), t]));
  return [...map.entries()]
    .map(([id, xs]) => ({ id, amount: total(xs), share: sumAll ? total(xs) / sumAll : 0, count: xs.length }))
    .sort((a, b) => b.amount - a.amount);
}

export interface DayRow {
  date: string;
  income: number;
  out: number;
  byCat: Partial<Record<CategoryId, number>>;
  txns: Txn[];
}

export function byDay(ts: Txn[], from: string, to: string): DayRow[] {
  const n = Math.max(0, daysBetween(from, to));
  const rows: DayRow[] = [];
  for (let i = 0; i <= n; i++) {
    const d = addDays(from, i);
    const xs = ts.filter((t) => t.date === d);
    const byCat: Partial<Record<CategoryId, number>> = {};
    xs.filter((t) => t.kind !== 'receita').forEach((t) => (byCat[t.category] = ((byCat[t.category] ?? 0) * 100 + c(t.amount)) / 100));
    rows.push({ date: d, income: total(xs.filter((t) => t.kind === 'receita')), out: total(xs.filter((t) => t.kind !== 'receita')), byCat, txns: xs });
  }
  return rows;
}

export function cumulative(days: DayRow[]) {
  let a = 0, b = 0;
  return days.map((d) => {
    a += c(d.income);
    b += c(d.out);
    return { date: d.date, income: a / 100, out: b / 100, net: (a - b) / 100 };
  });
}

/** Calendar weeks of the month (1–7, 8–14, 15–21, 22–28, 29–31). */
export function byWeek(ts: Txn[]) {
  const weeks = [
    { label: '1 a 7', from: 1, to: 7 },
    { label: '8 a 14', from: 8, to: 14 },
    { label: '15 a 21', from: 15, to: 21 },
    { label: '22 a 28', from: 22, to: 28 },
    { label: '29 a 31', from: 29, to: 31 },
  ];
  return weeks.map((w) => {
    const xs = ts.filter((t) => t.date && +t.date.slice(8, 10) >= w.from && +t.date.slice(8, 10) <= w.to);
    return { ...w, out: total(xs.filter((t) => t.kind !== 'receita')), income: total(xs.filter((t) => t.kind === 'receita')), count: xs.length };
  });
}

export const BUCKETS = [
  { label: 'Até R$ 100', min: 0, max: 100 },
  { label: 'R$ 100 a 500', min: 100, max: 500 },
  { label: 'R$ 500 a 1.000', min: 500, max: 1000 },
  { label: 'R$ 1.000 a 5.000', min: 1000, max: 5000 },
  { label: 'Acima de R$ 5.000', min: 5000, max: Infinity },
];

export function buckets(ts: Txn[]) {
  const outs = ts.filter((t) => t.kind !== 'receita');
  return BUCKETS.map((b) => {
    const xs = outs.filter((t) => t.amount > b.min && t.amount <= b.max);
    return { ...b, count: xs.length, amount: total(xs), txns: xs };
  });
}

export function installments(m: BudgetModel) {
  return m.transactions
    .filter((t) => t.installment && t.amount > 0)
    .map((t) => {
      const i = t.installment!;
      const left = i.total ? i.total - i.n : undefined;
      return { txn: t, n: i.n, total: i.total, left, remainingIfSame: left != null ? (left * c(t.amount)) / 100 : undefined };
    })
    .sort((a, b) => (b.remainingIfSame ?? 0) - (a.remainingIfSame ?? 0));
}

export function catOrder(id: CategoryId) {
  return CATEGORIES.findIndex((x) => x.id === id);
}
export const catColor = (id: CategoryId) => CAT[id].color;
