const brlFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const brl0Fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const numFmt = new Intl.NumberFormat('pt-BR');
const pctFmt = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1, minimumFractionDigits: 1 });

/** R$ 1.234,56 (exact, two decimals). */
export const brl = (x: number) => brlFmt.format(x).replace(/ /g, ' ');
/** R$ 1.235 (rounded, for labels on charts). */
export const brl0 = (x: number) => brl0Fmt.format(x).replace(/ /g, ' ');
/** Compact axis label: R$ 5 mil, R$ 1,6 mi. */
export function brlAxis(x: number): string {
  const a = Math.abs(x);
  const sign = x < 0 ? '−' : '';
  if (a >= 1_000_000) return `${sign}R$ ${numFmt.format(+(a / 1_000_000).toFixed(1))} mi`;
  if (a >= 10_000) return `${sign}R$ ${numFmt.format(Math.round(a / 1000))} mil`;
  return `${sign}R$ ${numFmt.format(Math.round(a))}`;
}
export const pct = (x: number) => pctFmt.format(x);
export const int = (x: number) => numFmt.format(x);

/** ISO YYYY-MM-DD -> DD/MM/YYYY */
export const dateBR = (iso: string | null | undefined) => (iso ? iso.split('-').reverse().join('/') : '—');
/** ISO -> DD/MM */
export const dayMonth = (iso: string) => iso.slice(8, 10) + '/' + iso.slice(5, 7);

const WEEKDAYS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const WEEKDAYS_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
export const weekday = (iso: string) => WEEKDAYS[new Date(iso + 'T12:00:00').getDay()];
export const weekdayShort = (iso: string) => WEEKDAYS_SHORT[new Date(iso + 'T12:00:00').getDay()];
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const monthName = (iso: string) => MONTHS[+iso.slice(5, 7) - 1];

export function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000);
}
