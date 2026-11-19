import type { BudgetModel, CategoryId } from '../lib/types';
import { CAT } from '../lib/categories';
import { applyFilters, byCategory, byDay, cumulative, totals, type Filters } from '../lib/metrics';
import { pct } from '../lib/format';
import { CumulativeChart, Waterfall, type WaterStep } from '../components/charts';
import { FlowCompare } from '../components/viz';

/** Section 01: what came in vs. what went out. */
export function Flow({ model, f, toggleCat }: { model: BudgetModel; f: Filters; toggleCat: (id: CategoryId) => void }) {
  const ts = applyFilters(model, f);
  const noCat = applyFilters(model, { ...f, cats: [] });
  const T = totals(ts);
  const inc = byCategory(noCat, 'in');
  const out = byCategory(noCat, 'out');

  const steps: WaterStep[] = [];
  byCategory(ts, 'in').forEach((r) => steps.push({ key: r.id, label: CAT[r.id].label, short: CAT[r.id].short, value: r.amount, color: CAT[r.id].color }));
  byCategory(ts, 'out').forEach((r) => steps.push({ key: r.id, label: CAT[r.id].label, short: CAT[r.id].short, value: -r.amount, color: CAT[r.id].color, detail: `${r.count} lançamento(s) · ${pct(r.share)} das saídas` }));
  if (steps.length) steps.push({ key: 'resultado', label: 'Resultado', value: T.net, color: 'var(--ink-2)', total: true, detail: 'Entradas menos saídas no período' });

  const cum = cumulative(byDay(ts, f.from, f.to));
  const prevDay = model.transactions.find((t) => t.category === 'previdencia')?.date;

  return (
    <div className="grid">
      <div className="card span-12">
        <div className="card-head"><h3>Entrou × saiu, na mesma régua</h3></div>
        <p className="sub">Cada cor é uma fonte de renda ou um grupo de gastos. Toque num grupo para filtrar a página inteira.</p>
        <FlowCompare
          income={inc.map((r) => ({ key: r.id, label: CAT[r.id].short, value: r.amount, color: CAT[r.id].color }))}
          out={out.map((r) => ({ key: r.id, label: CAT[r.id].short, value: r.amount, color: CAT[r.id].color, pickable: true }))}
          selected={f.cats}
          onPick={(k) => toggleCat(k as CategoryId)}
        />
      </div>
      <div className="card span-6">
        <div className="card-head"><h3>Como o mês fechou</h3></div>
        <p className="sub">O que entrou soma; cada grupo de saídas desconta, até o resultado.</p>
        {steps.length ? <Waterfall steps={steps} onPick={(k) => k !== 'resultado' && CAT[k as CategoryId]?.kind !== 'receita' && toggleCat(k as CategoryId)} /> : <div className="empty">Nada no filtro escolhido.</div>}
      </div>
      <div className="card span-6">
        <div className="card-head"><h3>Entradas e saídas acumuladas</h3></div>
        <p className="sub">Dia a dia. Quando a linha laranja passa da azul, já saiu mais do que entrou.</p>
        <CumulativeChart data={cum} events={prevDay && prevDay >= f.from && prevDay <= f.to ? [{ date: prevDay, label: CAT.previdencia.short }] : []} />
      </div>
    </div>
  );
}
