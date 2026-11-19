import { useMemo, useState } from 'react';
import type { BudgetModel, Txn } from '../lib/types';
import { CAT } from '../lib/categories';
import { applyFilters, totals, type Filters } from '../lib/metrics';
import { brl, dateBR, weekdayShort } from '../lib/format';
import { Icon } from '../components/ui';

type SortKey = 'date' | 'amount' | 'description';

const KIND_LABEL = { receita: 'Entrada', despesa: 'Despesa', acerto: 'Acerto' } as const;

function norm(s: string) {
  // accent-insensitive; "cartões" also finds "cartão" (Portuguese plural -ões/-ães)
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/(o|a)es\b/g, 'ao');
}

export function Transactions({ model, f, openTxn }: { model: BudgetModel; f: Filters; openTxn: (t: Txn) => void }) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'date', dir: 1 });
  const [zeros, setZeros] = useState(false);
  const base = applyFilters(model, f, zeros);
  const rows = useMemo(() => {
    const nq = norm(q.trim());
    const tokens = nq.split(/\s+/).filter(Boolean);
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
  const head = (key: SortKey, label: string, cls = '') => (
    <th className={cls} aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={() => setSort((s) => ({ key, dir: s.key === key ? ((-s.dir) as 1 | -1) : key === 'amount' ? -1 : 1 }))}>
        {label} {sort.key === key ? (sort.dir === 1 ? '↑' : '↓') : <span className="muted">{Icon.sort}</span>}
      </button>
    </th>
  );
  const amountCell = (t: Txn) => (
    <span className={t.kind === 'receita' ? 'amt-in' : t.kind === 'acerto' ? 'amt-ac' : 'amt-out'}>
      {t.kind === 'receita' ? '+ ' : '− '}
      {brl(t.amount)}
    </span>
  );

  return (
    <section className="card fade-in">
      <div className="card-head"><h2>Todos os lançamentos</h2></div>
      <p className="sub">Busque por nome, valor ou data. Toque num lançamento para ver os detalhes e a anotação da planilha.</p>
      <div className="explorer-tools">
        <div className="search">
          {Icon.search}
          <input type="search" placeholder="Buscar: cartão, água, Rafael, 500…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar lançamentos" />
        </div>
        <select className="select" aria-label="Ordenar por" value={`${sort.key}:${sort.dir}`} onChange={(e) => { const [k, d] = e.target.value.split(':'); setSort({ key: k as SortKey, dir: +d as 1 | -1 }); }}>
          <option value="date:1">Data (mais antiga primeiro)</option>
          <option value="date:-1">Data (mais recente primeiro)</option>
          <option value="amount:-1">Valor (maior primeiro)</option>
          <option value="amount:1">Valor (menor primeiro)</option>
          <option value="description:1">Descrição (A–Z)</option>
        </select>
        <label className="toggle" title="Linhas que estão na planilha com valor R$ 0,00">
          <input type="checkbox" checked={zeros} onChange={(e) => setZeros(e.target.checked)} />
          Mostrar linhas com valor zero
        </label>
      </div>

      {rows.length === 0 ? (
        <div className="empty">Nenhum lançamento encontrado{q ? ` para “${q}”` : ''}.</div>
      ) : (
        <>
          <div className="table-wrap">
            <table className="tx">
              <thead>
                <tr>
                  {head('date', 'Data')}
                  {head('description', 'Descrição')}
                  <th>Grupo</th>
                  <th>Tipo</th>
                  {head('amount', 'Valor', 'r')}
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id} className={t.amount === 0 ? 'zero' : ''} onClick={() => openTxn(t)} tabIndex={0} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), openTxn(t))}>
                    <td className="num" style={{ whiteSpace: 'nowrap' }}>{dateBR(t.date)} <span className="muted" style={{ fontSize: 12.5 }}>{t.date ? weekdayShort(t.date) : ''}</span></td>
                    <td className="desc-cell">
                      <div className="d">{t.description}</div>
                      {t.note && <div className="n">{t.note}</div>}
                    </td>
                    <td><span className="cat-cell"><i style={{ background: CAT[t.category].color }} />{CAT[t.category].short}</span></td>
                    <td><span className={`kind-badge ${t.kind === 'receita' ? 'in' : ''}`}>{KIND_LABEL[t.kind]}</span></td>
                    <td className="r num">{amountCell(t)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="tx-cards">
            {rows.map((t) => (
              <button key={t.id} type="button" className="tx-card" onClick={() => openTxn(t)}>
                <span className="d">{t.description}</span>
                <span className="a num">{amountCell(t)}</span>
                <span className="m">
                  <span className="cat-cell"><i style={{ background: CAT[t.category].color }} />{CAT[t.category].short}</span>
                  <span>{dateBR(t.date)}</span>
                </span>
                <span className="m" style={{ justifyContent: 'flex-end' }}>{KIND_LABEL[t.kind]}</span>
              </button>
            ))}
          </div>
          <div className="tx-sum">
            <span>{rows.length} {rows.length === 1 ? 'lançamento' : 'lançamentos'}</span>
            {T.income > 0 && <span>Entradas <b>{brl(T.income)}</b></span>}
            {T.expenses > 0 && <span>Despesas <b>{brl(T.expenses)}</b></span>}
            {T.acertos > 0 && <span>Acertos <b>{brl(T.acertos)}</b></span>}
            {T.income > 0 && T.out > 0 && <span>Resultado <b style={{ color: T.net < 0 ? 'var(--bad-ink)' : 'var(--good-ink)' }}>{brl(T.net)}</b></span>}
          </div>
        </>
      )}
    </section>
  );
}

export function TxnDrawer({ t, onClose }: { t: Txn; onClose: () => void }) {
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
        <div className="big" style={{ color: t.kind === 'receita' ? 'var(--good-ink)' : undefined }}>{t.kind === 'receita' ? '+ ' : '− '}{brl(t.amount)}</div>
        <dl className="dl">
          <dt>Data</dt><dd>{t.date ? `${dateBR(t.date)} (${weekdayShort(t.date)})` : '—'}</dd>
          <dt>Parte do mês</dt><dd>{t.block === 'inicio' ? '1ª parte do mês' : t.block === 'fim' ? '2ª parte do mês' : 'Acertos'}</dd>
          {t.installment && <><dt>Parcela</dt><dd>{t.installment.total ? `${t.installment.n} de ${t.installment.total} (faltam ${t.installment.total - t.installment.n})` : `nº ${t.installment.n}`}</dd></>}
          <dt>Na planilha</dt><dd>célula <span className="mono">{t.cell}</span>{t.highlighted ? ' · marcada em azul' : ''}</dd>
          <dt>Grupo</dt><dd>{cat.explain}</dd>
        </dl>
        {t.note && <div className="note-box"><b>Anotação na planilha</b>{t.note}</div>}
        {!t.hasDescription && <div className="note-box" style={{ marginTop: 12 }}><b>Sem descrição</b>Na planilha, a descrição desta linha aparece como “0” (uma fórmula aponta para uma célula vazia).</div>}
      </aside>
    </>
  );
}
