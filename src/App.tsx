import { useEffect, useState } from 'react';
import type { CategoryId, Txn } from './lib/types';
import { extractKey, loadBudget, type Dataset, type LoadResult } from './lib/data';
import { defaultFilters, monthRange, type Filters } from './lib/metrics';
import { clearAccess, loadTheme, saveTheme, type Theme } from './lib/storage';
import { FilterBar } from './components/FilterBar';
import { BrandMark, Icon } from './components/ui';
import { Reveal } from './components/viz';
import { Hero } from './sections/Hero';
import { Flow } from './sections/Flow';
import { Spending } from './sections/Spending';
import { Timeline } from './sections/Timeline';
import { Transactions, TxnDrawer } from './sections/Transactions';
import { Insights } from './sections/Insights';
import { Wealth } from './sections/Wealth';
import { About } from './sections/About';

const SECTIONS = [
  { id: 'entradas-e-saidas', n: '01', label: 'Entradas e saídas', title: 'Entradas e saídas', sub: 'O que entrou, o que saiu e como o mês fechou.' },
  { id: 'gastos', n: '02', label: 'Gastos', title: 'Para onde foi o dinheiro', sub: 'Cada grupo de gastos, do maior para o menor, e quanto ele pesa na renda.' },
  { id: 'dia-a-dia', n: '03', label: 'Dia a dia', title: 'O mês, dia a dia', sub: 'Quando o dinheiro saiu: dias, semanas e o tamanho de cada gasto.' },
  { id: 'lancamentos', n: '04', label: 'Lançamentos', title: 'Todos os lançamentos', sub: 'Cada linha da planilha. Busque, ordene e toque para ver os detalhes.' },
  { id: 'descobertas', n: '05', label: 'Descobertas', title: 'O que os números contam', sub: 'Observações tiradas dos números do mês, cada uma dizendo se é fato, estimativa ou leitura.' },
  { id: 'patrimonio', n: '06', label: 'Patrimônio', title: 'Patrimônio', sub: 'Aplicações, saldos nos bancos, bens e empréstimos, como estão na planilha.' },
  { id: 'dados', n: '07', label: 'Sobre os dados', title: 'Sobre os dados', sub: 'De onde vem cada número e a conferência, centavo por centavo, com a planilha.' },
] as const;

