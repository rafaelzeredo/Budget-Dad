export type Kind = 'receita' | 'despesa' | 'acerto';
export type Block = 'inicio' | 'fim' | 'acertos';

export type CategoryId =
  | 'aposentadoria'
  | 'previdencia'
  | 'outras-receitas'
  | 'cartoes'
  | 'familia'
  | 'imoveis'
  | 'educacao'
  | 'casa'
  | 'emprestimos'
  | 'acertos'
  | 'sem-descricao';

export interface Installment {
  n: number;
  total?: number;
}

export interface Txn {
  id: string;
  date: string | null; // ISO YYYY-MM-DD, exactly as in the sheet
  amount: number; // always positive; `kind` says the direction
  kind: Kind;
  block: Block;
  description: string; // cleaned, ids masked
  hasDescription: boolean;
  note?: string; // the sheet's own comment for this line (ids masked)
  category: CategoryId;
  place?: string; // state (UF) of the home a bill belongs to, when the sheet says
  installment?: Installment;
  cell: string; // source cell of the amount
  highlighted: boolean; // highlighted (coloured) in the sheet
}

export interface EmptyRow {
  cell: string;
  date: string | null;
  description?: string;
}

export interface Investment {
  name: string;
  applied: number;
  current: number;
  maturity: string | null; // ISO date when known
  maturityText: string;
  isAccount: boolean; // "Saldos em conta ..." rows
  cell: string;
}

export interface Asset {
  name: string;
  cost: number;
  value: number;
}

export interface Loan {
  name: string;
  contracted: string | null;
  balance: number;
  until: string;
}

export interface CheckRow {
  label: string;
  cell: string;
  sheet: number;
  computed: number;
  note?: string;
}

export interface Issue {
  severity: 'info' | 'atencao';
  title: string;
  detail: string;
  cells?: string[];
}

export interface BudgetModel {
  title: string;
  fileName: string;
  sheetName: string;
  opening: { date: string | null; amount: number; cell: string };
  closing: { amount: number; cell: string; label: string };
  transactions: Txn[];
  emptyRows: EmptyRow[];
  previNormal?: number;
  balances: { name: string; amount: number }[];
  balancesTotal?: number;
  investments: Investment[];
  investmentsAsOf: string; // e.g. "nov 2026"
  assets: Asset[];
  loans: Loan[];
  wealth: { gross: number; loans: number; net: number; investments: number; assets: number };
  sheetSummary: { label: string; amount: number }[];
  checks: CheckRow[];
  issues: Issue[];
  parsedAt: string;
}
