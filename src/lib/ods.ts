// Minimal, dependency-light reader for OpenDocument spreadsheets (.ods).
// Runs entirely in the browser (or Node for tests): nothing is uploaded anywhere.
import { unzipSync, strFromU8 } from 'fflate';
import { DOMParser } from '@xmldom/xmldom';

const NS = {
  table: 'urn:oasis:names:tc:opendocument:xmlns:table:1.0',
  office: 'urn:oasis:names:tc:opendocument:xmlns:office:1.0',
  text: 'urn:oasis:names:tc:opendocument:xmlns:text:1.0',
  style: 'urn:oasis:names:tc:opendocument:xmlns:style:1.0',
  fo: 'urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0',
};

export type CellType = 'float' | 'currency' | 'percentage' | 'date' | 'string' | 'boolean' | 'time' | 'empty';

export interface Cell {
  addr: string;       // e.g. "B15"
  row: number;        // 1-based
  col: number;        // 0-based (A = 0)
  type: CellType;
  value?: number;     // numeric value for float/currency/percentage
  date?: string;      // ISO date (YYYY-MM-DD) for date cells
  text: string;       // displayed text (without the note)
  formula?: string;   // e.g. "of:=SUM([.B6:.B30])"
  note?: string;      // comment/annotation attached to the cell
  highlight?: string; // background colour, if any
}

export interface Sheet {
  name: string;
  cells: Map<string, Cell>;
  get(addr: string): Cell | undefined;
  maxRow: number;
}

