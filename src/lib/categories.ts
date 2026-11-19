import type { CategoryId, Kind } from './types';

export interface CategoryDef {
  id: CategoryId;
  label: string;
  short: string;
  kind: Kind;
  /** CSS variable holding the colour. Fixed per category: colour follows the entity. */
  color: string;
  explain: string;
}

// Order = fixed colour-slot order (validated categorical palette). Never cycled.
export const CATEGORIES: CategoryDef[] = [
  { id: 'aposentadoria', label: 'Aposentadoria (INSS)', short: 'INSS', kind: 'receita', color: 'var(--income-1)', explain: 'Benefício do INSS creditado no mês.' },
  { id: 'previdencia', label: 'Previdência complementar', short: 'Previdência', kind: 'receita', color: 'var(--income-2)', explain: 'Complemento pago pelo fundo de previdência.' },
  { id: 'outras-receitas', label: 'Outras receitas', short: 'Outras', kind: 'receita', color: 'var(--income-3)', explain: 'Outras entradas lançadas na planilha.' },
  { id: 'cartoes', label: 'Cartões de crédito', short: 'Cartões', kind: 'despesa', color: 'var(--cat-1)', explain: 'Faturas e parcelas de cartões de crédito.' },
  { id: 'familia', label: 'Família', short: 'Família', kind: 'despesa', color: 'var(--cat-2)', explain: 'Depósitos para a família.' },
  { id: 'imoveis', label: 'Imóveis e terrenos', short: 'Imóveis', kind: 'despesa', color: 'var(--cat-3)', explain: 'Parcelas ligadas a imóveis ou lotes.' },
  { id: 'educacao', label: 'Educação', short: 'Educação', kind: 'despesa', color: 'var(--cat-4)', explain: 'Faculdade e financiamento estudantil.' },
  { id: 'casa', label: 'Casas e contas', short: 'Casas', kind: 'despesa', color: 'var(--cat-5)', explain: 'Luz, água, gás, internet e condomínio.' },
  { id: 'emprestimos', label: 'Empréstimos', short: 'Empréstimos', kind: 'despesa', color: 'var(--cat-6)', explain: 'Parcelas de empréstimo.' },
  { id: 'acertos', label: 'Acertos', short: 'Acertos', kind: 'acerto', color: 'var(--cat-7)', explain: 'Saídas que a planilha separa sob o título “Acertos”. Entram no saldo final, mas não no total de “Despesa” da planilha.' },
  { id: 'sem-descricao', label: 'Sem descrição', short: 'Sem descrição', kind: 'despesa', color: 'var(--cat-other)', explain: 'Valores lançados sem descrição legível na planilha.' },
];

export const CAT: Record<CategoryId, CategoryDef> = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<CategoryId, CategoryDef>;

function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

const UF = new Set('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '));
/** Two capital letters at the end of the text, as a state code ("gás SC", "InternetRJ"). */
export function stateOf(text: string): string | undefined {
  const m = text.trim().match(/(?:^|[^A-Z])([A-Z]{2})$/);
  return m && UF.has(m[1]) ? m[1] : undefined;
}

/** Rule-based classification from generic words. Rules are listed on the "Sobre os dados" page.
 *  Lines these words do not cover are classified afterwards by the sheet's own summary block (template.ts). */
export function classify(description: string, kind: Kind, hasDescription: boolean): { category: CategoryId; place?: string } {
  const d = norm(description);
  if (kind === 'acerto') return { category: 'acertos' };
  if (kind === 'receita') {
    if (/\binss\b|aposentadoria/.test(d)) return { category: 'aposentadoria' };
    if (/\bprevi\b|previdencia|pensao/.test(d)) return { category: 'previdencia' };
    return { category: 'outras-receitas' };
  }
  if (!hasDescription) return { category: 'sem-descricao' };
  if (/cart(ao|oes)|fatura/.test(d)) return { category: 'cartoes' };
  if (/rafael|filho|filha|mesada/.test(d)) return { category: 'familia' };
  if (/imove|\blote\b|terreno|reserva/.test(d)) return { category: 'imoveis' };
  if (/\bfies\b|faculdade|universidade|mensalidade|estacio|escola|curso/.test(d)) return { category: 'educacao' };
  if (/emprest|financiamento|consignado|dindin/.test(d)) return { category: 'emprestimos' };
  if (/\bluz\b|energia|agua|\bgas\b|internet|condomin|telefone|celular/.test(d)) return { category: 'casa', place: stateOf(description) };
  return { category: 'sem-descricao' };
}

export const CLASSIFICATION_RULES: { category: CategoryId; rule: string }[] = [
  { category: 'aposentadoria', rule: 'Entrada cuja descrição contém “INSS” ou “aposentadoria”.' },
  { category: 'previdencia', rule: 'Entrada cuja descrição contém “PREVI”, “previdência” ou “pensão”.' },
  { category: 'cartoes', rule: 'Descrição com “cartão” ou “fatura”, ou linha que o resumo da planilha soma em “Cartões”.' },
  { category: 'familia', rule: 'Descrição com o nome de um familiar (ex.: “Rafael”).' },
  { category: 'imoveis', rule: 'Descrição com “imóveis”, “lote”, “terreno” ou “reserva”.' },
  { category: 'educacao', rule: 'Descrição com “FIES”, “faculdade”, “mensalidade” ou o nome da faculdade.' },
  { category: 'casa', rule: 'Luz, energia, água, gás, internet ou condomínio, ou linha que o resumo da planilha soma como luz, água ou internet. O estado (ex.: RJ, SC) vem do resumo da planilha ou da descrição.' },
  { category: 'emprestimos', rule: 'Descrição com “empréstimo”, “financiamento”, “consignado” ou o nome da linha de crédito.' },
  { category: 'acertos', rule: 'Linhas que a planilha separa sob o título “Acertos”.' },
  { category: 'sem-descricao', rule: 'Valor sem descrição legível (na planilha a descrição aparece como “0”).' },
];
