import type { BudgetModel, CategoryId, Txn } from '../lib/types';
import { CAT } from '../lib/categories';
import { applyFilters, buckets, byCategory, byDay, byWeek, installments, totals, type Filters } from '../lib/metrics';
import { brl, dateBR, int, pct } from '../lib/format';
import { BarRows, DailyColumns } from '../components/charts';
import { Info } from '../components/ui';

export function Spending({ model, f, setF, openTxn, openDay }: { model: BudgetModel; f: Filters; setF: (f: Filters) => void; openTxn: (t: Txn) => void; openDay: (date: string) => void }) {
  const ts = applyFilters(model, f).filter((t) => t.kind !== 'receita');
  const T = totals(ts);
  const cats = byCategory(ts, 'out');
  const days = byDay(ts, f.from, f.to);
  const weeks = byWeek(ts).filter((w) => w.from <= +f.to.slice(8) && w.to >= +f.from.slice(8));
  const maxWeek = Math.max(...weeks.map((w) => w.out), 1);
  const bks = buckets(ts);
  const top = [...ts].sort((a, b) => b.amount - a.amount).slice(0, 6);
  const inst = installments(model);
  const toggleCat = (id: string) => {
    const cid = id as CategoryId;
    setF({ ...f, cats: f.cats.includes(cid) ? f.cats.filter((x) => x !== cid) : [...f.cats, cid] });
  };
  const daysWithOut = days.filter((d) => d.out > 0);

  return (
    <div className="stack fade-in">
      <div className="tiles">
        <div className="tile"><div className="t-label">Total de saídas</div><div className="t-value num">{brl(T.out)}</div><div className="t-foot">{f.acertos ? 'despesas + acertos' : 'sem os acertos'}</div></div>
        <div className="tile"><div className="t-label">Lançamentos</div><div className="t-value num">{int(ts.length)}</div><div className="t-foot">em {daysWithOut.length} dias diferentes</div></div>
        <div className="tile"><div className="t-label">Gasto médio por lançamento<Info>Total de saídas dividido pelo número de lançamentos. Poucos valores grandes puxam a média para cima; por isso mostramos também a mediana.</Info></div><div className="t-value num">{ts.length ? brl(T.out / ts.length) : '—'}</div><div className="t-foot">mediana {ts.length ? brl(median(ts.map((t) => t.amount))) : '—'}</div></div>
        <div className="tile"><div className="t-label">Média por dia<Info>Total de saídas dividido pelos dias do período escolhido ({days.length} dias).</Info></div><div className="t-value num">{days.length ? brl(T.out / days.length) : '—'}</div><div className="t-foot">{days.length} dias no período</div></div>
      </div>

      <div className="grid">
        <section className="card span-5">
          <div className="card-head"><h2>Por grupo</h2></div>
          <p className="sub">Clique para filtrar todos os gráficos por um ou mais grupos.</p>
          <BarRows
            ariaLabel="Saídas por grupo"
            rows={cats.map((r) => ({ key: r.id, label: CAT[r.id].label, value: r.amount, color: CAT[r.id].color, sub: `${pct(r.share)} · ${r.count}×` }))}
            selected={f.cats}
            onToggle={toggleCat}
          />
          {!cats.length && <div className="empty">Sem saídas no filtro escolhido.</div>}
        </section>
        <section className="card span-7">
          <div className="card-head"><h2>Dia a dia</h2></div>
          <p className="sub">Quanto saiu em cada dia, por grupo. Clique num dia para ver os lançamentos.{f.acertos && T.acertos > 0 ? ' Desmarque “Incluir acertos” para ver melhor os dias comuns.' : ''}</p>
          <DailyColumns days={days} selectedCats={f.cats} onPickDay={(d) => openDay(d.date)} />
        </section>

        <section className="card span-6">
          <div className="card-head"><h2>Por semana do mês</h2></div>
          <p className="sub">Saídas somadas por semana do calendário.</p>
          <BarRows
            ariaLabel="Saídas por semana do mês"
            maxValue={maxWeek}
            rows={weeks.map((w) => ({ key: w.label, label: `Dias ${w.label}`, value: w.out, color: 'var(--series-out)', sub: `${w.count} ${w.count === 1 ? 'lançamento' : 'lançamentos'}` }))}
          />
        </section>
        <section className="card span-6">
          <div className="card-head"><h2>Tamanho dos gastos <Info>Quantos lançamentos caem em cada faixa de valor. Ajuda a ver se o mês foi feito de muitas contas pequenas ou de poucas grandes.</Info></h2></div>
          <p className="sub">Quantos lançamentos em cada faixa de valor, e quanto somam.</p>
          <BarRows
            ariaLabel="Lançamentos por faixa de valor"
            maxValue={Math.max(...bks.map((b) => b.count), 1)}
            rows={bks.map((b) => ({ key: b.label, label: b.label, value: b.count, color: 'var(--series-out)', right: `${b.count} ${b.count === 1 ? 'lançamento' : 'lançamentos'}`, sub: brl(b.amount) }))}
          />
        </section>

        <section className="card span-6">
          <div className="card-head"><h2>Maiores saídas</h2></div>
          <p className="sub">Os lançamentos de maior valor no filtro escolhido.</p>
          <ol className="toplist">
            {top.map((t, i) => (
              <li key={t.id}>
                <button type="button" onClick={() => openTxn(t)}>
                  <span className="rank">{i + 1}</span>
                  <span className="dot" style={{ width: 10, height: 10, borderRadius: 3, background: CAT[t.category].color, flex: 'none' }} />
                  <span className="what"><div>{t.description}</div><div>{dateBR(t.date)} · {CAT[t.category].label}</div></span>
                  <span className="amt">{brl(t.amount)}</span>
                </button>
              </li>
            ))}
          </ol>
          {!top.length && <div className="empty">Nada no filtro escolhido.</div>}
        </section>
        <section className="card span-6">
          <div className="card-head"><h2>Parcelas em andamento <Info>Lançamentos cuja descrição traz o número da parcela, como “35/48”. O valor que falta é uma estimativa: supõe que as próximas parcelas tenham o mesmo valor desta.</Info></h2></div>
          <p className="sub">Do mês inteiro. Barra = parcelas já pagas.</p>
          <div className="inst">
            {inst.map((i) => (
              <div className="inst-row" key={i.txn.id}>
                <div className="inst-top">
                  <span><b style={{ fontWeight: 600 }}>{i.txn.description}</b> <span className="muted">· {brl(i.txn.amount)}/mês</span></span>
                  <span className="r">{i.total ? `faltam ${i.left}` : `parcela nº ${i.n}`}</span>
                </div>
                {i.total ? (
                  <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={i.total} aria-valuenow={i.n} aria-label={`${i.n} de ${i.total} parcelas`}>
                    <div style={{ width: `${(i.n / i.total) * 100}%`, background: CAT[i.txn.category].color }} />
                  </div>
                ) : null}
                <div className="muted" style={{ fontSize: 13 }}>
                  {i.total ? <>Parcela {i.n} de {i.total}{i.remainingIfSame ? <> · ainda faltariam cerca de <b className="sec">{brl(i.remainingIfSame)}</b></> : null}</> : 'O total de parcelas não aparece na planilha.'}
                </div>
              </div>
            ))}
            {!inst.length && <div className="empty">Nenhuma parcela identificada.</div>}
          </div>
        </section>
      </div>
    </div>
  );
}

function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
