import { describe, expect, test } from 'vitest';
import { formulaRefs, signedRefs, colName, colIndex } from '../src/lib/ods';
import { brl, brlAxis, dateBR } from '../src/lib/format';
import { classify } from '../src/lib/categories';
import { maskIds } from '../src/lib/template';

describe('ods helpers', () => {
  test('column names', () => {
    expect(colName(0)).toBe('A');
    expect(colName(25)).toBe('Z');
    expect(colName(26)).toBe('AA');
    expect(colIndex('E')).toBe(4);
  });
  test('formula references and ranges', () => {
    expect(formulaRefs('of:=SUM([.B6:.B9])')).toEqual(['B6', 'B7', 'B8', 'B9']);
    expect(formulaRefs('of:=+[.B3]+[.B4]')).toEqual(['B3', 'B4']);
    expect(formulaRefs('of:=+[.D56]/[.$D$72]')).toEqual(['D56', 'D72']);
    expect(signedRefs('of:=+[.E31]-[.E32]-[.E29]')).toEqual([
      { ref: 'E31', sign: 1 },
      { ref: 'E32', sign: -1 },
      { ref: 'E29', sign: -1 },
    ]);
  });
});

describe('Brazilian formatting', () => {
  test('currency', () => {
    expect(brl(1234.5)).toBe('R$ 1.234,50');
    expect(brl(-1234.56)).toBe('-R$ 1.234,56');
    expect(brlAxis(25000)).toBe('R$ 25 mil');
    expect(brlAxis(-10000)).toBe('−R$ 10 mil');
  });
  test('dates', () => {
    expect(dateBR('2024-11-05')).toBe('05/11/2024');
  });
});

describe('classification and masking', () => {
  test('categories', () => {
    expect(classify('Faculdade 3/12', 'despesa', true).category).toBe('educacao');
    expect(classify('cartão da loja 2/10', 'despesa', true).category).toBe('cartoes');
    expect(classify('conta de gás SP', 'despesa', true)).toEqual({ category: 'casa', place: 'SP' });
    expect(classify('InternetMG', 'despesa', true)).toEqual({ category: 'casa', place: 'MG' });
    expect(classify('Águas de Itaboraí', 'despesa', true)).toEqual({ category: 'casa', place: undefined });
    expect(classify('qualquer coisa', 'acerto', true).category).toBe('acertos');
    expect(classify('', 'despesa', false).category).toBe('sem-descricao');
  });
  test('long numbers are masked', () => {
    expect(maskIds('Número do cliente 12345678')).toBe('Número do cliente •••678');
    expect(maskIds('Parcela 35/48')).toBe('Parcela 35/48');
  });
});
