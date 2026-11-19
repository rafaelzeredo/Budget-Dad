// Interprets the family budget spreadsheet template into a clean model.
// The template's own formulas decide what is income, expense and "acertos":
// e.g. the left "Despesa" total is SUM(B6:B30), so exactly those cells are expenses.
import { readOds, formulaRefs, signedRefs, colName, type Sheet, type Cell } from './ods';
import { classify, stateOf } from './categories';
import type { BudgetModel, Txn, EmptyRow, Investment, Asset, Loan, CheckRow, Issue, Kind, Block, Installment } from './types';

const cents = (x: number) => Math.round(x * 100);
const sum = (xs: number[]) => xs.reduce((a, b) => a + cents(b), 0) / 100;
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Masks long digit runs (customer numbers, registrations, accounts): 12345678 -> •••678 */
export function maskIds(s: string): string {
  return s.replace(/\d{6,}/g, (m) => '•••' + m.slice(-3));
}

function cleanText(s: string): string {
  return maskIds(s.replace(/\s+/g, ' ').trim());
}

function findInCol(sh: Sheet, col: number, pred: (t: string) => boolean, fromRow = 1): Cell[] {
  const out: Cell[] = [];
  sh.cells.forEach((c) => {
    if (c.col === col && c.row >= fromRow && c.text && pred(norm(c.text))) out.push(c);
  });
  return out.sort((a, b) => a.row - b.row);
}

function findAny(sh: Sheet, pred: (t: string) => boolean): Cell[] {
  const out: Cell[] = [];
  sh.cells.forEach((c) => {
    if (c.text && pred(norm(c.text))) out.push(c);
  });
  return out.sort((a, b) => a.row - b.row || a.col - b.col);
}

const at = (sh: Sheet, col: number, row: number) => sh.get(colName(col) + row);
const num = (c?: Cell) => (c && c.value != null && (c.type === 'currency' || c.type === 'float' || c.type === 'percentage') ? c.value : undefined);

function parseInstallment(desc: string): Installment | undefined {
  const m = desc.match(/(?:^|\s)(\d{1,3})\s*\/\s*(\d{1,3})(?:\s|$)/);
  if (m) {
    const n = +m[1], total = +m[2];
    if (n >= 1 && total >= n && total <= 480) return { n, total };
  }
  const p = desc.match(/parcela\s*n\.?\s*(\d{1,4})/i);
  if (p) return { n: +p[1] };
  return undefined;
}

function fixDate(c?: Cell): { iso: string | null; text: string; fixed?: boolean } {
  if (!c) return { iso: null, text: '' };
  if (c.date) {
    const y = +c.date.slice(0, 4);
    // A date typed with a two-digit year (dd/mm/yy) can be stored a century early (e.g. 1931).
    if (y < 1950 && /\d{2}\/\d{2}\/\d{2}$/.test(c.text)) return { iso: `${y + 100}${c.date.slice(4)}`, text: c.text, fixed: true };
    return { iso: c.date, text: c.text };
  }
  if (c.type === 'float' && c.value) return { iso: null, text: String(c.value) };
  return { iso: null, text: c.text };
}

