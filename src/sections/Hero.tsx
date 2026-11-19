import { useState } from 'react';
import { scaleLinear } from 'd3-scale';
import { area, curveStepAfter, line } from 'd3-shape';
import type { BudgetModel } from '../lib/types';
import { applyFilters, byDay, c, cumulative, isFiltered, monthRange, totals, type Filters } from '../lib/metrics';
import { brl, dateBR, dayMonth, monthName, pct } from '../lib/format';
import { useWidth } from '../components/ui';
import { useCountUp } from '../components/viz';
import { Info } from '../components/ui';

export function Hero({ model, f }: { model: BudgetModel; f: Filters }) {
  const { min, max } = monthRange(model);
  const ts = applyFilters(model, f);
  const T = totals(ts);
  const all = totals(model.transactions.filter((t) => t.amount > 0));
  const filtered = isFiltered(f, model);
  const semAcertos = (c(T.income) - c(T.expenses)) / 100;
  const animated = useCountUp(T.net);
  const month = monthName(min);
  const nIn = ts.filter((t) => t.kind === 'receita').length;
  const nExp = ts.filter((t) => t.kind === 'despesa').length;
  const nAc = ts.filter((t) => t.kind === 'acerto').length;
  const rate = T.income > 0 ? T.net / T.income : null;
  const rateNoAc = T.income > 0 ? semAcertos / T.income : null;
  const balancesOk = model.balancesTotal != null && c(model.balancesTotal) === c(model.closing.amount);

  return (
    <header className="hero">
      <div className="hero-inner">
        <div className="hero-top">
          <div className="hero-copy">
            <div className="hero-eyebrow">Orçamento do mês · {dateBR(min)} a {dateBR(max)}</div>
            <h1>{month.charAt(0).toUpperCase() + month.slice(1)}</h1>
            <p className="hero-lead">
              Entraram <b>{brl(all.income)}</b> e saíram <b>{brl(all.out)}</b>.
              {all.acertos > 0 && (
                <>
                  {' '}Os acertos pontuais (<b>{brl(all.acertos)}</b>) fizeram o mês fechar {all.net < 0 ? 'no negativo' : 'mais apertado'}; sem eles, teriam sobrado <b>{brl((c(all.income) - c(all.expenses)) / 100)}</b>.
                </>
              )}
            </p>
          </div>
          <div className="hero-result">
            <div className="hr-label">
              {filtered ? 'Resultado no filtro' : 'Resultado do mês'}
              <Info>Quanto entrou menos tudo o que saiu (despesas e acertos). Negativo quer dizer que saiu mais do que entrou, e a diferença veio do dinheiro guardado.</Info>
            </div>
            <div className={`hr-figure num ${T.net < 0 ? 'neg' : 'pos'}`}>{brl(animated)}</div>
            <NetSpark model={model} f={f} />
          </div>
        </div>

        <div className="kpis">
          <Kpi label="Receitas" dot="var(--income-1)" value={T.income} foot={nIn ? `${nIn} ${nIn === 1 ? 'entrada' : 'entradas'}: aposentadoria e previdência` : 'nenhuma no filtro'} />
          <Kpi label="Despesas" dot="var(--series-out)" value={T.expenses} foot={`${nExp} lançamentos`} info="As contas do mês: cartões, casas, educação, família, parcelas. Não inclui os acertos." />
          <Kpi label="Acertos" dot="var(--cat-7)" value={T.acertos} foot={f.acertos ? `${nAc} saídas pontuais` : 'fora do filtro'} info="Saídas que a planilha separa sob o título “Acertos” e desconta só no saldo final." />
          <div className="kpi">
            <div className="kpi-label">Quanto sobrou da renda <Info>Resultado dividido pelas receitas. Negativo: saiu mais do que entrou.</Info></div>
            <div className={`kpi-value num ${rate != null && rate < 0 ? 'neg' : ''}`}>{rate == null ? '—' : pct(rate)}</div>
            <div className="kpi-foot">{rateNoAc != null && T.acertos > 0 ? <>sem os acertos: <b>{pct(rateNoAc)}</b></> : 'das receitas do período'}</div>
          </div>
          <Kpi label="Resta para o próximo mês" value={model.closing.amount} foot={balancesOk ? '✓ confere com o saldo dos bancos' : `saldo anterior ${brl(model.opening.amount)}`} info={`O “Saldo” final da planilha: saldo anterior (${brl(model.opening.amount)}, de ${dateBR(model.opening.date)}) mais as receitas, menos as despesas e os acertos. É sempre o do mês inteiro.`} strong />
          <Kpi label="Patrimônio líquido" value={model.wealth.net} foot={model.investmentsAsOf ? `posição de ${model.investmentsAsOf}` : 'aplicações + bens − empréstimos'} info="Aplicações, contas e bens, menos os empréstimos. É o “Patrimônio líquido” calculado na própria planilha." strong />
        </div>
        {filtered && <p className="hero-note">Os quatro primeiros números seguem os filtros. O saldo e o patrimônio são sempre da planilha inteira.</p>}
      </div>
    </header>
  );
}

