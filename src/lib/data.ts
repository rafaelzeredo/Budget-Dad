// Loads the dashboard's data: the spreadsheet from the PAI folder, already processed by
// `npm run data` (scripts/build-data.ts). The published copy is encrypted (AES-256-GCM);
// the key travels only in the private link (#k=…), which browsers never send to the server.
import type { BudgetModel } from './types';
import { clearAccess, loadAccess, saveAccess } from './storage';

export interface Dataset {
  v: 1;
  source: { name: string; sha256: string };
  model: BudgetModel;
}

export type LoadResult =
  | { status: 'ok'; data: Dataset }
  | { status: 'locked'; reason: 'no-key' | 'bad-key' }
  | { status: 'error'; message: string };

const MAGIC = 'BD1';

/** Accepts a full private link, a "#k=…" fragment or the bare key. */
export function extractKey(s: string): string | null {
  const t = s.trim();
  const m = t.match(/[#&?]k=([A-Za-z0-9_-]{43})/) ?? t.match(/^([A-Za-z0-9_-]{43})$/);
  return m ? m[1] : null;
}

function b64uToBytes(s: string): Uint8Array {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(b, (ch) => ch.charCodeAt(0));
}

async function decrypt(buf: ArrayBuffer, keyText: string): Promise<Dataset> {
  const bytes = new Uint8Array(buf);
  if (new TextDecoder().decode(bytes.slice(0, 3)) !== MAGIC) throw new Error('format');
  const key = await crypto.subtle.importKey('raw', b64uToBytes(keyText) as BufferSource, 'AES-GCM', false, ['decrypt']);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(3, 15) }, key, bytes.slice(15));
  return JSON.parse(new TextDecoder().decode(plain)) as Dataset;
}

let cache: ArrayBuffer | null = null;
async function fetchEncrypted(): Promise<ArrayBuffer> {
  if (cache) return cache;
  const r = await fetch('./data/budget.bin', { cache: 'no-cache' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  cache = await r.arrayBuffer();
  return cache;
}

export async function loadBudget(typedKey?: string): Promise<LoadResult> {
  // Local development: the plain processed copy from local-data/ (never published).
  if (import.meta.env.DEV && !typedKey) {
    try {
      const r = await fetch('/__local/budget.json');
      if (r.ok) return { status: 'ok', data: (await r.json()) as Dataset };
    } catch {
      /* fall through to the encrypted copy */
    }
  }
  const fromLink = typedKey ? extractKey(typedKey) : extractKey(window.location.hash);
  const stored = loadAccess();
  const key = fromLink ?? stored;
  if (!key) return { status: 'locked', reason: typedKey ? 'bad-key' : 'no-key' };
  let buf: ArrayBuffer;
  try {
    buf = await fetchEncrypted();
  } catch {
    return { status: 'error', message: 'Não foi possível carregar os dados do painel. Verifique a internet e tente de novo.' };
  }
  try {
    const data = await decrypt(buf, key);
    if (fromLink) {
      // Remember on this device and take the key out of the address bar.
      if (saveAccess(fromLink) && window.location.hash.includes('k=')) history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    return { status: 'ok', data };
  } catch {
    if (!fromLink) clearAccess();
    return { status: 'locked', reason: 'bad-key' };
  }
}
