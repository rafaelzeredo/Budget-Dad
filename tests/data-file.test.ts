// The published data file must be unreadable without the key, and (where the key exists
// locally) must decrypt to exactly what the pipeline read from the spreadsheet.
import { existsSync, readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { describe, expect, test } from 'vitest';
import { extractKey } from '../src/lib/data';

const BIN = 'public/data/budget.bin';
const KEY = 'local-data/key.txt';
const PLAIN = 'local-data/budget.json';

describe('published data file', () => {
  test('exists and is encrypted (no readable text)', () => {
    const b = readFileSync(BIN);
    expect(b.subarray(0, 3).toString()).toBe('BD1');
    const text = b.toString('latin1');
    for (const s of ['transactions', 'description', 'Receita', 'Despesa', 'INSS', 'PREVI', 'R$']) expect(text.includes(s)).toBe(false);
  });
});

describe('private link', () => {
  const k = 'A'.repeat(43);
  test('the key is read from a full link, a fragment or on its own', () => {
    expect(extractKey(`https://example.org/Budget-Dad/#k=${k}`)).toBe(k);
    expect(extractKey(`#k=${k}`)).toBe(k);
    expect(extractKey(`  ${k} `)).toBe(k);
  });
  test('anything else is rejected', () => {
    expect(extractKey('')).toBeNull();
    expect(extractKey('#k=short')).toBeNull();
    expect(extractKey('https://example.org/Budget-Dad/')).toBeNull();
  });
});

const local = existsSync(KEY) && existsSync(PLAIN);
(local ? describe : describe.skip)('published data file decrypts with the local key (local only)', () => {
  test('same data as the pipeline produced', async () => {
    const b = new Uint8Array(readFileSync(BIN));
    const key = await webcrypto.subtle.importKey('raw', Buffer.from(readFileSync(KEY, 'utf8').trim(), 'base64url'), 'AES-GCM', false, ['decrypt']);
    const plain = await webcrypto.subtle.decrypt({ name: 'AES-GCM', iv: b.slice(3, 15) }, key, b.slice(15));
    const fromBin = JSON.parse(new TextDecoder().decode(plain));
    const fromJson = JSON.parse(readFileSync(PLAIN, 'utf8'));
    expect(fromBin.source).toEqual(fromJson.source);
    expect(fromBin.model.transactions).toEqual(fromJson.model.transactions);
    expect(fromBin.model.checks).toEqual(fromJson.model.checks);
    expect(fromBin.model.wealth).toEqual(fromJson.model.wealth);
  });
});