export function parseBudget(bytes: Uint8Array, fileName = 'planilha.ods'): BudgetModel {
  const sheets = readOds(bytes);
  const sh = sheets.find((s) => s.cells.size > 20) ?? sheets[0];
  if (!sh) throw new Error('A planilha está vazia.');
  const issues: Issue[] = [];

  // ---- 1. Locate the summary formulas of the two halves of the month -------------------
  const L = { date: 0, val: 1, desc: 2 };
  const R = { date: 3, val: 4, desc: 5 };
  const withFormula = (c: Cell, col: number) => !!at(sh, col, c.row)?.formula;
  const lRec = findInCol(sh, L.date, (t) => t === 'receita').find((c) => withFormula(c, L.val));
  const lDes = findInCol(sh, L.date, (t) => t === 'despesa').find((c) => withFormula(c, L.val));
  const lSal = findInCol(sh, L.date, (t) => t === 'saldo').find((c) => withFormula(c, L.val));
  if (!lRec || !lDes || !lSal) throw new Error('Não reconheci o modelo: faltam as linhas “Receita”, “Despesa” e “Saldo” com fórmulas na coluna B.');
  const rSaldos = findInCol(sh, R.date, (t) => t === 'saldo', lRec.row).filter((c) => withFormula(c, R.val));
  const rDes = findInCol(sh, R.date, (t) => t === 'despesa', lRec.row).find((c) => withFormula(c, R.val));
  const rSalIni = rSaldos[0];
  const rSalFim = rSaldos.find((c) => rDes && c.row > rDes.row);
  if (!rSalIni || !rDes || !rSalFim) throw new Error('Não reconheci o modelo: faltam “Saldo”, “Despesa” e “Saldo” com fórmulas na coluna E.');

  const lRecCell = at(sh, L.val, lRec.row)!, lDesCell = at(sh, L.val, lDes.row)!, lSalCell = at(sh, L.val, lSal.row)!;
  const rSalIniCell = at(sh, R.val, rSalIni.row)!, rDesCell = at(sh, R.val, rDes.row)!, rSalFimCell = at(sh, R.val, rSalFim.row)!;

  const leftIncome = formulaRefs(lRecCell.formula);
  const leftExpense = formulaRefs(lDesCell.formula);
  const openingRefs = formulaRefs(lSalCell.formula).filter((r) => r !== lRecCell.addr && r !== lDesCell.addr);
  const openingCell = sh.get(openingRefs[0] ?? 'B2');

  // Right income: expand the chain behind the right "Saldo" until the carried balance.
  const rightIncome: string[] = [];
  const expand = (addr: string, depth: number) => {
    if (addr === lSalCell.addr) return; // carried balance from the first half
    const c = sh.get(addr);
    const refs = signedRefs(c?.formula);
    if (c?.formula && refs.length && depth < 6) refs.forEach((r) => r.sign > 0 && expand(r.ref, depth + 1));
    else rightIncome.push(addr);
  };
  expand(rSalIniCell.addr, 0);
  const rightExpense = formulaRefs(rDesCell.formula);
  const acertoRefs = signedRefs(rSalFimCell.formula)
    .filter((r) => r.sign < 0 && r.ref !== rDesCell.addr)
    .map((r) => r.ref);

  // ---- 2. Read every line --------------------------------------------------------------
  const transactions: Txn[] = [];
  const emptyRows: EmptyRow[] = [];
  const take = (addr: string, kind: Kind, block: Block) => {
    const valCell = sh.get(addr);
    const m = addr.match(/^([A-Z]+)(\d+)$/)!;
    const row = +m[2];
    const valCol = valCell?.col ?? (m[1] === 'B' ? L.val : R.val);
    const dateCell = at(sh, valCol - 1, row);
    const descCell = at(sh, valCol + 1, row);
    const descIsFormula = !!descCell?.formula;
    const descText = descCell && !descIsFormula ? cleanText(descCell.text) : '';
    const notes = [dateCell?.note, valCell?.note, descCell?.note].filter(Boolean).map((n) => cleanText(n!));
    const amount = num(valCell);
    if (amount == null || amount === 0) {
      if (dateCell || descText || valCell)
        emptyRows.push({
          cell: addr,
          date: dateCell?.date ?? null,
          description: descText || (valCell?.formula ? `fórmula ${valCell.formula.replace(/^of:=/, '')} = 0` : undefined),
        });
      if (amount === 0 && descText) {
        // A described line with value zero is kept (hidden by default in the explorer).
        const cls = classify(descText, kind, true);
        transactions.push({
          id: addr, date: dateCell?.date ?? null, amount: 0, kind, block, description: descText, hasDescription: true,
          note: notes.join(' · ') || undefined, category: cls.category, place: cls.place, installment: parseInstallment(descText),
          cell: addr, highlighted: !!valCell?.highlight,
        });
      }
      return;
    }
    const hasDescription = !!descText;
    const cls = classify(descText, kind, hasDescription);
    transactions.push({
      id: addr,
      date: dateCell?.date ?? null,
      amount,
      kind,
      block,
      description: hasDescription ? descText : 'Sem descrição',
      hasDescription,
      note: notes.join(' · ') || undefined,
      category: cls.category,
      place: cls.place,
      installment: hasDescription ? parseInstallment(descText) : undefined,
      cell: addr,
      highlighted: !!valCell?.highlight,
    });
  };
  leftIncome.forEach((a) => take(a, 'receita', 'inicio'));
  leftExpense.forEach((a) => take(a, 'despesa', 'inicio'));
  rightIncome.forEach((a) => take(a, 'receita', 'fim'));
  rightExpense.forEach((a) => take(a, 'despesa', 'fim'));
  acertoRefs.forEach((a) => take(a, 'acerto', 'acertos'));
  // keep zero-value lines out of the "empty" list (they are in transactions)
  const zeroIds = new Set(transactions.filter((t) => t.amount === 0).map((t) => t.id));
  const realEmpty = emptyRows.filter((e) => !zeroIds.has(e.cell));

  // ---- 3. Balances by institution ("Saldo 29") ----------------------------------------
  const balances: { name: string; amount: number }[] = [];
  findInCol(sh, R.date, (t) => /^saldo \d+$/.test(t)).forEach((c) => {
    const v = num(at(sh, R.val, c.row));
    const n = at(sh, R.desc, c.row);
    if (v != null) balances.push({ name: cleanText(n?.text || c.text), amount: v });
  });
  const totCell = findInCol(sh, R.date, (t) => t.startsWith('saldo tot'))[0];
  const balancesTotal = totCell ? num(at(sh, R.val, totCell.row)) : undefined;
  const diffCell = findInCol(sh, R.desc, (t) => t === 'diferenca')[0];

  // ---- 4. Investments, assets, loans ---------------------------------------------------
  const investments: Investment[] = [];
  let investmentsAsOf = '';
  const invHead = findAny(sh, (t) => t === 'investimentos').find((c) => norm(at(sh, c.col + 1, c.row)?.text || '') === 'descricao');
  let invTotalRow: number | undefined;
  if (invHead) {
    for (let r = invHead.row + 1; r < invHead.row + 60; r++) {
      const name = at(sh, invHead.col + 1, r);
      if (name && norm(name.text).startsWith('total')) {
        invTotalRow = r;
        investmentsAsOf = name.text.replace(/^total\s+em\s+/i, '').trim();
        break;
      }
      if (!name?.text) continue;
      const mat = fixDate(at(sh, invHead.col + 2, r));
      investments.push({
        name: cleanText(name.text),
        applied: num(at(sh, invHead.col - 1, r)) ?? 0,
        current: num(at(sh, invHead.col, r)) ?? 0,
        maturity: mat.iso,
        maturityText: mat.text,
        isAccount: /^saldos? em conta/i.test(name.text.trim()),
        cell: colName(invHead.col) + r,
      });
    }
  }

  const assets: Asset[] = [];
  const assetHead = findAny(sh, (t) => t === 'valor dos bens adquiridos')[0];
  let assetTotalRow: number | undefined;
  if (assetHead) {
    for (let r = assetHead.row + 1; r < assetHead.row + 40; r++) {
      const name = at(sh, assetHead.col + 1, r);
      if (name && norm(name.text).startsWith('total')) { assetTotalRow = r; break; }
      if (!name?.text) continue;
      assets.push({ name: cleanText(name.text), cost: num(at(sh, assetHead.col - 1, r)) ?? 0, value: num(at(sh, assetHead.col, r)) ?? 0 });
    }
  }

  const loans: Loan[] = [];
  const loanHead = findAny(sh, (t) => t === 'emprestimos').find((c) => c.col === (assetHead?.col ?? 4));
  let loanTotalRow: number | undefined;
  const fixedDates: { cell: string; text: string; iso: string }[] = [];
  if (loanHead) {
    for (let r = loanHead.row + 1; r < loanHead.row + 40; r++) {
      const name = at(sh, loanHead.col + 1, r);
      if (name && norm(name.text).startsWith('total')) { loanTotalRow = r; break; }
      if (!name?.text) continue;
      const until = fixDate(at(sh, loanHead.col + 2, r));
      if (until.fixed && until.iso) fixedDates.push({ cell: colName(loanHead.col + 2) + r, text: until.text, iso: until.iso });
      const contracted = at(sh, loanHead.col - 1, r)?.date ?? null;
      loans.push({
        name: cleanText(name.text),
        contracted,
        balance: num(at(sh, loanHead.col, r)) ?? 0,
        until: until.iso ? until.iso.split('-').reverse().join('/') : until.text,
      });
    }
  }

  const wealthCell = (p: RegExp) => {
    const c = findAny(sh, (t) => p.test(t))[0];
    return c ? { value: num(at(sh, c.col - 1, c.row)), addr: colName(c.col - 1) + c.row } : undefined;
  };
  const wGross = wealthCell(/^patrimonio em/);
  const wLoans = wealthCell(/^emprestimos \w+ \d{4}$/);
  const wNet = wealthCell(/^patrimonio liquido/);

  // ---- 5. The sheet's own category summary --------------------------------------------
  const sheetSummary: { label: string; amount: number }[] = [];
  const sumStart = findInCol(sh, 0, (t) => t === 'inss', lSal.row + 1)[0];
  if (sumStart) {
    for (let r = sumStart.row; r < sumStart.row + 30; r++) {
      const l = at(sh, 0, r);
      if (!l?.text) continue;
      sheetSummary.push({ label: l.text.trim(), amount: num(at(sh, 1, r)) ?? 0 });
      if (norm(l.text) === 'liquido') break;
    }
  }
  // Use the sheet's own summary formulas as evidence:
  //  - a line without description that the summary counts as "Cartões" is a card bill;
  //  - "água RJ", "luz SC", "InternetRJ"… tell which home (state) a bill belongs to.
  if (sumStart) {
    for (let r = sumStart.row; r < sumStart.row + 30; r++) {
      const l = at(sh, 0, r);
      if (!l?.text) continue;
      const refs = new Set(formulaRefs(at(sh, 1, r)?.formula));
      const byLabel = classify(l.text, 'despesa', true);
      const state = stateOf(l.text);
      transactions.forEach((t) => {
        if (!refs.has(t.cell) || t.kind !== 'despesa') return;
        if (t.category === 'sem-descricao' && byLabel.category !== 'sem-descricao') {
          t.category = byLabel.category;
          if (!t.hasDescription) t.description = `${byLabel.category === 'cartoes' ? 'Cartão' : l.text.trim()} (sem descrição na planilha)`;
        }
        if (state && t.category === 'casa' && !t.place) t.place = state;
      });
    }
  }
  const previLabel = findAny(sh, (t) => t === 'previ normal')[0];
  const previNormal = previLabel ? num(at(sh, previLabel.col, previLabel.row + 1)) : undefined;

  // ---- 6. Totals and cross-checks against the sheet ------------------------------------
  const real = transactions.filter((t) => t.amount > 0);
  const tot = (k: Kind, b?: Block) => sum(real.filter((t) => t.kind === k && (!b || t.block === b)).map((t) => t.amount));
  const opening = num(openingCell) ?? 0;
  const closingComputed = (cents(opening) + cents(tot('receita')) - cents(tot('despesa')) - cents(tot('acerto'))) / 100;
  const checks: CheckRow[] = [];
  const check = (label: string, c: Cell | string | undefined, computed: number, note?: string) => {
    const cell = typeof c === 'string' ? sh.get(c) : c;
    const v = num(cell);
    if (cell && v != null) checks.push({ label, cell: cell.addr, sheet: v, computed, note });
  };
  check('Receitas até o dia 19', lRecCell, tot('receita', 'inicio'));
  check('Despesas até o dia 19', lDesCell, tot('despesa', 'inicio'));
  check('Saldo após a 1ª parte do mês', lSalCell, (cents(opening) + cents(tot('receita', 'inicio')) - cents(tot('despesa', 'inicio'))) / 100);
  check('Despesas a partir do dia 20', rDesCell, tot('despesa', 'fim'));
  check('Saldo que resta para o próximo mês', rSalFimCell, closingComputed);
  if (totCell) check('Saldo total nos bancos (dia 29)', colName(R.val) + totCell.row, sum(balances.map((b) => b.amount)));
  if (diffCell) check('Diferença entre saldo e bancos', colName(R.val) + diffCell.row, (cents(closingComputed) - cents(sum(balances.map((b) => b.amount)))) / 100);
  if (invHead && invTotalRow) {
    check('Investimentos: valor aplicado', colName(invHead.col - 1) + invTotalRow, sum(investments.map((i) => i.applied)));
    check('Investimentos: valor atual', colName(invHead.col) + invTotalRow, sum(investments.map((i) => i.current)));
  }
  if (assetHead && assetTotalRow) {
    const costCell = sh.get(colName(assetHead.col - 1) + assetTotalRow);
    const allCost = sum(assets.map((a) => a.cost));
    const refs = formulaRefs(costCell?.formula);
    check('Bens: valor pago', costCell, allCost, refs.length && num(costCell) !== allCost ? `A fórmula da planilha soma só ${refs[0]}:${refs[refs.length - 1]} e deixa de fora ${assets.length - refs.length} linha(s).` : undefined);
    check('Bens: valor atual', colName(assetHead.col) + assetTotalRow, sum(assets.map((a) => a.value)));
  }
  if (loanHead && loanTotalRow) check('Empréstimos (saldo devedor)', colName(loanHead.col) + loanTotalRow, sum(loans.map((l) => l.balance)));
  const invTotal = sum(investments.map((i) => i.current));
  const assetTotal = sum(assets.map((a) => a.value));
  const loanTotal = sum(loans.map((l) => l.balance));
  if (wGross) check('Patrimônio bruto', wGross.addr, sum([invTotal, assetTotal]));
  if (wNet) check('Patrimônio líquido', wNet.addr, (cents(invTotal) + cents(assetTotal) - cents(loanTotal)) / 100);

  // ---- 7. Data-quality notes (detected, not assumed) -----------------------------------
  const years = new Set(real.map((t) => t.date?.slice(0, 4)).filter(Boolean));
  const asOfYear = investmentsAsOf.match(/\d{4}/)?.[0];
  if (asOfYear && years.size && ![...years].includes(asOfYear))
    issues.push({ severity: 'atencao', title: 'Anos diferentes na mesma planilha', detail: `Os lançamentos do mês estão datados de ${[...years].join(', ')}, mas a parte de investimentos e patrimônio diz “${investmentsAsOf}”. O painel mostra as datas exatamente como estão na planilha.` });
  if (openingCell?.date || at(sh, 0, openingCell?.row ?? 0)?.date) {
    const d = at(sh, 0, openingCell!.row)?.date;
    if (d) issues.push({ severity: 'info', title: 'Data do saldo anterior', detail: `O saldo anterior está datado de ${d.split('-').reverse().join('/')}, e os lançamentos começam em 01/11. Não há lançamentos de setembro e outubro na planilha.`, cells: [openingCell!.addr] });
  }
  const noDesc = real.filter((t) => !t.hasDescription);
  if (noDesc.length)
    issues.push({ severity: 'atencao', title: `${noDesc.length} valor(es) sem descrição`, detail: `Na planilha, a descrição destas linhas é uma fórmula que aponta para uma célula vazia e aparece como “0”. Quando o resumo da própria planilha conta a linha em “Cartões”, o painel a coloca em Cartões; as demais ficam como “Sem descrição”. Todas entram nos totais.`, cells: noDesc.map((t) => t.cell) });
  if (acertoRefs.length)
    issues.push({ severity: 'info', title: 'Os “Acertos” ficam fora do total de despesas da planilha', detail: `A planilha soma as despesas da 2ª parte do mês em ${rDesCell.addr} e desconta os “Acertos” (${acertoRefs.join(', ')}) só no saldo final. O painel mostra os acertos como uma categoria própria, separada, e os inclui no total que saiu no mês.` });
  if (realEmpty.length)
    issues.push({ severity: 'info', title: `${realEmpty.length} linhas sem valor`, detail: 'Linhas com data (e às vezes descrição) mas sem valor, ou com valor zero e sem descrição. Não entram em nenhum total. Estão listadas abaixo.', cells: realEmpty.map((e) => e.cell) });
  if (fixedDates.length)
    fixedDates.forEach((f) => issues.push({ severity: 'info', title: 'Data com ano de dois dígitos', detail: `“${f.text}” foi gravado pela planilha como ${+f.iso.slice(0, 4) - 100}. O painel lê como ${f.iso.slice(0, 4)}.`, cells: [f.cell] }));
  if (sheetSummary.length) {
    const tsai = sheetSummary.find((s) => norm(s.label) === 'total saidas');
    // Summary rows whose formula points at an empty cell.
    const emptyRefs: string[] = [];
    if (sumStart)
      for (let r = sumStart.row; r < sumStart.row + 30; r++) {
        const l = at(sh, 0, r);
        const f = at(sh, 1, r)?.formula;
        if (!l?.text || !f) continue;
        if (formulaRefs(f).some((a) => num(sh.get(a)) == null)) emptyRefs.push(`“${l.text.trim()}”`);
        if (norm(l.text) === 'liquido') break;
      }
    if (tsai && Math.round(tsai.amount * 100) !== Math.round((tot('despesa') + tot('acerto')) * 100))
      issues.push({ severity: 'atencao', title: 'O resumo por categoria da planilha é parcial', detail: `O quadro “total saídas” da planilha soma ${tsai.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}, enquanto todas as saídas do mês somam ${(tot('despesa') + tot('acerto')).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.${emptyRefs.length ? ` Algumas fórmulas desse quadro apontam para células vazias (${emptyRefs.slice(0, 5).join(', ')}).` : ''} O painel calcula tudo a partir das linhas do mês.` });
  }
  const neg = investments.filter((i) => i.current < 0);
  neg.forEach((i) => issues.push({ severity: 'info', title: `${i.name}: saldo negativo`, detail: `A planilha mostra ${i.current.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} nesta linha. Ela entra no total dos investimentos como está.`, cells: [i.cell] }));

  return {
    title: sh.name,
    fileName,
    sheetName: sh.name,
    opening: { date: at(sh, 0, openingCell?.row ?? 0)?.date ?? null, amount: opening, cell: openingCell?.addr ?? '' },
    closing: { amount: closingComputed, cell: rSalFimCell.addr, label: at(sh, R.desc, rSalFim.row)?.text || 'resta para o próximo mês' },
    transactions,
    emptyRows: realEmpty,
    previNormal,
    balances,
    balancesTotal,
    investments,
    investmentsAsOf,
    assets,
    loans,
    wealth: {
      gross: num(sh.get(wGross?.addr ?? '')) ?? sum([invTotal, assetTotal]),
      loans: num(sh.get(wLoans?.addr ?? '')) ?? loanTotal,
      net: num(sh.get(wNet?.addr ?? '')) ?? (cents(invTotal) + cents(assetTotal) - cents(loanTotal)) / 100,
      investments: invTotal,
      assets: assetTotal,
    },
    sheetSummary,
    checks,
    issues,
    parsedAt: new Date().toISOString(),
  };
}
