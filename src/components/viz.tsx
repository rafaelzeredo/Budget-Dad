import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { arc, pie, type PieArcDatum } from 'd3-shape';
import { Tooltip, TipRow, useWidth, type TipState } from './ui';
import { brl, brl0, brlAxis, dateBR, pct, weekday } from '../lib/format';
import { CAT } from '../lib/categories';
import type { DayRow } from '../lib/metrics';

/* ------------------------------------------------------------------------- */
/* Donut: share of each spending group. Click a slice to filter.             */
/* ------------------------------------------------------------------------- */
export interface Slice {
  key: string;
  label: string;
  value: number;
  color: string;
}

export function Donut({ slices, selected, onToggle, centerTitle, centerSub }: { slices: Slice[]; selected: string[]; onToggle: (k: string) => void; centerTitle: string; centerSub?: string }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<string | null>(null);
  const size = Math.max(180, Math.min(w, 320));
  const R = size / 2;
  const total = slices.reduce((a, s) => a + s.value, 0);
  const arcs = useMemo(() => pie<Slice>().value((d) => d.value).sort(null).padAngle(2.2 / R)(slices), [slices, R]);
  const base = arc<PieArcDatum<Slice>>().innerRadius(R * 0.64).outerRadius(R - 8).cornerRadius(4);
  const pop = arc<PieArcDatum<Slice>>().innerRadius(R * 0.64).outerRadius(R - 1).cornerRadius(4);
  const anySel = selected.length > 0;
  const focusKey = hover ?? (selected.length === 1 ? selected[0] : null);
  const focus = slices.find((s) => s.key === focusKey);
  const selTotal = slices.filter((s) => selected.includes(s.key)).reduce((a, s) => a + s.value, 0);
  return (
    <div className="donut" ref={ref}>
      {w > 0 && (
        <div className="donut-box" style={{ width: size, height: size }}>
          <svg width={size} height={size} viewBox={`${-R} ${-R} ${size} ${size}`} role="img" aria-label={`Divisão das saídas: ${slices.map((s) => `${s.label} ${pct(s.value / total)}`).join(', ')}`}>
            {arcs.map((a) => {
              const on = selected.includes(a.data.key);
              const dim = (anySel && !on && hover !== a.data.key) || (hover && hover !== a.data.key && !on);
              return (
                <path
                  key={a.data.key}
                  d={(on || hover === a.data.key ? pop(a) : base(a)) ?? ''}
                  fill={a.data.color}
                  className="slice"
                  opacity={dim ? 0.28 : 1}
                  tabIndex={0}
                  role="button"
                  aria-pressed={on}
                  aria-label={`${a.data.label}: ${brl(a.data.value)}, ${pct(a.data.value / total)}`}
                  onMouseEnter={() => setHover(a.data.key)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(a.data.key)}
                  onBlur={() => setHover(null)}
                  onClick={() => onToggle(a.data.key)}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onToggle(a.data.key))}
                />
              );
            })}
          </svg>
          <div className="donut-center" aria-live="polite">
            {focus ? (
              <>
                <span className="dc-label"><i style={{ background: focus.color }} />{focus.label}</span>
                <span className="dc-value num">{brl(focus.value)}</span>
                <span className="dc-sub">{pct(focus.value / total)} das saídas</span>
              </>
            ) : anySel ? (
              <>
                <span className="dc-label">{selected.length} grupos escolhidos</span>
                <span className="dc-value num">{brl(selTotal)}</span>
                <span className="dc-sub">{pct(selTotal / total)} das saídas</span>
              </>
            ) : (
              <>
                <span className="dc-label">{centerTitle}</span>
                <span className="dc-value num">{brl(total)}</span>
                {centerSub && <span className="dc-sub">{centerSub}</span>}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Income vs. spending: two bars on one scale                                 */
/* ------------------------------------------------------------------------- */
export interface Seg {
  key: string;
  label: string;
  value: number;
  color: string;
  pickable?: boolean;
}

export function FlowCompare({ income, out, selected, onPick }: { income: Seg[]; out: Seg[]; selected: string[]; onPick: (k: string) => void }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<TipState | null>(null);
  const tin = income.reduce((a, s) => a + Math.round(s.value * 100), 0) / 100;
  const tout = out.reduce((a, s) => a + Math.round(s.value * 100), 0) / 100;
  const mx = Math.max(tin, tout, 1);
  const gap = Math.round((tin - tout) * 100) / 100;
  const rows: { id: string; title: string; total: number; segs: (Seg & { hatch?: boolean })[] }[] = [
    { id: 'in', title: 'Entrou', total: tin, segs: [...income, ...(gap < 0 ? [{ key: 'reserva', label: 'Faltou: saiu da reserva', value: -gap, color: 'transparent', hatch: true }] : [])] },
    { id: 'out', title: 'Saiu', total: tout, segs: [...out, ...(gap > 0 ? [{ key: 'sobra', label: 'Sobrou', value: gap, color: 'transparent', hatch: true }] : [])] },
  ];
  const anySel = selected.length > 0;
  const move = (e: React.MouseEvent, s: Seg & { hatch?: boolean }, rowTotal: number) => {
    const b = ref.current!.getBoundingClientRect();
    setTip({
      x: e.clientX - b.left,
      y: e.clientY - b.top - 6,
      content: (
        <>
          <div className="tt-title">{s.label}</div>
          <TipRow color={s.hatch ? undefined : s.color} label="Valor" value={brl(s.value)} />
          {!s.hatch && <TipRow label={rowTotal === tin ? 'das entradas' : 'das saídas'} value={pct(s.value / rowTotal)} />}
          {s.hatch && s.key === 'reserva' && <div className="tt-foot">Saiu mais do que entrou: a diferença foi coberta pelo saldo guardado.</div>}
          {s.hatch && s.key === 'sobra' && <div className="tt-foot">Entrou mais do que saiu no filtro escolhido.</div>}
          {s.pickable && <div className="tt-foot">Clique para filtrar por este grupo</div>}
        </>
      ),
    });
  };
  return (
    <div className="flow" ref={ref} onMouseLeave={() => setTip(null)}>
      {rows.map((r) => (
        <div className="flow-row" key={r.id}>
          <div className="flow-head">
            <span className="flow-title">{r.title}</span>
            <span className={`flow-total num ${r.id === 'in' ? 'in' : ''}`}>{brl(r.total)}</span>
          </div>
          <div className="flow-track" role="img" aria-label={`${r.title}: ${r.segs.map((s) => `${s.label} ${brl(s.value)}`).join(', ')}`}>
            {r.segs.filter((s) => s.value > 0).map((s) => {
              const dim = anySel && s.pickable && !selected.includes(s.key);
              return (
                <div
                  key={s.key}
                  className={`flow-seg ${s.hatch ? 'hatch' : ''} ${s.pickable ? 'pick' : ''}`}
                  style={{ width: `${(s.value / mx) * 100}%`, background: s.hatch ? undefined : s.color, opacity: dim ? 0.28 : 1 }}
                  onMouseMove={(e) => move(e, s, r.total)}
                  onClick={s.pickable ? () => onPick(s.key) : undefined}
                />
              );
            })}
          </div>
          <div className="flow-legend">
            {r.segs.filter((s) => s.value > 0).map((s) => {
              const Comp = s.pickable ? 'button' : 'span';
              return (
                <Comp key={s.key} type={s.pickable ? 'button' : undefined} className={`fl-item ${anySel && s.pickable && !selected.includes(s.key) ? 'dim' : ''}`} aria-pressed={s.pickable ? selected.includes(s.key) : undefined} onClick={s.pickable ? () => onPick(s.key) : undefined}>
                  <i className={s.hatch ? 'hatch' : ''} style={{ background: s.hatch ? undefined : s.color }} />
                  {s.label} <b className="num">{w < 520 ? brl0(s.value) : brl(s.value)}</b>
                </Comp>
              );
            })}
          </div>
        </div>
      ))}
      <Tooltip tip={tip} width={w} />
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Month calendar: how much went out each day (one hue, light -> dark)        */
/* ------------------------------------------------------------------------- */
export const HEAT_STEPS = [
  { max: 100, label: 'até R$ 100', mix: 18 },
  { max: 500, label: 'R$ 100 a 500', mix: 36 },
  { max: 1000, label: 'R$ 500 a 1 mil', mix: 56 },
  { max: 3000, label: 'R$ 1 a 3 mil', mix: 78 },
  { max: Infinity, label: 'mais de R$ 3 mil', mix: 100 },
];
const heatStep = (v: number) => HEAT_STEPS.findIndex((s) => v <= s.max);
const WD = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

export function CalendarHeat({ days, inRange, selected, onPick }: { days: DayRow[]; inRange: (d: string) => boolean; selected: string | null; onPick: (d: string) => void }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<TipState | null>(null);
  if (!days.length) return null;
  const lead = new Date(days[0].date + 'T12:00:00').getDay();
  const compact = w < 420;
  return (
    <div className="cal" ref={ref} onMouseLeave={() => setTip(null)}>
      <div className="cal-grid" role="grid" aria-label="Calendário de saídas do mês">
        {WD.map((d) => <div key={d} className="cal-wd" role="columnheader">{d}</div>)}
        {Array.from({ length: lead }, (_, i) => <div key={'e' + i} />)}
        {days.map((d) => {
          const st = d.out > 0 ? heatStep(d.out) : -1;
          const on = selected === d.date;
          const strong = st >= 3;
          const outs = d.txns.filter((t) => t.kind !== 'receita');
          return (
            <button
              key={d.date}
              type="button"
              className={`cal-day ${st < 0 ? 'none' : ''} ${on ? 'on' : ''} ${inRange(d.date) ? '' : 'out'} ${strong ? 'strong' : ''}`}
              style={st >= 0 ? { background: `color-mix(in srgb, var(--seq) ${HEAT_STEPS[st].mix}%, var(--surface))` } : undefined}
              aria-pressed={on}
              aria-label={`${dateBR(d.date)}, ${weekday(d.date)}: ${d.out > 0 ? `saiu ${brl(d.out)}` : 'nenhuma saída'}${d.income > 0 ? `; entrou ${brl(d.income)}` : ''}`}
              onClick={() => onPick(d.date)}
              onMouseMove={(e) => {
                const b = ref.current!.getBoundingClientRect();
                setTip({
                  x: e.clientX - b.left,
                  y: e.clientY - b.top - 8,
                  content: (
                    <>
                      <div className="tt-title">{weekday(d.date)}, {dateBR(d.date)}</div>
                      {outs.length === 0 && <div className="muted">Nenhuma saída neste dia.</div>}
                      {outs.slice(0, 6).map((t) => <TipRow key={t.id} color={CAT[t.category].color} label={t.description.length > 24 ? t.description.slice(0, 23) + '…' : t.description} value={brl(t.amount)} />)}
                      {outs.length > 6 && <div className="tt-foot">+ {outs.length - 6} lançamentos</div>}
                      {outs.length > 1 && <div className="tt-foot">Total do dia: <b>{brl(d.out)}</b></div>}
                      {d.income > 0 && <div className="tt-foot">Entrou: <b style={{ color: 'var(--good-ink)' }}>{brl(d.income)}</b></div>}
                      <div className="tt-foot">{on ? 'Clique para voltar ao mês todo' : 'Clique para ver só este dia'}</div>
                    </>
                  ),
                });
              }}
            >
              <span className="cd-n">{+d.date.slice(8)}</span>
              {d.income > 0 && <span className="cd-in" aria-hidden="true" />}
              {!compact && d.out > 0 && <span className="cd-v num">{brlAxis(d.out).replace('R$ ', '')}</span>}
            </button>
          );
        })}
      </div>
      <div className="cal-legend">
        <span className="muted">Saiu no dia:</span>
        {HEAT_STEPS.map((s) => (
          <span key={s.label}><i style={{ background: `color-mix(in srgb, var(--seq) ${s.mix}%, var(--surface))` }} />{s.label}</span>
        ))}
        <span><i className="dot-in" /> dia com entrada</span>
      </div>
      <Tooltip tip={tip} width={w} />
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Small helpers                                                              */
/* ------------------------------------------------------------------------- */
/** Animates a number from 0 to its value once, unless the user prefers less motion. */
export function useCountUp(value: number, ms = 900): number {
  const reduce = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const [v, setV] = useState(reduce ? value : 0);
  const first = useRef(true);
  useEffect(() => {
    if (reduce || !first.current) { setV(value); return; }
    first.current = false;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      setV(Math.round(value * e * 100) / 100);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // rAF does not run in background tabs: make sure the real value is always shown.
    const done = setTimeout(() => setV(value), ms + 150);
    return () => { cancelAnimationFrame(raf); clearTimeout(done); };
  }, [value, ms]);
  return v;
}

/** Adds the "in" class when the element scrolls into view (subtle entrance). */
export function Reveal({ children, className = '', as: Tag = 'div', id }: { children: ReactNode; className?: string; as?: 'div' | 'section'; id?: string }) {
  const ref = useRef<HTMLElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setSeen(true); return; }
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && (setSeen(true), io.disconnect()), { rootMargin: '0px 0px 15% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag ref={ref as never} id={id} className={`reveal ${seen ? 'in' : ''} ${className}`}>
      {children}
    </Tag>
  );
}
