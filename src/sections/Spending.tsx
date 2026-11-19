import type { BudgetModel, CategoryId, Txn } from '../lib/types';
import { CAT } from '../lib/categories';
import { applyFilters, byCategory, installments, totals, type Filters } from '../lib/metrics';
import { brl, dateBR, pct } from '../lib/format';
import { Donut } from '../components/viz';
import { Info } from '../components/ui';

/** Section 02: where the money went. */
export function Spending({ model, f, toggleCat, setCats, openTxn }: { model: BudgetModel; f: Filters; toggleCat: (id: CategoryId) => void; setCats: (ids: CategoryId[]) => void; openTxn: (t: Txn) => void }) {
  // The selectors (donut, list) ignore the group filter so the other groups stay visible as context.
  const pool = applyFilters(model, { ...f, cats: [], flow: 'tudo' });
  const outs = pool.filter((t) => t.kind !== 'receita');
  const cats = byCategory(outs, 'out');
  const T = totals(pool);
  const sel = f.cats;
  const chosen = sel.length ? outs.filter((t) => sel.includes(t.category)).sort((a, b) => b.amount - a.amount) : [];
  const top = [...outs].filter((t) => !sel.length || sel.includes(t.category)).sort((a, b) => b.amount - a.amount).slice(0, 6);
  const inst = installments(model);

  return (
    <div className="grid">
      <div className="card span-12 dist">
        <div className="dist-chart">
          <Donut
            slices={cats.map((r) => ({ key: r.id, label: CAT[r.id].short, value: r.amount, color: CAT[r.id].color }))}
            selected={sel}
            onToggle={(k) => toggleCat(k as CategoryId)}
            centerTitle="Total que saiu"
            centerSub={`${outs.length} lançamentos`}
          />
        </div>
        <div className="dist-table">
          <div className="card-head">
            <h3>Por grupo</h3>
            {sel.length > 0 && <button className="link-btn" onClick={() => setCats([])}>Mostrar todos</button>}
          </div>
          <p className="sub">Toque num grupo para ver os lançamentos dele e filtrar a página.</p>
          <div className="ctable" role="table" aria-label="Saídas por grupo">
            <div className="ct-row ct-head" role="row">
              <span role="columnheader">Grupo</span>
              <span role="columnheader" className="r">Valor</span>
              <span role="columnheader" className="r">das saídas</span>
              <span role="columnheader" className="r ct-inc">da renda <Info>Quanto este grupo representa do que entrou no período ({brl(T.income)}).</Info></span>
            </div>
            {cats.map((r) => {
              const on = sel.includes(r.id);
              return (
                <button key={r.id} type="button" role="row" className={`ct-row ${on ? 'on' : ''} ${sel.length && !on ? 'dim' : ''}`} aria-pressed={on} onClick={() => toggleCat(r.id)}>
                  <span className="ct-name" role="cell">
                    <i style={{ background: CAT[r.id].color }} />
                    <span>{CAT[r.id].label}<small>{r.count} {r.count === 1 ? 'lançamento' : 'lançamentos'}</small></span>
                  </span>
                  <span className="r num ct-val" role="cell">{brl(r.amount)}</span>
                  <span className="r num" role="cell">
                    <span className="ct-share"><span style={{ width: `${r.share * 100}%`, background: CAT[r.id].color }} /></span>
                    {pct(r.share)}
                  </span>
                  <span className="r num ct-inc" role="cell">{T.income > 0 ? pct(r.amount / T.income) : '—'}</span>
                </button>
              );
            })}
          </div>
          {!cats.length && <div className="empty">Sem saídas no filtro escolhido.</div>}
        </div>
        {chosen.length > 0 && (
          <div className="chosen">
            <div className="chosen-head">
              <b>{sel.map((c) => CAT[c].short).join(' + ')}</b>
              <span className="muted">{chosen.length} {chosen.length === 1 ? 'lançamento' : 'lançamentos'} · {brl(chosen.reduce((a, t) => a + Math.round(t.amount * 100), 0) / 100)}</span>
            </div>
            <div className="chosen-list">
              {chosen.map((t) => (
                <button key={t.id} type="button" className="chip-txn" onClick={() => openTxn(t)}>
                  <i style={{ background: CAT[t.category].color }} />
                  <span className="ctx-d">{t.description}</span>
                  <span className="ctx-m">{dateBR(t.date)}</span>
                  <b className="num">{brl(t.amount)}</b>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="card span-6">
        <div className="card-head"><h3>As maiores saídas</h3></div>
        <p className="sub">Os lançamentos de maior valor{sel.length ? ' nos grupos escolhidos' : ''}. Toque para ver os detalhes.</p>
        <ol className="toplist">
          {top.map((t, i) => (
            <li key={t.id}>
              <button type="button" onClick={() => openTxn(t)}>
                <span className="rank">{i + 1}</span>
                <span className="what">
                  <div>{t.description}</div>
                  <div><span className="cat-cell"><i style={{ background: CAT[t.category].color }} />{CAT[t.category].short}</span> · {dateBR(t.date)}</div>
                </span>
                <span className="amt-wrap">
                  <span className="amt num">{brl(t.amount)}</span>
                  <span className="amt-bar"><span style={{ width: `${(t.amount / (top[0]?.amount || 1)) * 100}%`, background: CAT[t.category].color }} /></span>
                </span>
              </button>
            </li>
          ))}
        </ol>
        {!top.length && <div className="empty">Nada no filtro escolhido.</div>}
      </div>
      <div className="card span-6">
        <div className="card-head"><h3>Parcelas em andamento <Info>Lançamentos cuja descrição traz o número da parcela, como “35/48”. O valor que falta é uma estimativa: supõe que as próximas parcelas tenham o mesmo valor desta.</Info></h3></div>
        <p className="sub">Do mês inteiro. A barra mostra quanto do parcelamento já foi pago.</p>
        <div className="inst">
          {inst.map((i) => (
            <button type="button" className="inst-row" key={i.txn.id} onClick={() => openTxn(i.txn)}>
              <div className="inst-top">
                <span><b>{i.txn.description.replace(/\s*\d+\/\d+\s*$/, '')}</b> <span className="muted">· {brl(i.txn.amount)}/mês</span></span>
                <span className="r">{i.total ? `${i.n} de ${i.total}` : `parcela nº ${i.n}`}</span>
              </div>
              {i.total ? (
                <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={i.total} aria-valuenow={i.n} aria-label={`${i.n} de ${i.total} parcelas`}>
                  <div style={{ width: `${(i.n / i.total) * 100}%`, background: CAT[i.txn.category].color }} />
                </div>
              ) : (
                <div className="meter unknown" aria-hidden="true"><div /></div>
              )}
              <div className="muted inst-foot">
                {i.total ? <>faltam {i.left} · cerca de <b className="sec">{brl(i.remainingIfSame ?? 0)}</b> se o valor se mantiver</> : 'O total de parcelas não aparece na planilha.'}
              </div>
            </button>
          ))}
          {!inst.length && <div className="empty">Nenhuma parcela identificada.</div>}
        </div>
      </div>
    </div>
  );
}
