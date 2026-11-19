import type { BudgetModel } from '../lib/types';
import { applyFilters, buckets, byDay, byWeek, monthDays, totals, type Filters } from '../lib/metrics';
import { brl, int } from '../lib/format';
import { BarRows, DailyColumns } from '../components/charts';
import { CalendarHeat } from '../components/viz';
import { Info } from '../components/ui';

/** Section 03: the month day by day. */
export function Timeline({ model, f, pickDay }: { model: BudgetModel; f: Filters; pickDay: (d: string) => void }) {
  const ts = applyFilters(model, f);
  const outs = ts.filter((t) => t.kind !== 'receita');
  const T = totals(outs);
  const days = byDay(ts, f.from, f.to);
  const daysWithOut = days.filter((d) => d.out > 0);
  // The calendar is a selector: it always shows the whole month (with the other filters applied).
  const { first, last } = monthDays(model);
  const calDays = byDay(applyFilters(model, { ...f, from: first, to: last }), first, last);
  const selectedDay = f.from === f.to ? f.from : null;
  const weeks = byWeek(outs).filter((w) => w.from <= +f.to.slice(8) && w.to >= +f.from.slice(8));
  const bks = buckets(outs);
  const median = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };

  return (
    <div className="grid">
      <div className="stat-strip span-12">
        <div><span>Dias com saída</span><b className="num">{daysWithOut.length} <small>de {days.length}</small></b></div>
        <div><span>Média por dia <Info>Total de saídas dividido pelos {days.length} dias do período.</Info></span><b className="num">{days.length ? brl(T.out / days.length) : '—'}</b></div>
        <div><span>Gasto típico <Info>A mediana: metade dos lançamentos é menor que isto. Poucos valores grandes não a puxam para cima, ao contrário da média ({outs.length ? brl(T.out / outs.length) : '—'}).</Info></span><b className="num">{outs.length ? brl(median(outs.map((t) => t.amount))) : '—'}</b></div>
        <div><span>Lançamentos de saída</span><b className="num">{int(outs.length)}</b></div>
      </div>

      <div className="card span-7">
        <div className="card-head"><h3>Saídas por dia</h3></div>
        <p className="sub">Cada coluna é um dia, empilhada por grupo. Toque num dia para ver só ele.{f.acertos && T.acertos > 0 ? ' Desligue “Incluir acertos” para ver melhor os dias comuns.' : ''}</p>
        <DailyColumns days={days} selectedCats={f.cats} onPickDay={(d) => pickDay(d.date)} />
      </div>
      <div className="card span-5">
        <div className="card-head"><h3>Calendário do mês</h3></div>
        <p className="sub">Quanto mais forte a cor, mais saiu no dia. Toque num dia para filtrar; toque de novo para voltar.</p>
        <CalendarHeat days={calDays} inRange={(d) => d >= f.from && d <= f.to} selected={selectedDay} onPick={pickDay} />
      </div>

      <div className="card span-6">
        <div className="card-head"><h3>Por semana do mês</h3></div>
        <p className="sub">Saídas somadas por semana do calendário.</p>
        <BarRows ariaLabel="Saídas por semana do mês" maxValue={Math.max(...weeks.map((w) => w.out), 1)} rows={weeks.map((w) => ({ key: w.label, label: `Dias ${w.label}`, value: w.out, color: 'var(--series-out)', sub: `${w.count} ${w.count === 1 ? 'lançamento' : 'lançamentos'}` }))} />
      </div>
      <div className="card span-6">
        <div className="card-head"><h3>Tamanho dos gastos <Info>Quantos lançamentos caem em cada faixa de valor. Mostra se o mês foi feito de muitas contas pequenas ou de poucas grandes.</Info></h3></div>
        <p className="sub">Quantos lançamentos em cada faixa de valor, e quanto somam.</p>
        <BarRows ariaLabel="Lançamentos por faixa de valor" maxValue={Math.max(...bks.map((b) => b.count), 1)} rows={bks.map((b) => ({ key: b.label, label: b.label, value: b.count, color: 'var(--series-out)', right: `${b.count} ${b.count === 1 ? 'lançamento' : 'lançamentos'}`, sub: brl(b.amount) }))} />
      </div>
    </div>
  );
}