export function colName(n: number): string {
  let s = '';
  n += 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function colIndex(name: string): number {
  let n = 0;
  for (const ch of name) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

type El = Element;

function children(el: El): El[] {
  const out: El[] = [];
  for (let n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 1) out.push(n as unknown as El);
  return out;
}

function local(el: El): string {
  return (el.localName || el.nodeName.split(':').pop() || '') as string;
}

/** Text of a <text:p>, honouring <text:s>, <text:tab> and <text:line-break>. */
function paragraphText(node: Node): string {
  let s = '';
  for (let n = node.firstChild; n; n = n.nextSibling) {
    if (n.nodeType === 3) s += n.nodeValue ?? '';
    else if (n.nodeType === 1) {
      const el = n as unknown as El;
      const name = local(el);
      if (name === 'annotation') continue;
      if (name === 's') s += ' '.repeat(Number(el.getAttributeNS(NS.text, 'c') || 1));
      else if (name === 'tab') s += '\t';
      else if (name === 'line-break') s += '\n';
      else s += paragraphText(n);
    }
  }
  return s;
}

export function readOds(bytes: Uint8Array): Sheet[] {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new Error('O arquivo não parece ser uma planilha .ods válida.');
  }
  const content = files['content.xml'];
  if (!content) throw new Error('O arquivo não parece ser uma planilha .ods válida.');
  const doc = new DOMParser().parseFromString(strFromU8(content), 'text/xml') as unknown as Document;

  // Cell styles with a background colour (used to keep the sheet's highlights).
  const bg = new Map<string, string>();
  const styles = doc.getElementsByTagNameNS(NS.style, 'style');
  for (let i = 0; i < styles.length; i++) {
    const st = styles[i];
    const props = st.getElementsByTagNameNS(NS.style, 'table-cell-properties');
    for (let j = 0; j < props.length; j++) {
      const c = props[j].getAttributeNS(NS.fo, 'background-color');
      if (c && c !== 'transparent') bg.set(st.getAttributeNS(NS.style, 'name') || '', c);
    }
  }

  const sheets: Sheet[] = [];
  const tables = doc.getElementsByTagNameNS(NS.table, 'table');
  for (let t = 0; t < tables.length; t++) {
    const table = tables[t];
    const cells = new Map<string, Cell>();
    // Column default cell styles (a cell without its own style inherits these).
    const colStyles: (string | null)[] = [];
    const rows: El[] = [];
    const walk = (el: El) => {
      for (const ch of children(el)) {
        const name = local(ch);
        if (name === 'table-column') {
          const rep = Number(ch.getAttributeNS(NS.table, 'number-columns-repeated') || 1);
          const ds = ch.getAttributeNS(NS.table, 'default-cell-style-name');
          for (let k = 0; k < Math.min(rep, 1024); k++) colStyles.push(ds);
        } else if (name === 'table-row') rows.push(ch);
        else if (name === 'table-header-rows' || name === 'table-rows' || name === 'table-row-group' || name === 'table-column-group' || name === 'table-header-columns' || name === 'table-columns') walk(ch);
      }
    };
    walk(table);

    let r = 0;
    for (const row of rows) {
      const rr = Number(row.getAttributeNS(NS.table, 'number-rows-repeated') || 1);
      let c = 0;
      for (const cell of children(row)) {
        const name = local(cell);
        if (name !== 'table-cell' && name !== 'covered-table-cell') continue;
        const cr = Number(cell.getAttributeNS(NS.table, 'number-columns-repeated') || 1);
        const paras: string[] = [];
        let note: string | undefined;
        for (const ch of children(cell)) {
          const n = local(ch);
          if (n === 'p') paras.push(paragraphText(ch));
          else if (n === 'annotation') {
            const ps = ch.getElementsByTagNameNS(NS.text, 'p');
            const parts: string[] = [];
            for (let k = 0; k < ps.length; k++) parts.push(paragraphText(ps[k]));
            note = parts.join('\n').replace(/\s+\n/g, '\n').trim() || undefined;
          }
        }
        const text = paras.join('\n').trim();
        const vt = (cell.getAttributeNS(NS.office, 'value-type') || 'empty') as CellType;
        const formula = cell.getAttributeNS(NS.table, 'formula') || undefined;
        const v = cell.getAttributeNS(NS.office, 'value');
        const d = cell.getAttributeNS(NS.office, 'date-value');
        const style = cell.getAttributeNS(NS.table, 'style-name') || colStyles[c] || '';
        if ((text || formula || v || d || note) && rr < 100) {
          const addr = colName(c) + (r + 1);
          cells.set(addr, {
            addr,
            row: r + 1,
            col: c,
            type: vt,
            value: v != null && v !== '' ? Number(v) : undefined,
            date: d ? d.slice(0, 10) : undefined,
            text,
            formula,
            note,
            highlight: bg.get(style),
          });
        }
        c += cr;
      }
      r += rr;
    }
    const name = table.getAttributeNS(NS.table, 'name') || `Planilha ${t + 1}`;
    let maxRow = 0;
    cells.forEach((cl) => (maxRow = Math.max(maxRow, cl.row)));
    sheets.push({ name, cells, get: (a) => cells.get(a), maxRow });
  }
  return sheets;
}

/** Cell references used by an ODS formula, with ranges expanded. */
export function formulaRefs(formula: string | undefined): string[] {
  if (!formula) return [];
  const out: string[] = [];
  const re = /\[\$?[^.\]]*\.\$?([A-Z]+)\$?(\d+)(?::\$?[^.\]]*\.\$?([A-Z]+)\$?(\d+))?\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(formula))) {
    const [, c1, r1, c2, r2] = m;
    if (!c2) out.push(c1 + r1);
    else {
      const a = colIndex(c1), b = colIndex(c2);
      for (let c = Math.min(a, b); c <= Math.max(a, b); c++)
        for (let r = Math.min(+r1, +r2); r <= Math.max(+r1, +r2); r++) out.push(colName(c) + r);
    }
  }
  return out;
}

/** True when a formula is a plain sum/difference of references (no constants). */
export function signedRefs(formula: string | undefined): { ref: string; sign: 1 | -1 }[] {
  if (!formula) return [];
  const body = formula.replace(/^of:=/, '');
  const out: { ref: string; sign: 1 | -1 }[] = [];
  const sum = body.match(/^SUM\((.*)\)$/i);
  if (sum) return formulaRefs(formula).map((ref) => ({ ref, sign: 1 }));
  const re = /([+-]?)\s*\[\$?[^.\]]*\.\$?([A-Z]+)\$?(\d+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) out.push({ ref: m[2] + m[3], sign: m[1] === '-' ? -1 : 1 });
  return out;
}
