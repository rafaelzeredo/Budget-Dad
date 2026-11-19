import type { BudgetModel } from '../lib/types';
import { CAT, CLASSIFICATION_RULES } from '../lib/categories';
import { brl, dateBR } from '../lib/format';
import { duplicates, monthRange } from '../lib/metrics';
import type { Dataset } from '../lib/data';

const GLOSSARY: [string, string][] = [
  ['Receita', 'Dinheiro que entrou no mês, como aposentadoria e previdência complementar.'],
  ['Despesa', 'Contas e gastos do mês lançados nas colunas de despesa da planilha.'],
  ['Acertos', 'Saídas pontuais que a planilha separa das despesas e desconta só no saldo final.'],
  ['Resultado', 'Receitas menos tudo o que saiu (despesas e acertos).'],
  ['Saldo anterior', 'Quanto havia guardado antes dos lançamentos do mês.'],
  ['Patrimônio líquido', 'Aplicações, contas e bens, menos os empréstimos.'],
  ['CDI', 'Taxa de referência das aplicações de renda fixa. “103% do CDI” rende um pouco mais que o CDI.'],
  ['CDB, LCA, RDB', 'Tipos de aplicação de renda fixa em bancos. A LCA é isenta de imposto de renda.'],
  ['13º (décimo terceiro)', 'Pagamento extra de fim de ano.'],
];

export function About({ model, source }: { model: BudgetModel; source: Dataset['source'] }) {
  const { min, max } = monthRange(model);
  const dups = duplicates(model);
  const repeated = [...new Set(model.transactions.filter((t) => t.amount > 0).map((t) => t.description))].filter((d) => model.transactions.filter((t) => t.amount > 0 && t.description === d).length > 1);
  const okCount = model.checks.filter((c) => Math.round(c.sheet * 100) === Math.round(c.computed * 100)).length;
  return (
    <div className="grid">
        <section className="card span-6">
          <h3>De onde vêm os números</h3>
          <p className="sub">A planilha da pasta PAI, lida sem nenhuma alteração. Nenhum número foi digitado à mão.</p>
          <div className="kv"><span className="sec">Arquivo</span><span className="v">PAI/{source.name}</span></div>
          <div className="kv"><span className="sec">Impressão digital (SHA-256)</span><span className="v mono" title={source.sha256}>{source.sha256.slice(0, 12)}…</span></div>
          <div className="kv"><span className="sec">Aba</span><span className="v">{model.sheetName}</span></div>
          <div className="kv"><span className="sec">Lançamentos do mês</span><span className="v">{dateBR(min)} a {dateBR(max)}</span></div>
          <div className="kv"><span className="sec">Linhas com valor</span><span className="v">{model.transactions.filter((t) => t.amount > 0).length}</span></div>
          <div className="kv"><span className="sec">Linhas com valor zero</span><span className="v">{model.transactions.filter((t) => t.amount === 0).length}</span></div>
          <div className="kv"><span className="sec">Patrimônio e investimentos</span><span className="v">{model.investmentsAsOf || '—'}</span></div>
          <div className="kv"><span className="sec">Lançamentos duplicados</span><span className="v">{dups.length ? `${dups.length} grupo(s)` : 'nenhum'}</span></div>
          {repeated.length > 0 && <p className="muted" style={{ fontSize: 13 }}>Descrições que aparecem mais de uma vez ({repeated.join(', ')}) têm datas ou valores diferentes, por isso contam como lançamentos separados.</p>}
          <p className="sec" style={{ fontSize: 14, marginBottom: 0 }}>
            O que é receita, despesa e acerto vem das <b>fórmulas da própria planilha</b>: por exemplo, as despesas da 1ª parte do mês são exatamente as células somadas em “Despesa”. Nenhum valor é inventado ou estimado, a não ser onde está escrito “estimativa”.
          </p>
        </section>
        <section className="card span-6">
          <h3>Conferência com a planilha</h3>
          <p className="sub">{okCount} de {model.checks.length} totais calculados pelo painel batem com os da planilha, centavo por centavo.</p>
          <div className="table-wrap">
            <table className="plain">
              <thead><tr><th>Total</th><th className="r">Planilha</th><th className="r">Painel</th><th></th></tr></thead>
              <tbody>
                {model.checks.map((c) => {
                  const ok = Math.round(c.sheet * 100) === Math.round(c.computed * 100);
                  return (
                    <tr key={c.cell + c.label}>
                      <td>{c.label} <span className="mono">{c.cell}</span>{c.note && <div className="muted" style={{ fontSize: 12.5 }}>{c.note}</div>}</td>
                      <td className="r">{brl(c.sheet)}</td>
                      <td className="r">{brl(c.computed)}</td>
                      <td>{ok ? <span className="ok">✓ igual</span> : <span className="diff">≠ diferente</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card span-12">
          <h3>Pontos de atenção na planilha</h3>
          <p className="sub">Coisas encontradas ao ler o arquivo. Nada foi corrigido na planilha; o painel só explica como tratou cada caso.</p>
          {model.issues.map((i) => (
            <div className="issue" key={i.title}>
              <span className={`ic ${i.severity}`}>{i.severity === 'atencao' ? '!' : 'i'}</span>
              <div>
                <h4>{i.title}</h4>
                <p>{i.detail}</p>
                {i.cells && i.cells.length > 0 && <p className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>Células: {i.cells.join(', ')}</p>}
              </div>
            </div>
          ))}
        </section>

        <section className="card span-6">
          <h3>Como os lançamentos foram agrupados</h3>
          <p className="sub">Os grupos são do painel (a planilha não tem uma coluna de categoria). As regras são simples e visíveis:</p>
          {CLASSIFICATION_RULES.map((r) => (
            <div className="kv" key={r.category} style={{ justifyContent: 'flex-start' }}>
              <span className="cat-cell" style={{ minWidth: 130 }}><i style={{ background: CAT[r.category].color }} />{CAT[r.category].short}</span>
              <span className="sec" style={{ fontSize: 14 }}>{r.rule}</span>
            </div>
          ))}
          <p className="muted" style={{ fontSize: 13.5 }}>Não separamos “essencial” de “supérfluo”: as faturas de cartão misturam os dois, e a planilha não diz o que há dentro delas.</p>
        </section>
        <section className="card span-6">
          <h3>Resumo por categoria da planilha</h3>
          <p className="sub">O quadro como está na planilha, para comparar. Ele é parcial (veja “Pontos de atenção”).</p>
          {model.sheetSummary.map((s) => (
            <div className="kv" key={s.label}><span className="sec">{s.label}</span><span className="v">{brl(s.amount)}</span></div>
          ))}
        </section>

        <section className="card span-6">
          <h3>Linhas sem valor</h3>
          <p className="sub">Linhas com data mas sem valor (ou com valor zero e sem descrição). Não entram em nenhum total.</p>
          <div className="table-wrap">
            <table className="plain">
              <thead><tr><th>Célula</th><th>Data</th><th>Observação</th></tr></thead>
              <tbody>
                {model.emptyRows.map((e) => (
                  <tr key={e.cell}><td className="mono">{e.cell}</td><td>{dateBR(e.date)}</td><td className="sec">{e.description ?? '—'}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="card span-6">
          <h3>Palavras do painel</h3>
          <dl className="gloss" style={{ marginTop: 14 }}>
            {GLOSSARY.map(([t, d]) => (<div key={t}><dt>{t}</dt><dd>{d}</dd></div>))}
          </dl>
        </section>
    </div>
  );
}
