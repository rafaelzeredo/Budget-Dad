import { useMemo, useState, type ReactNode } from 'react';
import { scaleLinear, scaleBand, scaleTime } from 'd3-scale';
import { line, curveStepAfter, area } from 'd3-shape';
import { max as d3max, min as d3min } from 'd3-array';
import { Tooltip, TipRow, useWidth, type TipState } from './ui';
import { brl, brl0, brlAxis, dateBR, dayMonth, weekdayShort, pct } from '../lib/format';
import { CAT, CATEGORIES } from '../lib/categories';
import type { CategoryId, Txn } from '../lib/types';
import type { DayRow } from '../lib/metrics';

/* ------------------------------------------------------------------------- */
/* Waterfall (horizontal): how the month was built, line by line             */
/* ------------------------------------------------------------------------- */
export interface WaterStep {
  key: string;
  label: string;
  short?: string;
  value: number; // signed
  color: string;
  total?: boolean; // drawn from zero
  detail?: ReactNode;
}

export function Waterfall({ steps, onPick }: { steps: WaterStep[]; onPick?: (key: string) => void }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<TipState | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const narrow = w < 520;
  const labelW = narrow ? 96 : 168;
  const valueW = narrow ? 78 : 104;
  const rowH = narrow ? 34 : 36;
  const bar = 18;
  const rows = useMemo(() => {
    let run = 0;
    return steps.map((s) => {
      const start = s.total ? 0 : run;
      const end = s.total ? s.value : run + s.value;
      if (!s.total) run = end;
      return { ...s, start, end };
    });
  }, [steps]);
  const lo = Math.min(0, d3min(rows, (r) => Math.min(r.start, r.end)) ?? 0);
  const hi = Math.max(0, d3max(rows, (r) => Math.max(r.start, r.end)) ?? 0);
  const x = scaleLinear().domain([lo, hi]).nice(4).range([labelW, Math.max(labelW + 40, w - valueW)]);
  const h = rows.length * rowH + 28;
  const ticks = [...new Set(narrow ? [0, x.domain()[1]] : x.ticks(5))];
  return (
    <div className="chart" ref={ref} onMouseLeave={() => { setTip(null); setHover(null); }}>
      {w > 0 && (
        <svg width={w} height={h} role="img" aria-label="Cascata do mês: receitas somam e cada grupo de saídas subtrai até o resultado">
          {ticks.map((t) => (
            <g key={t}>
              <line className={t === 0 ? 'base-line' : 'grid-line'} x1={x(t)} x2={x(t)} y1={0} y2={rows.length * rowH} />
              <text x={x(t)} y={rows.length * rowH + 18} textAnchor={narrow && t === x.domain()[0] && t !== 0 ? 'start' : narrow && t === x.domain()[1] ? 'end' : 'middle'}>{brlAxis(t)}</text>
            </g>
          ))}
          {rows.map((r, i) => {
            const y = i * rowH + (rowH - bar) / 2;
            const x0 = x(Math.min(r.start, r.end)), x1 = x(Math.max(r.start, r.end));
            const dim = hover && hover !== r.key;
            const next = rows[i + 1];
            return (
              <g key={r.key} className={dim ? 'dim' : ''} style={{ transition: 'opacity .2s' }}>
                <text className={r.total ? 'lbl-strong' : 'lbl-2'} x={0} y={y + bar / 2 + 4.5}>
                  {(() => { const l = narrow && r.short ? r.short : r.label; const n = narrow ? 13 : 24; return l.length > n ? l.slice(0, n - 1) + '…' : l; })()}
                </text>
                <rect className="mark" x={x0} y={y} width={Math.max(2, x1 - x0)} height={bar} rx={4} fill={r.color} />
                <text className={r.total ? 'lbl-strong' : 'lbl-2'} x={w} y={y + bar / 2 + 4.5} textAnchor="end">
                  {(r.value > 0 && !r.total ? '+' : '') + brl0(r.value)}
                </text>
                {next && !next.total && (
                  <line x1={x(r.end)} x2={x(r.end)} y1={y + bar} y2={y + rowH} stroke="var(--axis)" strokeWidth={1} strokeDasharray="0" />
                )}
                <rect
                  className="hit"
                  x={0}
                  y={i * rowH}
                  width={w}
                  height={rowH}
                  onMouseMove={(e) => {
                    setHover(r.key);
                    const b = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                    setTip({
                      x: e.clientX - b.left,
                      y: e.clientY - b.top,
                      content: (
                        <>
                          <div className="tt-title">{r.label}</div>
                          <TipRow color={r.color} label={r.total ? 'Resultado' : r.value > 0 ? 'Entrou' : 'Saiu'} value={brl(Math.abs(r.value))} />
                          {!r.total && <TipRow label="Acumulado" value={brl(r.end)} />}
                          {r.detail && <div className="tt-foot">{r.detail}</div>}
                        </>
                      ),
                    });
                  }}
                  onClick={() => onPick?.(r.key)}
                />
              </g>
            );
          })}
        </svg>
      )}
      <Tooltip tip={tip} width={w} />
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Cumulative in vs out over the days of the month                           */
/* ------------------------------------------------------------------------- */
export function CumulativeChart({ data, events }: { data: { date: string; income: number; out: number; net: number }[]; events?: { date: string; label: string }[] }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hi, setHi] = useState<number | null>(null);
  const narrow = w < 520;
  const m = { l: narrow ? 52 : 64, r: 12, t: 16, b: 28 };
  const h = narrow ? 240 : 290;
  if (!data.length) return <div className="empty">Sem lançamentos no período escolhido.</div>;
  const dates = data.map((d) => new Date(d.date + 'T12:00:00'));
  const x = scaleTime().domain([dates[0], dates[dates.length - 1]]).range([m.l, Math.max(m.l + 10, w - m.r)]);
  const top = d3max(data, (d) => Math.max(d.income, d.out)) ?? 1;
  const y = scaleLinear().domain([0, top || 1]).nice(4).range([h - m.b, m.t]);
  const ln = (k: 'income' | 'out') => line<(typeof data)[0]>().x((_, i) => x(dates[i])).y((d) => y(d[k])).curve(curveStepAfter)(data) ?? '';
  const ar = (k: 'income' | 'out') => area<(typeof data)[0]>().x((_, i) => x(dates[i])).y0(y(0)).y1((d) => y(d[k])).curve(curveStepAfter)(data) ?? '';
  const xTicks = data.filter((_, i) => i % (narrow ? 7 : 4) === 0 || i === data.length - 1);
  const p = hi != null ? data[hi] : null;
  const tip: TipState | null = p
    ? {
        x: x(dates[hi!]),
        y: y(Math.max(p.income, p.out)),
        content: (
          <>
            <div className="tt-title">Até {weekdayShort(p.date)}, {dateBR(p.date)}</div>
            <TipRow color="var(--series-in)" label="Entrou" value={brl(p.income)} square={false} />
            <TipRow color="var(--series-out)" label="Saiu" value={brl(p.out)} square={false} />
            <div className="tt-foot">Resultado até este dia: <b style={{ color: p.net < 0 ? 'var(--bad-ink)' : 'var(--good-ink)' }}>{brl(p.net)}</b></div>
          </>
        ),
      }
    : null;
  return (
    <div className="chart" ref={ref}>
      <div className="legend">
        <span><i style={{ background: 'var(--series-in)' }} /> Entradas acumuladas</span>
        <span><i style={{ background: 'var(--series-out)' }} /> Saídas acumuladas</span>
      </div>
      {w > 0 && (
        <svg
          width={w}
          height={h}
          role="img"
          aria-label="Entradas e saídas acumuladas ao longo do mês"
          onMouseMove={(e) => {
            const b = e.currentTarget.getBoundingClientRect();
            const px = e.clientX - b.left;
            let best = 0, bd = Infinity;
            dates.forEach((d, i) => { const dd = Math.abs(x(d) - px); if (dd < bd) { bd = dd; best = i; } });
            setHi(best);
          }}
          onMouseLeave={() => setHi(null)}
          onTouchStart={(e) => {
            const b = e.currentTarget.getBoundingClientRect();
            const px = e.touches[0].clientX - b.left;
            let best = 0, bd = Infinity;
            dates.forEach((d, i) => { const dd = Math.abs(x(d) - px); if (dd < bd) { bd = dd; best = i; } });
            setHi(best);
          }}
        >
          {y.ticks(4).map((t) => (
            <g key={t}>
              <line className={t === 0 ? 'base-line' : 'grid-line'} x1={m.l} x2={w - m.r} y1={y(t)} y2={y(t)} />
              <text x={m.l - 8} y={y(t) + 4} textAnchor="end">{brlAxis(t)}</text>
            </g>
          ))}
          {xTicks.map((d) => (
            <text key={d.date} x={x(new Date(d.date + 'T12:00:00'))} y={h - 8} textAnchor="middle">{dayMonth(d.date)}</text>
          ))}
          {events?.map((ev) => {
            const i = data.findIndex((d) => d.date === ev.date);
            if (i < 0) return null;
            const ex = x(dates[i]);
            return (
              <g key={ev.date + ev.label}>
                <line x1={ex} x2={ex} y1={m.t} y2={h - m.b} stroke="var(--axis)" strokeWidth={1} />
                <text x={ex + (ex > w * 0.7 ? -6 : 6)} y={m.t + 10} textAnchor={ex > w * 0.7 ? 'end' : 'start'} className="lbl-2" style={{ fontSize: 12 }}>{ev.label}</text>
              </g>
            );
          })}
          <path d={ar('income')} fill="var(--series-in)" opacity={0.1} />
          <path d={ar('out')} fill="var(--series-out)" opacity={0.1} />
          <path d={ln('income')} fill="none" stroke="var(--series-in)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          <path d={ln('out')} fill="none" stroke="var(--series-out)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {/* end labels */}
          {!narrow && (() => {
            const last = data[data.length - 1];
            const ex = x(dates[dates.length - 1]);
            const yi = y(last.income), yo = y(last.out);
            const close = Math.abs(yi - yo) < 16;
            return (
              <>
                <circle cx={ex} cy={yi} r={4} fill="var(--series-in)" stroke="var(--surface)" strokeWidth={2} />
                <circle cx={ex} cy={yo} r={4} fill="var(--series-out)" stroke="var(--surface)" strokeWidth={2} />
                <text className="lbl-strong" x={ex - 8} y={yi + (close && yi < yo ? -8 : -8)} textAnchor="end">{brl0(last.income)}</text>
                <text className="lbl-strong" x={ex - 8} y={yo + (close ? 18 : -8)} textAnchor="end">{brl0(last.out)}</text>
              </>
            );
          })()}
          {p && (
            <g pointerEvents="none">
              <line x1={x(dates[hi!])} x2={x(dates[hi!])} y1={m.t} y2={h - m.b} stroke="var(--ink-3)" strokeWidth={1} />
              <circle cx={x(dates[hi!])} cy={y(p.income)} r={5} fill="var(--series-in)" stroke="var(--surface)" strokeWidth={2} />
              <circle cx={x(dates[hi!])} cy={y(p.out)} r={5} fill="var(--series-out)" stroke="var(--surface)" strokeWidth={2} />
            </g>
          )}
        </svg>
      )}
      <Tooltip tip={tip} width={w} />
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Daily columns, stacked by category                                         */
/* ------------------------------------------------------------------------- */
export function DailyColumns({ days, onPickDay, selectedCats }: { days: DayRow[]; onPickDay?: (d: DayRow) => void; selectedCats: CategoryId[] }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<TipState | null>(null);
  const [hd, setHd] = useState<string | null>(null);
  const narrow = w < 520;
  const m = { l: narrow ? 50 : 62, r: 6, t: 12, b: 28 };
  const h = narrow ? 220 : 260;
  const x = scaleBand<string>().domain(days.map((d) => d.date)).range([m.l, Math.max(m.l + 10, w - m.r)]).paddingInner(0.28).paddingOuter(0.1);
  const top = d3max(days, (d) => d.out) ?? 0;
  const y = scaleLinear().domain([0, top || 1]).nice(4).range([h - m.b, m.t]);
  const bw = Math.min(24, x.bandwidth());
  const order = CATEGORIES.filter((c) => c.kind !== 'receita').map((c) => c.id);
  const usedCats = order.filter((id) => days.some((d) => (d.byCat[id] ?? 0) > 0));
  return (
    <div className="chart" ref={ref} onMouseLeave={() => { setTip(null); setHd(null); }}>
      <div className="legend">
        {usedCats.map((id) => (
          <span key={id}><i className="sq" style={{ background: CAT[id].color }} /> {CAT[id].short}</span>
        ))}
      </div>
      {w > 0 && (
        <svg width={w} height={h} role="img" aria-label="Saídas por dia, empilhadas por categoria">
          {y.ticks(4).map((t) => (
            <g key={t}>
              <line className={t === 0 ? 'base-line' : 'grid-line'} x1={m.l} x2={w - m.r} y1={y(t)} y2={y(t)} />
              <text x={m.l - 8} y={y(t) + 4} textAnchor="end">{brlAxis(t)}</text>
            </g>
          ))}
          {days.map((d, i) => {
            const cx = (x(d.date) ?? 0) + x.bandwidth() / 2;
            let acc = 0;
            const segs = order.filter((id) => (d.byCat[id] ?? 0) > 0);
            const showTick = i % (narrow ? 7 : 3) === 0 || i === days.length - 1;
            return (
              <g key={d.date} className={hd && hd !== d.date ? 'dim' : ''} style={{ transition: 'opacity .2s' }}>
                {segs.map((id, k) => {
                  const v = d.byCat[id]!;
                  const y0 = y(acc), y1 = y(acc + v);
                  acc += v;
                  const isTop = k === segs.length - 1;
                  const hgt = Math.max(1, y0 - y1 - (k > 0 ? 2 : 0));
                  return isTop ? (
                    <path key={id} className="mark" fill={CAT[id].color} d={roundTopRect(cx - bw / 2, y1, bw, hgt, Math.min(4, hgt))} />
                  ) : (
                    <rect key={id} className="mark" x={cx - bw / 2} y={y1} width={bw} height={hgt} fill={CAT[id].color} />
                  );
                })}
                {d.out === 0 && <line x1={cx - bw / 2} x2={cx + bw / 2} y1={y(0) - 0.5} y2={y(0) - 0.5} stroke="var(--hair)" strokeWidth={2} />}
                {showTick && <text x={cx} y={h - 8} textAnchor="middle">{dayMonth(d.date)}</text>}
                <rect
                  className="hit"
                  x={x(d.date)! - (x.step() - x.bandwidth()) / 2}
                  y={m.t}
                  width={x.step()}
                  height={h - m.t - m.b}
                  onMouseMove={(e) => {
                    setHd(d.date);
                    const b = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                    const outs = d.txns.filter((t) => t.kind !== 'receita');
                    setTip({
                      x: e.clientX - b.left,
                      y: y(d.out),
                      content: (
                        <>
                          <div className="tt-title">{weekdayShort(d.date)}, {dateBR(d.date)}</div>
                          {outs.length === 0 && <div className="muted">Nenhuma saída neste dia.</div>}
                          {outs.slice(0, 6).map((t) => (
                            <TipRow key={t.id} color={CAT[t.category].color} label={t.description.length > 26 ? t.description.slice(0, 25) + '…' : t.description} value={brl(t.amount)} />
                          ))}
                          {outs.length > 6 && <div className="tt-foot">+ {outs.length - 6} lançamentos</div>}
                          {outs.length > 1 && <div className="tt-foot">Total do dia: <b>{brl(d.out)}</b></div>}
                          {d.income > 0 && <div className="tt-foot">Entrou neste dia: {brl(d.income)}</div>}
                          {onPickDay && outs.length > 0 && <div className="tt-foot">Clique para ver os lançamentos</div>}
                        </>
                      ),
                    });
                  }}
                  onClick={() => onPickDay?.(d)}
                />
              </g>
            );
          })}
        </svg>
      )}
      {selectedCats.length > 0 && <div className="tt-foot muted" style={{ fontSize: 13 }}>Mostrando só: {selectedCats.map((c) => CAT[c].short).join(', ')}</div>}
      <Tooltip tip={tip} width={w} />
    </div>
  );
}

function roundTopRect(x: number, y: number, w: number, h: number, r: number) {
  r = Math.max(0, Math.min(r, w / 2, h));
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/* ------------------------------------------------------------------------- */
/* Horizontal bar rows (HTML) — categories, buckets, institutions              */
/* ------------------------------------------------------------------------- */
export interface BarRow {
  key: string;
  label: string;
  value: number;
  color: string;
  right?: ReactNode;
  sub?: ReactNode;
}

export function BarRows({ rows, selected, onToggle, maxValue, ariaLabel }: { rows: BarRow[]; selected?: string[]; onToggle?: (key: string) => void; maxValue?: number; ariaLabel: string }) {
  const mx = maxValue ?? Math.max(...rows.map((r) => Math.abs(r.value)), 1);
  const anySel = selected && selected.length > 0;
  return (
    <div className="rows" role="list" aria-label={ariaLabel}>
      {rows.map((r) => {
        const on = selected?.includes(r.key);
        const Comp = onToggle ? 'button' : 'div';
        return (
          <Comp
            key={r.key}
            role={onToggle ? undefined : 'listitem'}
            type={onToggle ? 'button' : undefined}
            className={`row-btn ${anySel && !on ? 'dim' : ''}`}
            aria-pressed={onToggle ? !!on : undefined}
            onClick={onToggle ? () => onToggle(r.key) : undefined}
            style={onToggle ? undefined : { cursor: 'default' }}
            title={onToggle ? (on ? 'Clique para tirar o filtro' : 'Clique para filtrar por este grupo') : undefined}
          >
            <span className="row-name">
              <span className="dot" style={{ background: r.color }} />
              <span>{r.label}</span>
            </span>
            <span className="row-track">
              <span className="row-bar" style={{ width: `${(Math.abs(r.value) / mx) * 100}%`, background: r.color }} />
            </span>
            <span className="row-val">
              {r.right ?? brl(r.value)}
              {r.sub && <small>{r.sub}</small>}
            </span>
          </Comp>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Dumbbell: what was paid vs what it is worth today                          */
/* ------------------------------------------------------------------------- */
export function Dumbbell({ rows }: { rows: { name: string; a: number; b: number; aLabel: string; bLabel: string }[] }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<TipState | null>(null);
  const narrow = w < 520;
  const labelW = narrow ? 0 : 170;
  const rowH = narrow ? 52 : 38;
  const h = rows.length * rowH + 26;
  const mx = d3max(rows, (r) => Math.max(r.a, r.b)) ?? 1;
  const x = scaleLinear().domain([0, mx]).nice(4).range([labelW + 6, Math.max(labelW + 50, w - 16)]);
  return (
    <div className="chart" ref={ref} onMouseLeave={() => setTip(null)}>
      <div className="legend">
        <span><i className="sq" style={{ background: 'var(--surface)', boxShadow: 'inset 0 0 0 2px var(--ink-3)', borderRadius: 99 }} /> {rows[0]?.aLabel ?? 'Antes'}</span>
        <span><i className="sq" style={{ background: 'var(--w-assets)', borderRadius: 99 }} /> {rows[0]?.bLabel ?? 'Hoje'}</span>
      </div>
      {w > 0 && (
        <svg width={w} height={h} role="img" aria-label="Valor pago e valor atual de cada bem">
          {x.ticks(narrow ? 3 : 5).map((t) => (
            <g key={t}>
              <line className={t === 0 ? 'base-line' : 'grid-line'} x1={x(t)} x2={x(t)} y1={0} y2={rows.length * rowH} />
              <text x={x(t)} y={rows.length * rowH + 18} textAnchor="middle">{brlAxis(t)}</text>
            </g>
          ))}
          {rows.map((r, i) => {
            const cy = i * rowH + (narrow ? 34 : rowH / 2);
            return (
              <g key={r.name}>
                <text className="lbl-2" x={narrow ? 0 : 0} y={narrow ? i * rowH + 14 : cy + 4.5}>{r.name}</text>
                {r.a > 0 && <line x1={x(Math.min(r.a, r.b))} x2={x(Math.max(r.a, r.b))} y1={cy} y2={cy} stroke="var(--w-assets)" strokeWidth={2} opacity={0.5} />}
                {r.a > 0 && <circle cx={x(r.a)} cy={cy} r={5} fill="var(--surface)" stroke="var(--ink-3)" strokeWidth={2} />}
                <circle cx={x(r.b)} cy={cy} r={6} fill="var(--w-assets)" stroke="var(--surface)" strokeWidth={2} />
                <rect
                  className="hit"
                  x={0}
                  y={i * rowH}
                  width={w}
                  height={rowH}
                  onMouseMove={(e) => {
                    const b = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                    setTip({
                      x: e.clientX - b.left,
                      y: cy,
                      content: (
                        <>
                          <div className="tt-title">{r.name}</div>
                          <TipRow label={r.aLabel} value={brl(r.a)} />
                          <TipRow color="var(--w-assets)" label={r.bLabel} value={brl(r.b)} square={false} />
                          {r.a > 0 && <div className="tt-foot">Diferença: {brl(r.b - r.a)} ({pct(r.b / r.a - 1)})</div>}
                          {r.a === 0 && <div className="tt-foot">A planilha não informa o valor pago.</div>}
                        </>
                      ),
                    });
                  }}
                />
              </g>
            );
          })}
        </svg>
      )}
      <Tooltip tip={tip} width={w} />
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Maturity timeline                                                          */
/* ------------------------------------------------------------------------- */
export function MaturityTimeline({ items, today }: { items: { name: string; date: string; value: number }[]; today: string }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<TipState | null>(null);
  if (!items.length) return null;
  const narrow = w < 520;
  const dates = items.map((i) => new Date(i.date + 'T12:00:00'));
  const t0 = new Date(Math.min(new Date(today + 'T12:00:00').getTime(), ...dates.map((d) => d.getTime())));
  const t1 = new Date(Math.max(...dates.map((d) => d.getTime())));
  const x = scaleTime().domain([t0, t1]).nice().range([14, Math.max(30, w - 14)]);
  const r = scaleLinear().domain([0, d3max(items, (i) => i.value) ?? 1]).range([5, narrow ? 13 : 18]);
  const h = 86;
  const ty = new Date(today + 'T12:00:00');
  const years = x.ticks(narrow ? 3 : 6);
  return (
    <div className="chart" ref={ref} onMouseLeave={() => setTip(null)}>
      {w > 0 && (
        <svg width={w} height={h} role="img" aria-label="Linha do tempo dos vencimentos das aplicações">
          <line className="base-line" x1={14} x2={w - 14} y1={44} y2={44} />
          {years.map((t) => (
            <g key={+t}>
              <line x1={x(t)} x2={x(t)} y1={40} y2={48} stroke="var(--axis)" />
              <text x={x(t)} y={70} textAnchor="middle">{t.getMonth() === 0 ? t.getFullYear() : `${String(t.getMonth() + 1).padStart(2, '0')}/${String(t.getFullYear()).slice(2)}`}</text>
            </g>
          ))}
          <g>
            <line x1={x(ty)} x2={x(ty)} y1={14} y2={50} stroke="var(--accent)" strokeWidth={2} />
            <text x={x(ty)} y={10} textAnchor="middle" style={{ fill: 'var(--accent)', fontWeight: 650 }}>hoje</text>
          </g>
          {items.map((it, i) => (
            <circle
              key={it.name}
              cx={x(dates[i])}
              cy={44}
              r={r(it.value)}
              fill="var(--w-inv)"
              fillOpacity={0.8}
              stroke="var(--surface)"
              strokeWidth={2}
              style={{ cursor: 'pointer' }}
              onMouseMove={(e) => {
                const b = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                setTip({ x: e.clientX - b.left, y: 30, content: (<><div className="tt-title">{it.name}</div><TipRow label="Vence em" value={dateBR(it.date)} /><TipRow color="var(--w-inv)" label="Valor atual" value={brl(it.value)} square={false} /></>) });
              }}
            />
          ))}
        </svg>
      )}
      <Tooltip tip={tip} width={w} />
    </div>
  );
}

export function txnSort(a: Txn, b: Txn) {
  return (a.date ?? '').localeCompare(b.date ?? '') || a.cell.localeCompare(b.cell);
}
