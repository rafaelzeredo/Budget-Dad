// Observations generated from the real data. Each one says whether it is a calculated
// fact, an estimate (a calculation under a stated assumption) or a reading (interpretation).
import type { BudgetModel, CategoryId } from './types';
import { CAT } from './categories';
import { brl, dateBR, pct, weekday, int } from './format';
import { byCategory, byDay, c, installments, monthRange, total, totals } from './metrics';

export type InsightKind = 'fato' | 'estimativa' | 'leitura';
export interface Insight {
  id: string;
  kind: InsightKind;
  area: 'mes' | 'gastos' | 'patrimonio';
  title: string;
  body: string;
  figure?: string;
  category?: CategoryId;
}

export function buildInsights(m: BudgetModel, today = new Date().toISOString().slice(0, 10)): Insight[] {
  const out: Insight[] = [];
  const real = m.transactions.filter((t) => t.amount > 0);
  const T = totals(real);
  const { min, max } = monthRange(m);

  out.push({
    id: 'resultado', kind: 'fato', area: 'mes',
    title: T.net >= 0 ? 'O mês fechou com sobra' : 'Saiu mais do que entrou',
    figure: brl(T.net),
    body: `Entraram ${brl(T.income)} e saíram ${brl(T.out)} entre ${dateBR(min)} e ${dateBR(max)}. O saldo guardado passou de ${brl(m.opening.amount)} para ${brl(m.closing.amount)}.`,
  });

  if (T.acertos > 0) {
    const semAcertos = (c(T.income) - c(T.expenses)) / 100;
    out.push({
      id: 'acertos', kind: 'fato', area: 'mes',
      title: 'Os acertos pesaram no mês',
      figure: pct(T.acertos / T.out),
      body: `Os “Acertos” (${brl(T.acertos)}) são ${pct(T.acertos / T.out)} de tudo que saiu. Sem eles, as despesas do mês foram ${brl(T.expenses)} e sobrariam ${brl(semAcertos)} (${pct(semAcertos / T.income)} das receitas).`,
    });
    const descs = real.filter((t) => t.kind === 'acerto').map((t) => `“${t.description}”`);
    out.push({
      id: 'acertos-leitura', kind: 'leitura', area: 'mes',
      title: 'Saídas pontuais, não do dia a dia',
      body: `Pelas descrições (${descs.join(' e ')}), os acertos parecem ser gastos fora da rotina. Se for isso mesmo, o custo normal do mês está mais perto das despesas sem os acertos.`,
    });
  }

  if (m.previNormal) {
    const previ = total(real.filter((t) => t.category === 'previdencia'));
    const extra = (c(previ) - c(m.previNormal)) / 100;
    if (extra > 0) {
      const inss = total(real.filter((t) => t.category === 'aposentadoria'));
      out.push({
        id: 'decimo', kind: 'fato', area: 'mes',
        title: 'O 13º engordou a previdência',
        figure: brl(extra),
        body: `A previdência complementar deste mês foi ${brl(previ)}; a planilha anota ${brl(m.previNormal)} como valor normal. A diferença, ${brl(extra)}, é o 13º. Num mês sem 13º, as receitas seriam ${brl((c(inss) + c(m.previNormal)) / 100)}.`,
      });
    }
  }

  const cats = byCategory(real.filter((t) => t.kind === 'despesa'));
  if (cats[0]) {
    const top = cats[0];
    out.push({
      id: 'maior-categoria', kind: 'fato', area: 'gastos', category: top.id,
      title: `${CAT[top.id].label} é o maior grupo de despesas`,
      figure: brl(top.amount),
      body: `${int(top.count)} lançamento(s), ${pct(top.share)} das despesas do mês (sem contar os acertos).${cats[1] ? ` Em seguida vem ${CAT[cats[1].id].label.toLowerCase()}, com ${brl(cats[1].amount)}.` : ''}`,
    });
  }

  if (cats[0] && T.income > 0) {
    const top = cats[0];
    const share = top.amount / T.income;
    out.push({
      id: 'renda', kind: 'fato', area: 'gastos', category: top.id,
      title: `${CAT[top.id].short} levaram ${pct(share)} da renda`,
      figure: pct(share),
      body: `De cada R$ 100 que entraram, cerca de R$ ${Math.round(share * 100)} foram para ${CAT[top.id].label.toLowerCase()}. Todas as despesas juntas somam ${pct(T.expenses / T.income)} da renda; com os acertos, ${pct(T.out / T.income)}.`,
    });
  }

  const rec = real.filter((t) => t.kind === 'despesa' && (t.installment || t.category === 'casa'));
  if (rec.length >= 2) {
    const casa = total(rec.filter((t) => t.category === 'casa' && !t.installment));
    const parc = total(rec.filter((t) => t.installment));
    out.push({
      id: 'recorrentes', kind: 'leitura', area: 'gastos',
      title: 'Gastos com cara de todo mês',
      figure: brl(total(rec)),
      body: `${rec.length} lançamentos parecem se repetir mês a mês: contas da casa (luz, água, gás, internet, condomínio: ${brl(casa)}) e parcelas (${brl(parc)}). Juntos, são ${T.income > 0 ? pct(total(rec) / T.income) : '—'} da renda. A planilha traz um mês só, então isto é uma leitura pelas descrições, não um histórico.`,
    });
  }

  const biggest = [...real.filter((t) => t.kind === 'despesa')].sort((a, b) => b.amount - a.amount)[0];
  if (biggest)
    out.push({
      id: 'maior-gasto', kind: 'fato', area: 'gastos', category: biggest.category,
      title: 'A maior despesa do mês',
      figure: brl(biggest.amount),
      body: `${biggest.description}, em ${dateBR(biggest.date)}. ${biggest.amount / T.expenses >= 0.2 ? `Sozinha, é ${pct(biggest.amount / T.expenses)} das despesas.` : ''}`.trim(),
    });

  const days = byDay(real, min, max);
  const busiest = [...days].sort((a, b) => b.out - a.out)[0];
  const busiestNoAc = [...byDay(real.filter((t) => t.kind !== 'acerto'), min, max)].sort((a, b) => b.out - a.out)[0];
  if (busiest && busiest.out > 0)
    out.push({
      id: 'dia', kind: 'fato', area: 'gastos',
      title: 'O dia com mais saídas',
      figure: dateBR(busiest.date),
      body: `${weekday(busiest.date)}, ${dateBR(busiest.date)}: ${brl(busiest.out)} em ${busiest.txns.filter((t) => t.kind !== 'receita').length} lançamentos.${busiestNoAc && busiestNoAc.date !== busiest.date ? ` Sem os acertos, o dia mais pesado foi ${dateBR(busiestNoAc.date)} (${brl(busiestNoAc.out)}).` : busiestNoAc ? ` Mesmo sem os acertos, continua sendo o dia mais pesado (${brl(busiestNoAc.out)}).` : ''}`,
    });

  const inst = installments(m).filter((i) => i.left != null);
  if (inst.length) {
    const sumLeft = inst.reduce((a, i) => a + c(i.remainingIfSame ?? 0), 0) / 100;
    out.push({
      id: 'parcelas', kind: 'estimativa', area: 'gastos',
      title: 'Parcelas que ainda faltam',
      figure: brl(sumLeft),
      body: `${inst.map((i) => `${i.txn.description.replace(/\s*\d+\/\d+\s*$/, '')}: faltam ${i.left} de ${i.total}`).join('; ')}. A estimativa supõe que cada parcela continue com o valor deste mês.`,
    });
  }

  const casas = real.filter((t) => t.category === 'casa');
  if (casas.length) {
    const places = [...new Set(casas.map((t) => t.place).filter(Boolean))] as string[];
    const parts = places.map((p) => `${brl(total(casas.filter((t) => t.place === p)))} em ${p}`);
    const noPlace = total(casas.filter((t) => !t.place));
    if (places.length && noPlace > 0) parts.push(`${brl(noPlace)} sem o estado indicado na planilha`);
    out.push({
      id: 'casas', kind: 'fato', area: 'gastos', category: 'casa',
      title: places.length > 1 ? `Contas das ${places.length} casas` : 'Contas da casa',
      figure: brl(total(casas)),
      body: `Luz, água, gás, internet e condomínio somaram ${brl(total(casas))} (${pct(total(casas) / T.out)} de tudo que saiu)${parts.length ? `: ${parts.join(', ')}` : ''}.`,
    });
  }

  const fam = real.filter((t) => t.category === 'familia');
  if (fam.length)
    out.push({
      id: 'familia', kind: 'fato', area: 'gastos', category: 'familia',
      title: 'Depósitos para a família',
      figure: brl(total(fam)),
      body: `${fam.length} depósito(s) no mês (${fam.map((t) => `${brl(t.amount)} em ${dateBR(t.date)}`).join(' e ')}).${fam.some((t) => /adiantamento/i.test(t.note ?? '')) ? ' As anotações da planilha dizem que são adiantamento do mês seguinte.' : ''}`,
    });

  // ---- Wealth ----
  const inv = m.investments.filter((i) => !i.isAccount);
  const live = inv.filter((i) => i.current > 0 && i.applied > 0);
  if (m.investments.length) {
    const ap = m.investments.reduce((a, i) => a + c(i.applied), 0) / 100;
    const cu = m.investments.reduce((a, i) => a + c(i.current), 0) / 100;
    const sorted = [...live].sort((a, b) => b.current / b.applied - a.current / a.applied);
    const best = sorted[0], worst = sorted[sorted.length - 1];
    out.push({
      id: 'rendimento', kind: 'fato', area: 'patrimonio',
      title: cu >= ap ? 'Os investimentos valem mais do que foi aplicado' : 'Os investimentos valem menos do que foi aplicado',
      figure: brl((c(cu) - c(ap)) / 100),
      body: `Somando todas as linhas da planilha: ${brl(ap)} aplicados e ${brl(cu)} hoje (${pct(cu / ap - 1)}). O total inclui os saldos em conta e aplicações já zeradas.${best ? ` Maior alta: ${best.name} (${pct(best.current / best.applied - 1)}).` : ''}${worst && worst.current < worst.applied ? ` Queda: ${worst.name} (${pct(worst.current / worst.applied - 1)}).` : ''}`,
    });
  }

  const next = inv.filter((i) => i.maturity && i.maturity >= today && i.current > 0).sort((a, b) => a.maturity!.localeCompare(b.maturity!));
  if (next.length) {
    const firstMonth = next[0].maturity!.slice(0, 7);
    const same = next.filter((i) => i.maturity!.slice(0, 7) === firstMonth);
    out.push({
      id: 'vencimentos', kind: 'fato', area: 'patrimonio',
      title: 'Próximos vencimentos',
      figure: dateBR(next[0].maturity),
      body: `${same.map((i) => `${i.name} (${brl(i.current)}, vence em ${dateBR(i.maturity)})`).join(' e ')}. Vale decidir antes onde reaplicar.`,
    });
  }
  const expired = inv.filter((i) => i.maturity && i.maturity < today && i.current === 0);
  if (expired.length)
    out.push({
      id: 'vencidos', kind: 'leitura', area: 'patrimonio',
      title: `${expired.length} aplicações já venceram e estão zeradas`,
      body: `${expired.map((i) => i.name).join(', ')}. Pelas datas de vencimento, já foram resgatadas; continuam na lista da planilha com valor zero.`,
    });

  if (m.wealth.gross > 0) {
    out.push({
      id: 'patrimonio', kind: 'fato', area: 'patrimonio',
      title: 'Dívidas em relação ao patrimônio',
      figure: pct(m.wealth.loans / m.wealth.gross),
      body: `Os empréstimos em aberto (${brl(m.wealth.loans)}) são ${pct(m.wealth.loans / m.wealth.gross)} do patrimônio bruto (${brl(m.wealth.gross)}). Os bens (imóveis, carros e lotes) são ${pct(m.wealth.assets / m.wealth.gross)} do patrimônio.`,
    });
  }
  m.investments.filter((i) => i.current < 0).forEach((i) =>
    out.push({ id: 'neg-' + i.cell, kind: 'leitura', area: 'patrimonio', title: `${i.name} no negativo`, figure: brl(i.current), body: 'A planilha mostra saldo negativo nesta conta. Vale conferir se há cheque especial ou um débito ainda não coberto.' }),
  );
  return out;
}
