import type { BudgetModel, CategoryId } from '../lib/types';
import { buildInsights, type Insight } from '../lib/insights';
import { CAT } from '../lib/categories';

const KIND = {
  fato: { label: 'Fato calculado', hint: 'Conta feita direto com os números da planilha.' },
  estimativa: { label: 'Estimativa', hint: 'Conta feita com uma suposição, que está escrita no texto.' },
  leitura: { label: 'Leitura', hint: 'Interpretação dos números; vale confirmar.' },
};

export function InsightCard({ i, onPick }: { i: Insight; onPick?: (c: CategoryId) => void }) {
  const clickable = !!(i.category && onPick && CAT[i.category].kind !== 'receita');
  const Tag = clickable ? 'button' : 'article';
  return (
    <Tag type={clickable ? 'button' : undefined} className={`ins ${clickable ? 'clickable' : ''}`} onClick={clickable ? () => onPick!(i.category!) : undefined} style={i.category ? { ['--c' as string]: CAT[i.category].color } : undefined}>
      <span className={`k ${i.kind}`} title={KIND[i.kind].hint}>{KIND[i.kind].label}</span>
      <h4>{i.title}</h4>
      {i.figure && <div className="fig num">{i.figure}</div>}
      <p>{i.body}</p>
      {clickable && <span className="ins-go">Ver os lançamentos de {CAT[i.category!].short} →</span>}
    </Tag>
  );
}

/** Section 05: observations computed from the real numbers. */
export function Insights({ model, today, onPick, area }: { model: BudgetModel; today: string; onPick: (c: CategoryId) => void; area: Insight['area'][] }) {
  const all = buildInsights(model, today).filter((i) => area.includes(i.area));
  return (
    <>
      <div className="ins-legend">
        {(Object.keys(KIND) as (keyof typeof KIND)[]).map((k) => (
          <span key={k}><span className={`k ${k}`}>{KIND[k].label}</span> {KIND[k].hint}</span>
        ))}
      </div>
      <div className="ins-grid">{all.map((i) => <InsightCard key={i.id} i={i} onPick={onPick} />)}</div>
    </>
  );
}
