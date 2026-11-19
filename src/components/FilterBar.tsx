import type { BudgetModel, CategoryId } from '../lib/types';
import { CAT, CATEGORIES } from '../lib/categories';
import { defaultFilters, isFiltered, monthRange, type Filters } from '../lib/metrics';
import { dateBR } from '../lib/format';

export function FilterBar({ model, f, setF }: { model: BudgetModel; f: Filters; setF: (f: Filters) => void }) {
  const { min, max } = monthRange(model);
  const used = new Set(model.transactions.filter((t) => t.amount > 0).map((t) => t.category));
  const cats = CATEGORIES.filter((c) => used.has(c.id));
  // The template splits the month in two parts (the second starts when the second income arrives).
  const split = model.transactions.find((t) => t.block === 'fim' && t.kind === 'receita')?.date ?? null;
  const dayBefore = split ? new Date(Date.parse(split + 'T12:00:00Z') - 86400000).toISOString().slice(0, 10) : null;
  const preset = f.from === min && f.to === max ? 'all' : split && f.from === min && f.to === dayBefore ? 'a' : split && f.from === split && f.to === max ? 'b' : 'custom';
  const toggleCat = (id: CategoryId) => setF({ ...f, cats: f.cats.includes(id) ? f.cats.filter((c) => c !== id) : [...f.cats, id] });
  return (
    <section className="filters" aria-label="Filtros">
      <div className="group">
        <span className="label">Período</span>
        <div className="seg" role="group" aria-label="Período">
          <button type="button" aria-pressed={preset === 'all'} onClick={() => setF({ ...f, from: min, to: max })}>Mês todo</button>
          {split && dayBefore && (
            <>
              <button type="button" aria-pressed={preset === 'a'} onClick={() => setF({ ...f, from: min, to: dayBefore })} title={`${dateBR(min)} a ${dateBR(dayBefore)}`}>Até dia {+dayBefore.slice(8)}</button>
              <button type="button" aria-pressed={preset === 'b'} onClick={() => setF({ ...f, from: split, to: max })} title={`${dateBR(split)} a ${dateBR(max)}`}>Do dia {+split.slice(8)} em diante</button>
            </>
          )}
        </div>
        <input className="date-input" type="date" aria-label="De" min={min} max={max} value={f.from} onChange={(e) => e.target.value && setF({ ...f, from: e.target.value > f.to ? f.to : e.target.value })} />
        <span className="muted" aria-hidden="true">a</span>
        <input className="date-input" type="date" aria-label="Até" min={min} max={max} value={f.to} onChange={(e) => e.target.value && setF({ ...f, to: e.target.value < f.from ? f.from : e.target.value })} />
      </div>
      <div className="group">
        <span className="label">Mostrar</span>
        <div className="seg" role="group" aria-label="Entradas ou saídas">
          <button type="button" aria-pressed={f.flow === 'tudo'} onClick={() => setF({ ...f, flow: 'tudo' })}>Tudo</button>
          <button type="button" aria-pressed={f.flow === 'entradas'} onClick={() => setF({ ...f, flow: 'entradas' })}>Entradas</button>
          <button type="button" aria-pressed={f.flow === 'saidas'} onClick={() => setF({ ...f, flow: 'saidas' })}>Saídas</button>
        </div>
        <label className="toggle" title="Os acertos são saídas pontuais que a planilha separa do total de despesas">
          <input type="checkbox" checked={f.acertos} onChange={(e) => setF({ ...f, acertos: e.target.checked })} />
          Incluir acertos
        </label>
      </div>
      <div className="group" style={{ flexBasis: '100%' }}>
        <span className="label">Grupos</span>
        <div className="cat-chips" role="group" aria-label="Grupos de lançamentos">
          {cats.map((c) => (
            <button key={c.id} type="button" className="cat-chip" aria-pressed={f.cats.includes(c.id)} onClick={() => toggleCat(c.id)}>
              <span className="dot" style={{ background: CAT[c.id].color }} />
              {c.short}
            </button>
          ))}
        </div>
        {isFiltered(f, model) && (
          <button type="button" className="link-btn" onClick={() => setF(defaultFilters(model))}>Limpar filtros</button>
        )}
      </div>
    </section>
  );
}
