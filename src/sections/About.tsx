import type { BudgetModel } from '../lib/types';
import { CAT, CLASSIFICATION_RULES } from '../lib/categories';
import { brl, dateBR } from '../lib/format';
import { monthRange } from '../lib/metrics';

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

export function About({ model }: { model: BudgetModel }) {
  const { min, max } = monthRange(model);
  const okCount = model.checks.filter((c) => Math.round(c.sheet * 100) === Math.round(c.computed * 100)).length;
  return (
    <div className="stack fade-in">
      <div className="grid">
        <section className="card span-6">
          <h2>De onde vêm os números</h2>
          <p className="sub">Tudo é lido da planilha aberta, aqui no navegador.</p>
          <div className="kv"><span className="sec">Arquivo</span><span className="v">{model.fileName}</span></div>
          <div className="kv"><span className="sec">Aba</span><span className="v">{model.sheetName}</span></div>
          <div className="kv"><span className="sec">Lançamentos do mês</span><span className="v">{dateBR(min)} a {dateBR(max)}</span></div>
          <div className="kv"><span className="sec">Linhas com valor</span><span className="v">{model.transactions.filter((t) => t.amount > 0).length}</span></div>
          <div className="kv"><span className="sec">Linhas com valor zero</span><span className="v">{model.transactions.filter((t) => t.amount === 0).length}</span></div>
          <div className="kv"><span className="sec">Patrimônio e investimentos</span><span className="v">{model.investmentsAsOf || '—'}</span></div>
          <p className="sec" style={{ fontSize: 14, marginBottom: 0 }}>
            O que é receita, despesa e acerto vem das <b>fórmulas da própria planilha</b>: por exemplo, as despesas da 1ª parte do mês são exatamente as células somadas em “Despesa”. Nenhum valor é inventado ou estimado, a não ser onde está escrito “estimativa”.
          </p>
        </section>
        <section className="card span-6">
          <h2>Conferência com a planilha</h2>
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
          <h2>Pontos de atenção na planilha</h2>
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
          <h2>Como os lançamentos foram agrupados</h2>
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
          <h2>Resumo por categoria da planilha</h2>
          <p className="sub">O quadro como está na planilha, para comparar. Ele é parcial (veja “Pontos de atenção”).</p>
          {model.sheetSummary.map((s) => (
            <div className="kv" key={s.label}><span className="sec">{s.label}</span><span className="v">{brl(s.amount)}</span></div>
          ))}
        </section>

        <section className="card span-6">
          <h2>Linhas sem valor</h2>
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
          <h2>Palavras do painel</h2>
          <dl className="gloss" style={{ marginTop: 14 }}>
            {GLOSSARY.map(([t, d]) => (<div key={t}><dt>{t}</dt><dd>{d}</dd></div>))}
          </dl>
        </section>
      </div>
    </div>
  );
}