export default function App() {
  const [res, setRes] = useState<LoadResult | null>(null);
  useEffect(() => {
    loadBudget().then(setRes);
    // A private link opened in a tab that already shows the page only changes the #fragment.
    const onHash = () => extractKey(window.location.hash) && loadBudget().then(setRes);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  if (!res) return <Splash />;
  if (res.status !== 'ok') return <Locked res={res} onOpen={(k) => loadBudget(k).then(setRes)} />;
  return <Dashboard data={res.data} />;
}

function Splash() {
  return (
    <div className="splash" aria-busy="true">
      <BrandMark className="brand-mark pulse" />
      <span>Preparando o painel…</span>
    </div>
  );
}

function Locked({ res, onOpen }: { res: Exclude<LoadResult, { status: 'ok' }>; onOpen: (k: string) => void }) {
  const [v, setV] = useState('');
  return (
    <div className="locked">
      <div className="locked-card">
        <div className="brand"><BrandMark /> Budget Dad</div>
        <div className="lock-ic">{Icon.lock}</div>
        <h1>Painel particular</h1>
        <p>Os números deste painel são da família e ficam protegidos. Para ver, abra o <b>link pessoal</b> que você recebeu. Depois da primeira vez, este aparelho lembra o acesso.</p>
        {res.status === 'error' && <div className="error" role="alert">{res.message}</div>}
        {res.status === 'locked' && res.reason === 'bad-key' && <div className="error" role="alert">Esse link não abre este painel. Confira se ele foi copiado inteiro.</div>}
        <form className="lock-form" onSubmit={(e) => { e.preventDefault(); if (v.trim()) onOpen(v); }}>
          <input type="text" inputMode="url" autoComplete="off" spellCheck={false} placeholder="Ou cole aqui o link pessoal" value={v} onChange={(e) => setV(e.target.value)} aria-label="Link pessoal" />
          <button type="submit" className="btn-primary">Abrir</button>
        </form>
      </div>
    </div>
  );
}

function Dashboard({ data }: { data: Dataset }) {
  const model = data.model;
  const [f, setF] = useState<Filters>(() => defaultFilters(model));
  const [txn, setTxn] = useState<Txn | null>(null);
  const [theme, setTheme] = useState<Theme>(loadTheme);
  const [active, setActive] = useState<string>('');
  const today = new Date().toISOString().slice(0, 10);
  const { min, max } = monthRange(model);

  useEffect(() => {
    if (theme === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
    saveTheme(theme);
  }, [theme]);

  // Highlight the section being read in the navigation.
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (es) => {
        const vis = es.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (vis) setActive(vis.target.id);
      },
      { rootMargin: '-30% 0px -60% 0px' },
    );
    SECTIONS.forEach((s) => { const el = document.getElementById(s.id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, []);

  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const toggleCat = (id: CategoryId) => setF((p) => ({ ...p, cats: p.cats.includes(id) ? p.cats.filter((x) => x !== id) : [...p.cats, id] }));
  const setCats = (ids: CategoryId[]) => setF((p) => ({ ...p, cats: ids }));
  const pickDay = (d: string) => setF((p) => (p.from === d && p.to === d ? { ...p, from: min, to: max } : { ...p, from: d, to: d }));
  const showCategory = (id: CategoryId) => {
    setF((p) => ({ ...p, cats: [id] }));
    setTxn(null);
    setTimeout(() => go('lancamentos'), 30);
  };
  const themeNext: Record<Theme, Theme> = { auto: 'light', light: 'dark', dark: 'auto' };
  const themeLabel = { auto: 'Tema automático', light: 'Tema claro', dark: 'Tema escuro' }[theme];

  return (
    <>
      <nav className="topbar" aria-label="Seções">
        <div className="topbar-inner">
          <button className="brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Budget Dad, voltar ao topo"><BrandMark /> <span>Budget Dad</span></button>
          <div className="nav-links">
            {SECTIONS.map((s) => (
              <button key={s.id} className={`nav-link ${active === s.id ? 'on' : ''}`} onClick={() => go(s.id)} aria-current={active === s.id ? 'true' : undefined}>{s.label}</button>
            ))}
          </div>
          <button className="icon-btn" onClick={() => setTheme(themeNext[theme])} aria-label={`${themeLabel}. Clique para trocar.`} title={themeLabel}>
            {theme === 'auto' ? Icon.auto : theme === 'light' ? Icon.sun : Icon.moon}
          </button>
        </div>
      </nav>

      <Hero model={model} f={f} />
      <FilterBar model={model} f={f} setF={setF} />

      <main className="shell">
        {SECTIONS.map((s) => (
          <Reveal as="section" key={s.id} id={s.id} className="section">
            <div className="section-head">
              <span className="section-n">{s.n}</span>
              <div>
                <h2>{s.title}</h2>
                <p>{s.sub}</p>
              </div>
            </div>
            {s.id === 'entradas-e-saidas' && <Flow model={model} f={f} toggleCat={toggleCat} />}
            {s.id === 'gastos' && <Spending model={model} f={f} toggleCat={toggleCat} setCats={setCats} openTxn={setTxn} />}
            {s.id === 'dia-a-dia' && <Timeline model={model} f={f} pickDay={pickDay} />}
            {s.id === 'lancamentos' && <Transactions model={model} f={f} openTxn={setTxn} />}
            {s.id === 'descobertas' && <Insights model={model} today={today} onPick={showCategory} area={['mes', 'gastos']} />}
            {s.id === 'patrimonio' && (
              <>
                <p className="section-note">Posição registrada na planilha ({model.investmentsAsOf || 'data da planilha'}). Não muda com os filtros do mês.</p>
                <Wealth model={model} today={today} />
                <div style={{ marginTop: 20 }}><Insights model={model} today={today} onPick={showCategory} area={['patrimonio']} /></div>
              </>
            )}
            {s.id === 'dados' && <About model={model} source={data.source} />}
          </Reveal>
        ))}

        <footer className="footer">
          <span><BrandMark className="brand-mark sm" /> Budget Dad · números da planilha “{data.source.name}” (pasta PAI), conferidos com as fórmulas dela.</span>
          {!import.meta.env.DEV && (
            <button className="link-btn" onClick={() => { clearAccess(); window.location.reload(); }} title="Este aparelho deixa de abrir o painel sem o link pessoal">Esquecer o acesso neste aparelho</button>
          )}
        </footer>
      </main>
      {txn && <TxnDrawer t={txn} onClose={() => setTxn(null)} onCategory={() => showCategory(txn.category)} />}
    </>
  );
}
