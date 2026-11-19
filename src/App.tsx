import { useCallback, useEffect, useRef, useState } from 'react';
import type { BudgetModel, Txn } from './lib/types';
import { parseBudget } from './lib/template';
import { defaultFilters, monthRange, type Filters } from './lib/metrics';
import { dateBR, monthName } from './lib/format';
import { clearModel, loadModel, loadRemember, loadTheme, saveModel, saveRemember, saveTheme, type Theme } from './lib/storage';
import { Welcome } from './components/Welcome';
import { FilterBar } from './components/FilterBar';
import { BrandMark, Icon } from './components/ui';
import { Overview } from './sections/Overview';
import { Spending } from './sections/Spending';
import { Transactions, TxnDrawer } from './sections/Transactions';
import { Wealth } from './sections/Wealth';
import { Insights } from './sections/Insights';
import { About } from './sections/About';

const TABS = [
  { id: 'visao', label: 'Visão geral' },
  { id: 'gastos', label: 'Gastos' },
  { id: 'lancamentos', label: 'Lançamentos' },
  { id: 'patrimonio', label: 'Patrimônio' },
  { id: 'descobertas', label: 'Descobertas' },
  { id: 'dados', label: 'Sobre os dados' },
] as const;
type TabId = (typeof TABS)[number]['id'];
const FILTERED_TABS: TabId[] = ['visao', 'gastos', 'lancamentos'];

const readHash = (): TabId => {
  const h = window.location.hash.replace('#', '') as TabId;
  return TABS.some((t) => t.id === h) ? h : 'visao';
};

export default function App() {
  const [model, setModel] = useState<BudgetModel | null>(() => (loadRemember() ? loadModel() : null));
  const [filters, setFilters] = useState<Filters | null>(() => (model ? defaultFilters(model) : null));
  const [tab, setTabState] = useState<TabId>(readHash);
  const [txn, setTxn] = useState<Txn | null>(null);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState<Theme>(loadTheme);
  const [remember, setRememberState] = useState(loadRemember);
  const fileInput = useRef<HTMLInputElement>(null);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (theme === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
    saveTheme(theme);
  }, [theme]);

  useEffect(() => {
    const h = () => setTabState(readHash());
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);

  const setTab = (t: string) => {
    window.location.hash = t;
    setTabState(t as TabId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const useModel = useCallback(
    (m: BudgetModel) => {
      setModel(m);
      setFilters(defaultFilters(m));
      setError(undefined);
      if (remember) saveModel(m);
    },
    [remember],
  );

  const onFile = async (f: File) => {
    setBusy(true);
    setError(undefined);
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      useModel(parseBudget(bytes, f.name));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não consegui ler esta planilha.');
    } finally {
      setBusy(false);
    }
  };

  // Development only: load the local copy of the sheet automatically (never part of the build).
  useEffect(() => {
    if (!import.meta.env.DEV || model) return;
    fetch('/__local/sheet.ods')
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject()))
      .then((b) => useModel(parseBudget(new Uint8Array(b), 'ModeloRafael.ods')))
      .catch(() => undefined);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setRemember = (v: boolean) => {
    setRememberState(v);
    saveRemember(v);
    if (!v) clearModel();
    else if (model) saveModel(model);
  };

  const close = () => {
    clearModel();
    setModel(null);
    setFilters(null);
    setTxn(null);
  };

  const openDay = (date: string) => {
    if (!filters) return;
    setFilters({ ...filters, from: date, to: date });
    setTab('lancamentos');
  };

  if (!model || !filters) return <Welcome onFile={onFile} error={error} busy={busy} remember={remember} setRemember={setRemember} />;

  const { min, max } = monthRange(model);
  const month = monthName(min);
  const yearsTx = min.slice(0, 4);
  const asOfYear = model.investmentsAsOf.match(/\d{4}/)?.[0];
  const themeNext: Record<Theme, Theme> = { auto: 'light', light: 'dark', dark: 'auto' };
  const themeLabel = { auto: 'Tema automático', light: 'Tema claro', dark: 'Tema escuro' }[theme];

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand"><BrandMark /> Budget Dad</div>
          <div className="topbar-actions">
            <button className="icon-btn" onClick={() => setTheme(themeNext[theme])} aria-label={`${themeLabel}. Clique para trocar.`} title={themeLabel}>
              {theme === 'auto' ? Icon.auto : theme === 'light' ? Icon.sun : Icon.moon}
            </button>
            <button className="icon-btn" onClick={() => fileInput.current?.click()} title="Abrir outra planilha">
              {Icon.file}<span className="lbl">Abrir outra planilha</span>
            </button>
            <button className="icon-btn" onClick={close} title="Fechar a planilha e apagar a cópia guardada neste aparelho">
              {Icon.close}<span className="lbl">Fechar</span>
            </button>
            <input ref={fileInput} type="file" accept=".ods" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
          </div>
        </div>
      </header>

      <div className="shell">
        <div className="hero-head">
          <div style={{ flex: '1 1 320px' }}>
            <div className="eyebrow">Orçamento do mês</div>
            <h1>{month.charAt(0).toUpperCase() + month.slice(1)}</h1>
            <p>Lançamentos de {dateBR(min)} a {dateBR(max)}{model.investmentsAsOf ? ` · patrimônio de ${model.investmentsAsOf}` : ''}.</p>
          </div>
          <div className="chips">
            <span className="chip">{Icon.lock} Lido só neste aparelho</span>
            {asOfYear && asOfYear !== yearsTx && (
              <button className="chip warn" onClick={() => setTab('dados')} title="Ver os pontos de atenção">
                Datas do mês em {yearsTx}, patrimônio em {asOfYear}
              </button>
            )}
          </div>
        </div>
        {error && <div className="error" role="alert" style={{ marginBottom: 16 }}>{error}</div>}

        <nav className="tabs" role="tablist" aria-label="Seções">
          {TABS.map((t) => (
            <button key={t.id} role="tab" className="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </nav>

        {FILTERED_TABS.includes(tab) && <FilterBar model={model} f={filters} setF={setFilters} />}

        <main>
          {tab === 'visao' && <Overview model={model} f={filters} setF={setFilters} go={setTab} openTxn={setTxn} />}
          {tab === 'gastos' && <Spending model={model} f={filters} setF={setFilters} openTxn={setTxn} openDay={openDay} />}
          {tab === 'lancamentos' && <Transactions model={model} f={filters} openTxn={setTxn} />}
          {tab === 'patrimonio' && <Wealth model={model} today={today} />}
          {tab === 'descobertas' && <Insights model={model} today={today} />}
          {tab === 'dados' && <About model={model} />}
        </main>

        <footer className="footer">
          <span>Budget Dad · os números vêm de “{model.fileName}”, lido neste navegador. Nada é enviado para a internet.</span>
          <label className="toggle" style={{ fontSize: 13 }}>
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Lembrar a planilha neste aparelho
          </label>
        </footer>
      </div>
      {txn && <TxnDrawer t={txn} onClose={() => setTxn(null)} />}
    </>
  );
}
