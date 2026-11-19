import type { BudgetModel } from '../lib/types';
import { buildInsights, type Insight } from '../lib/insights';
import { CAT } from '../lib/categories';

const KIND = {
  fato: { label: 'Fato calculado', hint: 'Conta feita direto com os números da planilha.' },
  estimativa: { label: 'Estimativa', hint: 'Conta feita com uma suposição, que está escrita no texto.' },
  leitura: { label: 'Leitura', hint: 'Interpretação dos números; vale confirmar.' },
};

export function InsightCard({ i }: { i: Insight }) {
  return (
    <article className="card ins">
      <span className={`k ${i.kind}`} title={KIND[i.kind].hint}>{KIND[i.kind].label}</span>
      <h3>
        {i.category && <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: CAT[i.category].color, marginRight: 8 }} />}
        {i.title}
      </h3>
      {i.figure && <div className="fig num">{i.figure}</div>}
      <p>{i.body}</p>
    </article>
  );
}

export function Insights({ model, today }: { model: BudgetModel; today: string }) {
  const all = buildInsights(model, today);
  const groups: { id: Insight['area']; title: string }[] = [
    { id: 'mes', title: 'O mês' },
    { id: 'gastos', title: 'Os gastos' },
    { id: 'patrimonio', title: 'O patrimônio' },
  ];
  return (
    <div className="fade-in">
      <div className="ins-legend">
        {(Object.keys(KIND) as (keyof typeof KIND)[]).map((k) => (
          <span key={k} className="ins" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <span className={`k ${k}`}>{KIND[k].label}</span> {KIND[k].hint}
          </span>
        ))}
      </div>
      {groups.map((g) => {
        const xs = all.filter((i) => i.area === g.id);
        if (!xs.length) return null;
        return (
          <section key={g.id}>
            <h2 className="section-title">{g.title}</h2>
            <div className="ins-grid">{xs.map((i) => <InsightCard key={i.id} i={i} />)}</div>
          </section>
        );
      })}
    </div>
  );
}
