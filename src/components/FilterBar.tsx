import { useState } from 'react';
import type { BudgetModel, CategoryId } from '../lib/types';
import { CAT, CATEGORIES } from '../lib/categories';
import { defaultFilters, isFiltered, monthRange, splitDate, type Filters } from '../lib/metrics';
import { dateBR, dayMonth } from '../lib/format';

export function FilterBar({ model, f, setF }: { model: BudgetModel; f: Filters; setF: (f: Filters) => void }) {
  const [open, setOpen] = useState(false);
  const { min, max } = monthRange(model);
  const used = new Set(model.transactions.filter((t) => t.amount > 0).map((t) => t.category));
  const cats = CATEGORIES.filter((c) => used.has(c.id));
  const { split, dayBefore } = splitDate(model);
  const preset = f.from === min && f.to === max ? 'all' : split && f.from === min && f.to === dayBefore ? 'a' : split && f.from === split && f.to === max ? 'b' : f.from === f.to ? 'day' : 'custom';
  const toggleCat = (id: CategoryId) => setF({ ...f, cats: f.cats.includes(id) ? f.cats.filter((c) => c !== id) : [...f.cats, id] });
  const filtered = isFiltered(f, model);

  const active: { key: string; label: string; clear: () => void }[] = [];
  if (preset !== 'all') active.push({ key: 'p', label: preset === 'day' ? `Dia ${dateBR(f.from)}` : `${dayMonth(f.from)} a ${dayMonth(f.to)}`, clear: () => setF({ ...f, from: min, to: max }) });
  if (f.flow !== 'tudo') active.push({ key: 'fl', label: f.flow === 'entradas' ? 'Só entradas' : 'Só saídas', clear: () => setF({ ...f, flow: 'tudo' }) });
  if (!f.acertos) active.push({ key: 'ac', label: 'Sem acertos', clear: () => setF({ ...f, acertos: true }) });
  f.cats.forEach((c) => active.push({ key: c, label: CAT[c].short, clear: () => toggleCat(c) }));

  return (
    <div className={`filterbar ${open ? 'open' : ''}`}>
      <div className="fb-inner">
        <div className="fb-main">
          <div className="seg" role="group" aria-label="Período">
            <button type="button" aria-pressed={preset === 'all'} onClick={() => setF({ ...f, from: min, to: max })}>Mês todo</button>
            {split && dayBefore && (
              <>
                <button type="button" aria-pressed={preset === 'a'} onClick={() => setF({ ...f, from: min, to: dayBefore })} title={`${dateBR(min)} a ${dateBR(dayBefore)}`}>1 a {+dayBefore.slice(8)}</button>
                <button type="button" aria-pressed={preset === 'b'} onClick={() => setF({ ...f, from: split, to: max })} title={`${dateBR(split)} a ${dateBR(max)}`}>{+split.slice(8)} a {+max.slice(8)}</button>
              </>
            )}
          </div>
          <div className="seg" role="group" aria-label="Entradas ou saídas">
            <button type="button" aria-pressed={f.flow === 'tudo'} onClick={() => setF({ ...f, flow: 'tudo' })}>Tudo</button>
            <button type="button" aria-pressed={f.flow === 'entradas'} onClick={() => setF({ ...f, flow: 'entradas' })}>Entradas</button>
            <button type="button" aria-pressed={f.flow === 'saidas'} onClick={() => setF({ ...f, flow: 'saidas' })}>Saídas</button>
          </div>
          <label className="switch" title="Os acertos são saídas pontuais que a planilha separa do total de despesas">
            <input type="checkbox" checked={f.acertos} onChange={(e) => setF({ ...f, acertos: e.target.checked })} />
            <span className="sw" aria-hidden="true" />
            Incluir acertos
          </label>
          <button type="button" className="fb-more" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            {open ? 'Menos filtros' : 'Datas e grupos'}{f.cats.length ? ` (${f.cats.length})` : ''}
          </button>
        </div>
        <div className="fb-extra">
          <div className="fb-dates">
            <span className="fb-label">De</span>
            <input className="date-input" type="date" aria-label="De" min={min} max={max} value={f.from} onChange={(e) => e.target.value && setF({ ...f, from: e.target.value > f.to ? f.to : e.target.value })} />
            <span className="fb-label">até</span>
            <input className="date-input" type="date" aria-label="Até" min={min} max={max} value={f.to} onChange={(e) => e.target.value && setF({ ...f, to: e.target.value < f.from ? f.from : e.target.value })} />
          </div>
          <div className="cat-chips" role="group" aria-label="Grupos">
            {cats.map((c) => (
              <button key={c.id} type="button" className="cat-chip" aria-pressed={f.cats.includes(c.id)} onClick={() => toggleCat(c.id)}>
                <span className="dot" style={{ background: CAT[c.id].color }} />
                {c.short}
              </button>
            ))}
          </div>
        </div>
        {filtered && (
          <div className="fb-active" aria-live="polite">
            <span className="fb-label">Filtrando:</span>
            {active.map((a) => (
              <button key={a.key} type="button" className="active-pill" onClick={a.clear} aria-label={`Tirar o filtro ${a.label}`}>
                {a.label} <span aria-hidden="true">×</span>
              </button>
            ))}
            <button type="button" className="link-btn" onClick={() => setF(defaultFilters(model))}>Limpar tudo</button>
          </div>
        )}
      </div>
    </div>
  );
}