function Kpi({ label, value, foot, dot, info, strong }: { label: string; value: number; foot: React.ReactNode; dot?: string; info?: string; strong?: boolean }) {
  return (
    <div className={`kpi ${strong ? 'strong' : ''}`}>
      <div className="kpi-label">{dot && <i style={{ background: dot }} />}{label}{info && <Info>{info}</Info>}</div>
      <div className="kpi-value num">{brl(value)}</div>
      <div className="kpi-foot">{foot}</div>
    </div>
  );
}

/** The month's running result, day by day (income minus everything that went out so far). */
function NetSpark({ model, f }: { model: BudgetModel; f: Filters }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hi, setHi] = useState<number | null>(null);
  const ts = applyFilters(model, f);
  const data = cumulative(byDay(ts, f.from, f.to));
  if (data.length < 2) return <div ref={ref} />;
  const h = 92;
  const m = { l: 2, r: 2, t: 10, b: 18 };
  const lo = Math.min(0, ...data.map((d) => d.net));
  const hiV = Math.max(0, ...data.map((d) => d.net));
  const x = scaleLinear().domain([0, data.length - 1]).range([m.l, Math.max(m.l + 10, w - m.r)]);
  const y = scaleLinear().domain([lo, hiV || 1]).nice(3).range([h - m.b, m.t]);
  const pathL = line<(typeof data)[0]>().x((_, i) => x(i)).y((d) => y(d.net)).curve(curveStepAfter)(data) ?? '';
  const pathA = area<(typeof data)[0]>().x((_, i) => x(i)).y0(y(0)).y1((d) => y(d.net)).curve(curveStepAfter)(data) ?? '';
  const p = hi != null ? data[hi] : data[data.length - 1];
  const pick = (clientX: number, el: SVGSVGElement) => {
    const px = clientX - el.getBoundingClientRect().left;
    setHi(Math.max(0, Math.min(data.length - 1, Math.round(x.invert(px)))));
  };
  return (
    <div className="spark" ref={ref}>
      <div className="spark-cap">
        <span>Resultado acumulado {hi != null ? `até ${dayMonth(p.date)}` : 'dia a dia'}</span>
        <b className="num">{brl(p.net)}</b>
      </div>
      {w > 0 && (
        <svg width={w} height={h} role="img" aria-label="Resultado acumulado do mês, dia a dia" onMouseMove={(e) => pick(e.clientX, e.currentTarget)} onTouchMove={(e) => pick(e.touches[0].clientX, e.currentTarget)} onMouseLeave={() => setHi(null)}>
          <line x1={m.l} x2={w - m.r} y1={y(0)} y2={y(0)} className="spark-zero" />
          <text x={w - m.r} y={y(0) - 4} textAnchor="end" className="spark-t">0</text>
          <path d={pathA} className="spark-area" />
          <path d={pathL} className="spark-line" />
          {hi != null && <line x1={x(hi)} x2={x(hi)} y1={m.t} y2={h - m.b} className="spark-cross" />}
          <circle cx={x(hi ?? data.length - 1)} cy={y(p.net)} r={4.5} className="spark-dot" />
          <text x={m.l} y={h - 3} className="spark-t">{dayMonth(data[0].date)}</text>
          <text x={w - m.r} y={h - 3} textAnchor="end" className="spark-t">{dayMonth(data[data.length - 1].date)}</text>
        </svg>
      )}
    </div>
  );
}
