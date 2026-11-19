import type { BudgetModel } from '../lib/types';
import { brl, dateBR, pct } from '../lib/format';
import { BarRows, Dumbbell, MaturityTimeline } from '../components/charts';
import { Info } from '../components/ui';

export function Wealth({ model, today }: { model: BudgetModel; today: string }) {
  const W = model.wealth;
  const inv = model.investments;
  const live = inv.filter((i) => i.current !== 0).sort((a, b) => b.current - a.current);
  const zero = inv.filter((i) => i.current === 0);
  const maxInv = Math.max(...live.map((i) => Math.abs(i.current)), 1);
  const upcoming = inv.filter((i) => i.maturity && i.current > 0).sort((a, b) => a.maturity!.localeCompare(b.maturity!));
  const asOf = model.investmentsAsOf || 'data da planilha';
  const gross = W.investments + W.assets;
  return (
    <div className="stack fade-in">
      <div className="card hero-card">
        <div>
          <div className="hero-label">Patrimônio líquido <span className="muted">· {asOf}</span>
            <Info>Tudo o que se tem (aplicações, contas e bens) menos o que se deve (empréstimos). É o “Patrimônio líquido” calculado na própria planilha.</Info>
          </div>
          <div className="hero-figure num">{brl(W.net)}</div>
          <p className="hero-text">
            <strong>{brl(W.gross)}</strong> em patrimônio, menos <strong>{brl(W.loans)}</strong> de empréstimos em aberto ({pct(W.loans / W.gross)} do patrimônio).
          </p>
        </div>
        <div>
          <div className="segbar" role="img" aria-label={`Investimentos e contas ${pct(W.investments / gross)}, bens ${pct(W.assets / gross)}`}>
            <div style={{ flexGrow: W.investments, background: 'var(--w-inv)' }}>{pct(W.investments / gross)}</div>
            <div style={{ flexGrow: W.assets, background: 'var(--w-assets)' }}>{pct(W.assets / gross)}</div>
          </div>
          <div className="legend" style={{ marginBottom: 6 }}>
            <span><i className="sq" style={{ background: 'var(--w-inv)' }} /> Aplicações e contas</span>
            <span><i className="sq" style={{ background: 'var(--w-assets)' }} /> Bens</span>
          </div>
          <div className="kv"><span className="sec">Aplicações e contas</span><span className="v">{brl(W.investments)}</span></div>
          <div className="kv"><span className="sec">Bens (imóveis, carros, lotes)</span><span className="v">{brl(W.assets)}</span></div>
          <div className="kv"><span className="sec">− Empréstimos</span><span className="v">{brl(W.loans)}</span></div>
          <div className="kv" style={{ borderTop: '1px solid var(--axis)' }}><span style={{ fontWeight: 650 }}>= Patrimônio líquido</span><span className="v">{brl(W.net)}</span></div>
        </div>
      </div>
      <p className="muted" style={{ margin: '-6px 4px 0', fontSize: 13.5 }}>Esta página mostra a posição registrada na planilha ({asOf}) e não muda com os filtros do mês.</p>

      <div className="grid">
        <section className="card span-7">
          <div className="card-head"><h2>Aplicações <Info>Valor atual de cada aplicação, como está na planilha. Embaixo de cada valor: quanto foi aplicado e a variação entre os dois.</Info></h2></div>
          <p className="sub">Valor atual de cada aplicação, do maior para o menor.</p>
          <BarRows
            ariaLabel="Valor atual de cada aplicação"
            maxValue={maxInv}
            rows={live.map((i) => ({
              key: i.cell,
              label: i.name,
              value: i.current,
              color: i.current < 0 ? 'var(--cat-other)' : 'var(--w-inv)',
              sub: i.applied > 0 ? `aplicado ${brl(i.applied)} · ${i.current >= i.applied ? '+' : ''}${pct(i.current / i.applied - 1)}` : i.current < 0 ? 'saldo negativo' : 'conta',
            }))}
          />
          {zero.length > 0 && (
            <details style={{ marginTop: 12 }}>
              <summary className="sec" style={{ cursor: 'pointer', fontSize: 14 }}>{zero.length} linhas com valor zero (vencidas, resgatadas ou contas zeradas)</summary>
              <div style={{ marginTop: 8 }}>
                {zero.map((i) => (
                  <div className="kv" key={i.cell}><span>{i.name}</span><span className="muted" style={{ fontSize: 13 }}>{i.maturity ? `venc. ${dateBR(i.maturity)}` : i.maturityText || '—'}{i.applied ? ` · aplicado ${brl(i.applied)}` : ''}</span></div>
                ))}
              </div>
            </details>
          )}
        </section>
        <section className="card span-5">
          <div className="card-head"><h2>Saldos por instituição <Info>Quadro “Saldo 29” da planilha: quanto há em cada banco ou aplicação no fim do mês. A soma bate com o saldo que resta para o próximo mês.</Info></h2></div>
          <p className="sub">Soma: {brl(model.balancesTotal ?? 0)}</p>
          <BarRows
            ariaLabel="Saldo por instituição"
            rows={[...model.balances].sort((a, b) => b.amount - a.amount).map((b) => ({ key: b.name, label: b.name, value: b.amount, color: 'var(--w-inv)', sub: model.balancesTotal ? pct(b.amount / model.balancesTotal) : undefined }))}
          />
        </section>

        <section className="card span-12">
          <div className="card-head"><h2>Vencimentos das aplicações</h2></div>
          <p className="sub">Quando cada aplicação com saldo vence. O tamanho do círculo acompanha o valor atual.</p>
          <MaturityTimeline today={today} items={upcoming.map((i) => ({ name: i.name, date: i.maturity!, value: i.current }))} />
          <div className="table-wrap" style={{ marginTop: 10 }}>
            <table className="plain">
              <thead><tr><th>Aplicação</th><th>Vence em</th><th className="r">Valor atual</th><th className="r hidden-mobile">Situação</th></tr></thead>
              <tbody>
                {upcoming.map((i) => {
                  const months = Math.round((Date.parse(i.maturity!) - Date.parse(today)) / (30.44 * 86400000));
                  return (
                    <tr key={i.cell}>
                      <td>{i.name}</td>
                      <td className="num">{dateBR(i.maturity)}</td>
                      <td className="r">{brl(i.current)}</td>
                      <td className="r hidden-mobile sec">{months < 0 ? 'data já passou' : months === 0 ? 'este mês' : months < 12 ? `em ${months} ${months === 1 ? 'mês' : 'meses'}` : `em ${(months / 12).toFixed(1).replace('.', ',')} anos`}</td>
                    </tr>
                  );
                })}
                {inv.filter((i) => !i.maturity && i.maturityText && i.current > 0).map((i) => (
                  <tr key={i.cell}><td>{i.name}</td><td>{i.maturityText}</td><td className="r">{brl(i.current)}</td><td className="r hidden-mobile sec">liquidez diária</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card span-7">
          <div className="card-head"><h2>Bens: quanto custaram e quanto valem</h2></div>
          <p className="sub">Valores informados na planilha. O círculo vazio é o valor pago; o cheio, o valor atual.</p>
          <Dumbbell rows={[...model.assets].sort((a, b) => b.value - a.value).map((a) => ({ name: a.name, a: a.cost, b: a.value, aLabel: 'Valor pago', bLabel: 'Valor atual' }))} />
        </section>
        <section className="card span-5">
          <div className="card-head"><h2>Empréstimos</h2></div>
          <p className="sub">Saldo devedor de cada empréstimo, como está na planilha.</p>
          {model.loans.map((l) => (
            <div className="kv" key={l.name}>
              <span>
                {l.name}
                <div className="muted" style={{ fontSize: 12.5 }}>{l.contracted ? `contratado em ${dateBR(l.contracted)}` : ''}{l.until ? ` · até ${l.until}` : ''}</div>
              </span>
              <span className="v" style={{ color: l.balance === 0 ? 'var(--ink-3)' : undefined }}>{brl(l.balance)}</span>
            </div>
          ))}
          <div className="kv" style={{ borderTop: '1px solid var(--axis)' }}><span style={{ fontWeight: 650 }}>Total</span><span className="v">{brl(W.loans)}</span></div>
          <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>Linhas com R$ 0,00 estão assim na planilha (sem saldo informado).</p>
        </section>
      </div>
    </div>
  );
}
