# Budget Dad

**Painel do orçamento do mês: claro, bonito e privado.**
*A clear, private dashboard for a family's monthly budget spreadsheet.*

Budget Dad opens the family's monthly budget spreadsheet (`.ods`, made in OpenOffice/LibreOffice) and turns it into an interactive dashboard in Brazilian Portuguese: what came in, where the money went, day by day, the instalments still to pay, investments, assets and net worth.

> **Privacy by design.** This repository and the published website contain **no financial data**. The spreadsheet is opened by the person using the site and is read **inside their own browser**. Nothing is uploaded and no server sees it. A strict Content-Security-Policy blocks the page from contacting any other site.

---

## What it shows

| Section | What you get |
|---|---|
| **Visão geral** | Month result (income − everything that went out), the statement from the previous balance to what is left for next month, a waterfall of how the month closed, cumulative income vs. spending day by day, and the top observations. |
| **Gastos** | Spending by group (click to filter everything), a day-by-day stacked chart, spending by week, the size of each spending entry, the largest entries, and instalments in progress with how many are left. |
| **Lançamentos** | Every line of the month: accent-insensitive search, filters, sort by date, amount or description, and a detail panel with the spreadsheet's own note and the source cell. Shown as a table on desktop and as cards on mobile. |
| **Patrimônio** | Net worth with its composition, every investment (current value, amount invested, change), balances by institution, a maturity timeline, assets (price paid vs. value today) and loans. |
| **Descobertas** | Observations generated from the real numbers, each labelled **Fato calculado** (fact), **Estimativa** (estimate with its assumption stated) or **Leitura** (interpretation). |
| **Sobre os dados** | Where every number comes from: a cell-by-cell check against the spreadsheet's own totals, data-quality warnings, lines with no value, the grouping rules and a glossary. |

Filters (period, income/expenses, include “acertos”, groups) apply consistently to *Visão geral*, *Gastos* and *Lançamentos*.

## How it works

1. **Read** (`src/lib/ods.ts`): unzips the `.ods` file with `fflate` and parses `content.xml`: values, dates, formulas, cell comments and highlight colours.
2. **Interpret** (`src/lib/template.ts`): the spreadsheet's **own formulas** decide what is income, expense and “acertos”. For example, the expense lines are exactly the cells summed by the “Despesa” formula. The investments, assets, loans and net-worth blocks are found by their labels. Every total is then **re-computed and compared with the sheet's own result, cent by cent**.
3. **Group** (`src/lib/categories.ts`): simple, visible keyword rules, plus the sheet's own category summary where a line has no description. The rules are listed in the app.
4. **Calculate** (`src/lib/metrics.ts`, `src/lib/insights.ts`): totals in integer cents (no floating-point drift), filters, daily, weekly and category aggregates, instalments and observations.
5. **Show** (`src/sections/*`, `src/components/charts.tsx`): hand-built SVG charts (d3-scale/d3-shape) with tooltips, a validated colour-blind-safe palette, light and dark themes, and a responsive layout.

Long identification numbers found in descriptions or notes (customer numbers, registrations) are masked (`•••318`).

## Tech

React 18 · TypeScript · Vite · d3-scale/d3-shape · fflate · Vitest. No backend. Deployed to GitHub Pages by GitHub Actions.

## Run locally

```bash
npm install
npm run dev        # http://127.0.0.1:5178
npm test           # unit tests (+ real-sheet tests if a local copy exists)
npm run build      # production build in dist/
```

For development you can put a copy of the spreadsheet in `local-data/ModeloRafael.ods`. The dev server then opens it automatically. `local-data/` and every `.ods/.xlsx/.csv/.pdf` file are git-ignored and never part of the build.

## Using it

Open the site and choose the spreadsheet file (or drag it onto the page). Optionally tick **“Lembrar a planilha neste aparelho”** to keep the parsed data in this browser only (`localStorage`). **Fechar** forgets it.

The reader expects the family template's layout: date/value/description columns for the two halves of the month, summary rows “Receita / Despesa / Saldo”, a block titled “Acertos”, and the investments, assets and loans blocks. If the layout changes a lot, the app explains what it could not find.
