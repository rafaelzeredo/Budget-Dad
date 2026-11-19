// Data pipeline: reads the family's spreadsheet from the PAI folder (read-only),
// turns it into the dashboard's data model, and writes:
//   local-data/budget.json  plain JSON for local development (git-ignored, never published)
//   public/data/budget.bin  the same JSON encrypted with AES-256-GCM (this is what the site loads)
// The key stays in local-data/key.txt (git-ignored). Without it the published file is unreadable.
//
// Usage: npm run data            (source defaults to ../Pai/ModeloRafael.ods)
//        npm run data -- <path>  (another copy of the same spreadsheet)
import { createHash, randomBytes, webcrypto } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseBudget } from '../src/lib/template';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_SOURCE = resolve(ROOT, '../Pai/ModeloRafael.ods');
const source = resolve(process.argv[2] ?? DEFAULT_SOURCE);
const LOCAL = resolve(ROOT, 'local-data');
// BD_KEY_FILE / BD_OUT exist only to test the pipeline with a throwaway key.
const KEY_FILE = resolve(process.env.BD_KEY_FILE ?? resolve(LOCAL, 'key.txt'));
const OUT = resolve(process.env.BD_OUT ?? resolve(ROOT, 'public/data/budget.bin'));
// The private link the family opens. Written to a git-ignored file; never printed.
const SITE = 'https://rafaelzeredo.github.io/Budget-Dad/';

const b64u = (b: Uint8Array) => Buffer.from(b).toString('base64url');

async function main() {
  if (!existsSync(source)) throw new Error(`Spreadsheet not found: ${source}`);
  const bytes = new Uint8Array(readFileSync(source)); // read only
  const sha = createHash('sha256').update(bytes).digest('hex');
  const model = parseBudget(bytes, 'ModeloRafael.ods');
  model.parsedAt = new Date().toISOString();
  const json = JSON.stringify({ v: 1, source: { name: 'ModeloRafael.ods', sha256: sha }, model });

  mkdirSync(LOCAL, { recursive: true });
  writeFileSync(resolve(LOCAL, 'budget.json'), json);

  let keyText = existsSync(KEY_FILE) ? readFileSync(KEY_FILE, 'utf8').trim() : '';
  if (!keyText) {
    keyText = b64u(randomBytes(32));
    writeFileSync(KEY_FILE, keyText + '\n', { mode: 0o600 });
  }
  const raw = Buffer.from(keyText, 'base64url');
  if (raw.length !== 32) throw new Error('local-data/key.txt must hold a 32-byte base64url key');
  const key = await webcrypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt']);
  const iv = randomBytes(12);
  const ct = new Uint8Array(await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(json)));
  // File layout: "BD1" magic, 12-byte IV, ciphertext+tag.
  const out = new Uint8Array(3 + iv.length + ct.length);
  out.set(new TextEncoder().encode('BD1'), 0);
  out.set(iv, 3);
  out.set(ct, 3 + iv.length);
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, out);
  if (!process.env.BD_KEY_FILE) writeFileSync(resolve(LOCAL, 'private-link.txt'), `${SITE}#k=${keyText}\n`, { mode: 0o600 });

  const bad = model.checks.filter((c) => Math.round(c.sheet * 100) !== Math.round(c.computed * 100));
  console.log(`source   ${source}`);
  console.log(`sha256   ${sha}`);
  console.log(`lines    ${model.transactions.length} (${model.transactions.filter((t) => t.amount > 0).length} with value)`);
  console.log(`checks   ${model.checks.length - bad.length}/${model.checks.length} sheet totals reproduced to the cent`);
  bad.forEach((c) => console.log(`         differs: ${c.label} (${c.cell})${c.note ? ' — ' + c.note : ''}`));
  console.log(`wrote    local-data/budget.json, ${OUT.replace(ROOT + "/", "")} (${out.length} bytes, encrypted)`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
