import type { BudgetModel, CategoryId, Txn } from '../lib/types';
import { CAT } from '../lib/categories';
import { applyFilters, byCategory, byDay, cumulative, isFiltered, totals, c, type Filters } from '../lib/metrics';
import { brl, dateBR, pct } from '../lib/format';
import { buildInsights } from '../lib/insights';
import { BarRows, CumulativeChart, Waterfall, type WaterStep } from '../components/charts';
import { Info } from '../components/ui';
import { InsightCard } from './Insights';

export function Overview({ model, f, setF, go }: { model: BudgetModel; f: Filters; setF: (f: Filters) => void; go: (tab: string) => void; openTxn: (t: Txn) => void }) {
  const ts = applyFilters(model, f);
  const T = totals(ts);
  const filtered = isFiltered(f, model);
  const all = totals(model.transactions.filter((t) => t.amount > 0));
  const savings = T.income > 0 ? T.net / T.income : null;
  const savingsNoAc = T.income > 0 ? (c(T.income) - c(T.expenses)) / 100 / T.income : null;

  // Waterfall: income lines, then outflow groups (largest first), then the result.
  const steps: WaterStep[] = [];
  byCategory(ts, 'in').forEach((r) => steps.push({ key: r.id, label: CAT[r.id].label, short: CAT[r.id].short, value: r.amount, color: CAT[r.id].color }));
  byCategory(ts, 'out').forEach((r) => steps.push({ key: r.id, label: CAT[r.id].label, short: CAT[r.id].short, value: -r.amount, color: CAT[r.id].color, detail: `${r.count} lançamento(s) · ${pct(r.share)} das saídas` }));
  if (steps.length) steps.push({ key: 'resultado', label: 'Resultado', value: T.net, color: 'var(--ink-2)', total: true, detail: 'Entradas menos saídas no período' });

  const days = byDay(ts, f.from, f.to);
  const cum = cumulative(days);
  const prevDay = model.transactions.find((t) => t.category === 'previdencia')?.date;
  const insights = buildInsights(model).filter((i) => i.area === 'mes').slice(0, 3);
  const cats = byCategory(ts, 'out');

  const toggleCat = (id: string) => {
    const cid = id as CategoryId;
    setF({ ...f, cats: f.cats.includes(cid) ? f.cats.filter((x) => x !== cid) : [...f.cats, cid] });
  };

  return (
    <div className="stack fade-in">
      <div className="card hero-card">
        <div>
          <div className="hero-label">
            {filtered ? 'Resultado no filtro escolhido' : 'Resultado do mês'}
            <Info>Quanto entrou menos quanto saiu (despesas e acertos). Negativo quer dizer que saiu mais do que entrou, e a diferença veio do dinheiro guardado.</Info>
          </div>
          <div className={`hero-figure num ${T.net < 0 ? 'neg' : ''}`}>{brl(T.net)}</div>
          <p className="hero-text">
            Entraram <strong>{brl(T.income)}</strong> e saíram <strong>{brl(T.out)}</strong>
            {T.acertos > 0 && <> — dos quais <strong>{brl(T.acertos)}</strong> são acertos pontuais</>}.
            {!filtered && T.acertos > 0 && <> Sem os acertos, o mês teria sobrado <strong>{brl((c(T.income) - c(T.expenses)) / 100)}</strong>.</>}
          </p>
        </div>
        <div>
          <div className="kv"><span className="sec">Saldo anterior <span className="muted">({dateBR(model.opening.date)})</span></span><span className="v">{brl(model.opening.amount)}</span></div>
          <div className="kv"><span className="sec">+ Receitas</span><span className="v" style={{ color: 'var(--good-ink)' }}>{brl(all.income)}</span></div>
          <div className="kv"><span className="sec">− Despesas</span><span className="v">{brl(all.expenses)}</span></div>
          <div className="kv"><span className="sec">− Acertos</span><span className="v">{brl(all.acertos)}</span></div>
          <div className="kv" style={{ borderTop: '1px solid var(--axis)' }}>
            <span style={{ fontWeight: 650 }}>Resta para o próximo mês <Info>É o “Saldo” final da planilha (célula {model.closing.cell}): o saldo anterior mais as receitas, menos as despesas e os acertos. Confere com a soma dos saldos nos bancos.</Info></span>
            <span className="v" style={{ fontSize: 17 }}>{brl(model.closing.amount)}</span>
          </div>
          {filtered && <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>Este extrato é sempre do mês inteiro; os filtros valem para o resto da página.</div>}
        </div>
      </div>

      <div className="tiles">
        <div className="tile">
          <div className="t-label"><span className="t-key" style={{ background: 'var(--series-in)' }} />Receitas</div>
          <div className="t-value num">{brl(T.income)}</div>
          <div className="t-foot">{byCategory(ts, 'in').map((r) => CAT[r.id].short).join(' e ') || 'nenhuma no filtro'}</div>
        </div>
        <div className="tile">
          <div className="t-label"><span className="t-key" style={{ background: 'var(--series-out)' }} />Despesas<Info>As contas do mês: cartões, casas, educação, família, parcelas. Não inclui os acertos.</Info></div>
          <div className="t-value num">{brl(T.expenses)}</div>
          <div className="t-foot">{ts.filter((t) => t.kind === 'despesa').length} lançamentos</div>
        </div>
        <div className="tile">
          <div className="t-label"><span className="t-key" style={{ background: 'var(--cat-7)' }} />Acertos<Info>Saídas que a planilha separa sob o título “Acertos”: {model.transactions.filter((t) => t.kind === 'acerto' && t.amount > 0).map((t) => t.description).join('; ')}.</Info></div>
          <div className="t-value num">{brl(T.acertos)}</div>
          <div className="t-foot">{f.acertos ? `${ts.filter((t) => t.kind === 'acerto').length} lançamentos` : 'fora do filtro'}</div>
        </div>
        <div className="tile">
          <div className="t-label">Quanto sobrou da renda<Info>Resultado dividido pelas receitas. Mostra que parte do que entrou ficou guardada. Com os acertos o número fica negativo; sem eles, é o número de baixo.</Info></div>
          <div className="t-value num" style={{ color: savings != null && savings < 0 ? 'var(--bad-ink)' : undefined }}>{savings == null ? '—' : pct(savings)}</div>
          <div className="t-foot">{savingsNoAc != null && T.acertos > 0 ? `sem acertos: ${pct(savingsNoAc)}` : 'das receitas do período'}</div>
        </div>
      </div>

      <div className="grid">
        <section className="card span-6">
          <div className="card-head"><h2>Como o mês fechou</h2></div>
          <p className="sub">O que entrou soma; cada grupo de saídas desconta. Toque ou passe o mouse para ver os detalhes.</p>
          {steps.length ? <Waterfall steps={steps} onPick={(k) => k !== 'resultado' && toggleCat(k)} /> : <div className="empty">Nada no período escolhido.</div>}
        </section>
        <section className="card span-6">
          <div className="card-head"><h2>Entradas e saídas ao longo do mês</h2></div>
          <p className="sub">Valores acumulados dia a dia. Quando a linha laranja passa da azul, já saiu mais do que entrou.</p>
          <CumulativeChart data={cum} events={prevDay && prevDay >= f.from && prevDay <= f.to ? [{ date: prevDay, label: CAT.previdencia.short }] : []} />
        </section>
        <section className="card span-5">
          <div className="card-head"><h2>Para onde foi o dinheiro</h2><button className="link-btn" onClick={() => go('gastos')}>Ver gastos →</button></div>
          <p className="sub">Clique num grupo para filtrar a página.</p>
          <BarRows ariaLabel="Saídas por grupo" rows={cats.map((r) => ({ key: r.id, label: CAT[r.id].label, value: r.amount, color: CAT[r.id].color, sub: pct(r.share) }))} selected={f.cats} onToggle={toggleCat} />
          {!cats.length && <div className="empty">Sem saídas no filtro escolhido.</div>}
        </section>
        <section className="span-7 stack" style={{ gap: 16 }}>
          {insights.map((i) => <InsightCard key={i.id} i={i} />)}
          <button className="link-btn" style={{ alignSelf: 'flex-start' }} onClick={() => go('descobertas')}>Ver todas as descobertas →</button>
        </section>
      </div>
    </div>
  );
}
