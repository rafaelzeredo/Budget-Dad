import { useMemo, useState } from 'react';
import type { BudgetModel, Txn } from '../lib/types';
import { CAT } from '../lib/categories';
import { applyFilters, c, totals, type Filters } from '../lib/metrics';
import { brl, dateBR, weekday, weekdayShort } from '../lib/format';
import { Icon } from '../components/ui';

type SortKey = 'date' | 'amount' | 'description';
const KIND_LABEL = { receita: 'Entrada', despesa: 'Despesa', acerto: 'Acerto' } as const;

function norm(s: string) {
  // accent-insensitive; "cartões" also finds "cartão" (Portuguese plural -ões/-ães)
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/(o|a)es\b/g, 'ao');
}

/** Section 04: every line of the month, as a feed grouped by day. */
export function Transactions({ model, f, openTxn }: { model: BudgetModel; f: Filters; openTxn: (t: Txn) => void }) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'date', dir: 1 });
  const [zeros, setZeros] = useState(false);
  const base = applyFilters(model, f, zeros);
  const rows = useMemo(() => {
    const tokens = norm(q.trim()).split(/\s+/).filter(Boolean);
    const xs = base.filter((t) => {
      if (!tokens.length) return true;
      const hay = norm([t.description, t.note ?? '', CAT[t.category].label, KIND_LABEL[t.kind], brl(t.amount), dateBR(t.date)].join(' '));
      return tokens.every((tk) => hay.includes(tk));
    });
    return xs.sort((a, b) => {
      let r = 0;
      if (sort.key === 'date') r = (a.date ?? '').localeCompare(b.date ?? '') || a.cell.localeCompare(b.cell);
      if (sort.key === 'amount') r = a.amount - b.amount;
      if (sort.key === 'description') r = a.description.localeCompare(b.description, 'pt-BR');
      return r * sort.dir;
    });
  }, [base, q, sort]);
  const T = totals(rows);
  const groups = useMemo(() => {
    if (sort.key !== 'date') return [{ key: 'all', date: null as string | null, items: rows }];
    const g: { key: string; date: string | null; items: Txn[] }[] = [];
    rows.forEach((t) => {
      const k = t.date ?? 'sem-data';
      const last = g[g.length - 1];
      if (last && last.key === k) last.items.push(t);
      else g.push({ key: k, date: t.date, items: [t] });
    });
    return g;
  }, [rows, sort.key]);

  return (
    <div className="card explorer">
      <div className="explorer-tools">
        <div className="search">
          {Icon.search}
          <input type="search" placeholder="Buscar: cartão, água, parcela, 500…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar lançamentos" />
        </div>
        <select className="select" aria-label="Ordenar por" value={`${sort.key}:${sort.dir}`} onChange={(e) => { const [k, d] = e.target.value.split(':'); setSort({ key: k as SortKey, dir: +d as 1 | -1 }); }}>
          <option value="date:1">Data, do início ao fim do mês</option>
          <option value="date:-1">Data, do fim ao início do mês</option>
          <option value="amount:-1">Maior valor primeiro</option>
          <option value="amount:1">Menor valor primeiro</option>
          <option value="description:1">Descrição, A–Z</option>
        </select>
        <label className="switch" title="Linhas que estão na planilha com valor R$ 0,00">
          <input type="checkbox" checked={zeros} onChange={(e) => setZeros(e.target.checked)} />
          <span className="sw" aria-hidden="true" />
          Linhas com R$ 0,00
        </label>
      </div>

      <div className="tx-sum">
        <span><b>{rows.length}</b> {rows.length === 1 ? 'lançamento' : 'lançamentos'}</span>
        {T.income > 0 && <span>Entradas <b className="amt-in">+ {brl(T.income)}</b></span>}
        {T.expenses > 0 && <span>Despesas <b>− {brl(T.expenses)}</b></span>}
        {T.acertos > 0 && <span>Acertos <b>− {brl(T.acertos)}</b></span>}
        {T.income > 0 && T.out > 0 && <span>Resultado <b style={{ color: T.net < 0 ? 'var(--bad-ink)' : 'var(--good-ink)' }}>{brl(T.net)}</b></span>}
      </div>

      {rows.length === 0 ? (
        <div className="empty">Nenhum lançamento encontrado{q ? ` para “${q}”` : ''}.</div>
      ) : (
        <div className="feed">
          {groups.map((g) => {
            const dayOut = g.items.filter((t) => t.kind !== 'receita').reduce((a, t) => a + c(t.amount), 0) / 100;
            const dayIn = g.items.filter((t) => t.kind === 'receita').reduce((a, t) => a + c(t.amount), 0) / 100;
            return (
              <div className="feed-day" key={g.key}>
                {g.key !== 'all' && (
                  <div className="feed-date">
                    <span className="fd-cal" aria-hidden="true"><b>{g.date ? +g.date.slice(8) : '—'}</b><small>{g.date ? weekdayShort(g.date) : ''}</small></span>
                    <span className="fd-text">{g.date ? `${weekday(g.date).charAt(0).toUpperCase()}${weekday(g.date).slice(1)}, ${dateBR(g.date)}` : 'Sem data'}</span>
                    <span className="fd-sum num">
                      {dayIn > 0 && <span className="amt-in">+ {brl(dayIn)}</span>}
                      {dayOut > 0 && <span>− {brl(dayOut)}</span>}
                    </span>
                  </div>
                )}
                <div className="feed-items">
                  {g.items.map((t) => (
                    <button key={t.id} type="button" className={`feed-item ${t.amount === 0 ? 'zero' : ''}`} onClick={() => openTxn(t)}>
                      <span className="fi-icon" style={{ ['--c' as string]: CAT[t.category].color }}>{CAT[t.category].short.slice(0, 1)}</span>
                      <span className="fi-main">
                        <span className="fi-d">{t.description}</span>
                        <span className="fi-m">
                          {CAT[t.category].short}
                          {t.installment && <> · parcela {t.installment.n}{t.installment.total ? `/${t.installment.total}` : ''}</>}
                          {g.key === 'all' && t.date && <> · {dateBR(t.date)}</>}
                          {t.kind === 'acerto' && <> · acerto</>}
                          {t.note && <span className="fi-note"> · {t.note}</span>}
                        </span>
                      </span>
                      <span className={`fi-a num ${t.kind === 'receita' ? 'amt-in' : ''}`}>{t.kind === 'receita' ? '+ ' : '− '}{brl(t.amount)}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function TxnDrawer({ t, onClose, onCategory }: { t: Txn; onClose: () => void; onCategory: () => void }) {
  const cat = CAT[t.category];
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={`Detalhes: ${t.description}`} onKeyDown={(e) => e.key === 'Escape' && onClose()}>
        <div className="drawer-head">
          <span className="pill"><span style={{ width: 9, height: 9, borderRadius: 3, background: cat.color, display: 'inline-block' }} /> {cat.label}</span>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar" autoFocus>{Icon.close}</button>
        </div>
        <h3>{t.description}</h3>
        <div className="muted">{KIND_LABEL[t.kind]}{t.place ? ` · casa (${t.place})` : ''}</div>
        <div className="big num" style={{ color: t.kind === 'receita' ? 'var(--good-ink)' : undefined }}>{t.kind === 'receita' ? '+ ' : '− '}{brl(t.amount)}</div>
        <dl className="dl">
          <dt>Data</dt><dd>{t.date ? `${dateBR(t.date)} (${weekday(t.date)})` : '—'}</dd>
          <dt>Parte do mês</dt><dd>{t.block === 'inicio' ? '1ª parte do mês' : t.block === 'fim' ? '2ª parte do mês' : 'Acertos'}</dd>
          {t.installment && <><dt>Parcela</dt><dd>{t.installment.total ? `${t.installment.n} de ${t.installment.total} (faltam ${t.installment.total - t.installment.n})` : `nº ${t.installment.n}`}</dd></>}
          <dt>Na planilha</dt><dd>célula <span className="mono">{t.cell}</span>{t.highlighted ? ' · marcada em azul' : ''}</dd>
          <dt>Grupo</dt><dd>{cat.explain}</dd>
        </dl>
        {t.note && <div className="note-box"><b>Anotação na planilha</b>{t.note}</div>}
        {!t.hasDescription && <div className="note-box" style={{ marginTop: 12 }}><b>Sem descrição</b>Na planilha, a descrição desta linha aparece como “0” (uma fórmula aponta para uma célula vazia).</div>}
        {t.kind !== 'receita' && <button className="btn-soft" onClick={onCategory}>Ver todos de {cat.short} →</button>}
      </aside>
    </>
  );
}
