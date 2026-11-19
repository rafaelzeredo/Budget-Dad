// Runs only where a real spreadsheet exists locally (local-data/ is never committed).
// No amounts are written here: everything is compared with the spreadsheet's own formula results.
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { parseBudget } from '../src/lib/template';
import { totals, byCategory } from '../src/lib/metrics';

const FILE = 'local-data/ModeloRafael.ods';
const run = existsSync(FILE) ? describe : describe.skip;
const c = (x: number) => Math.round(x * 100);

run('real spreadsheet (local only)', () => {
  const m = parseBudget(new Uint8Array(readFileSync(FILE)), 'planilha.ods');
  const real = m.transactions.filter((t) => t.amount > 0);
  const T = totals(real);
  const sheet = (label: string) => m.checks.find((x) => x.label === label)!.sheet;

  test('the dashboard reproduces the sheet totals to the cent', () => {
    const bad = m.checks.filter((x) => c(x.sheet) !== c(x.computed) && !x.note);
    expect(bad).toEqual([]);
  });
  test('month: opening + income − expenses − acertos = what the sheet says is left', () => {
    expect(c(m.opening.amount) + c(T.income) - c(T.expenses) - c(T.acertos)).toBe(c(sheet('Saldo que resta para o próximo mês')));
    expect(c(T.net)).toBe(c(m.closing.amount) - c(m.opening.amount));
  });
  test('no line is counted twice', () => {
    const cells = m.transactions.map((t) => t.cell);
    expect(new Set(cells).size).toBe(cells.length);
  });
  test('categories add up to the total, and nothing is left unclassified except lines without description', () => {
    const sum = byCategory(real, 'out').reduce((a, r) => a + c(r.amount), 0);
    expect(sum).toBe(c(T.out));
    expect(real.filter((t) => t.category === 'sem-descricao' && t.hasDescription)).toEqual([]);
  });
  test('wealth matches the sheet', () => {
    expect(c(m.wealth.net)).toBe(c(sheet('Patrimônio líquido')));
    expect(c(m.wealth.gross)).toBe(c(sheet('Patrimônio bruto')));
  });
});
