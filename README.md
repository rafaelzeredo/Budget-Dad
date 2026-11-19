# Budget Dad

**O orçamento do mês, num painel bonito, claro e particular.**
*A private, interactive dashboard of one family's monthly budget spreadsheet.*

Budget Dad turns the family's monthly budget spreadsheet (`PAI/ModeloRafael.ods`, made in OpenOffice) into a finished financial dashboard in Brazilian Portuguese. It opens straight into the real numbers: no uploads, no setup.

## What it shows

One page, in seven sections, all connected by the same filters (period, a single day, income/spending, include “acertos”, spending groups):

| | Section | What you get |
|---|---|---|
| — | **Resumo** | Month result with a running day-by-day result line, income, expenses, “acertos”, share of income left, what is left for next month and net worth. |
| 01 | **Entradas e saídas** | Income vs. spending on one scale (with the gap covered by savings), a waterfall of how the month closed, cumulative income vs. spending. |
| 02 | **Para onde foi o dinheiro** | Interactive donut + table by group (share of spending and of income). Selecting a group lists its entries and filters the whole page. Largest entries and instalments in progress. |
| 03 | **O mês, dia a dia** | Daily spending stacked by group, a month calendar heatmap (click a day to filter), weekly totals and the size distribution of spending. |
| 04 | **Todos os lançamentos** | Every line as a day-by-day feed: accent-insensitive search, sorting, detail drawer with the sheet's own note and source cell. |
| 05 | **O que os números contam** | Observations computed from the data, each labelled *fato*, *estimativa* or *leitura*. Click one to jump to its entries. |
| 06 | **Patrimônio** | Net worth composition, investments, balances by institution, maturity timeline, assets (paid vs. today) and loans. |
| 07 | **Sobre os dados** | Source file and fingerprint, a cent-by-cent check against the sheet's own totals, data-quality notes, grouping rules, glossary. |

## How the data gets in

```
PAI/ModeloRafael.ods ──(npm run data)──▶ local-data/budget.json   (plain, git-ignored, used by `npm run dev`)
      read-only                       └─▶ public/data/budget.bin  (AES-256-GCM encrypted, published)
```

`scripts/build-data.ts` reads the spreadsheet (never modifies it) with the same parser the tests use (`src/lib/ods.ts`, `src/lib/template.ts`):
the sheet's **own formulas** decide what is income, expense and “acertos”, and every total is re-computed in integer cents and compared with the sheet's result.

## Privacy

This repository is public; the family's numbers are not. The published data file is **encrypted**. The key exists only in `local-data/` (git-ignored) and in the family's **private link** (`…/Budget-Dad/#k=…`). The part after `#` is never sent to any server. The first visit with the link remembers access on that device; “Esquecer o acesso neste aparelho” (footer) removes it. Without the key the site shows only a “Painel particular” page. A strict Content-Security-Policy blocks requests to other sites. Long ID numbers in descriptions and notes are masked (`•••318`).

## Develop

```bash
npm install
npm run data       # process ../Pai/ModeloRafael.ods → local-data/ + public/data/budget.bin
npm run dev        # http://127.0.0.1:5178 (opens with the local plain copy)
npm test           # unit tests; real-sheet and decryption tests run only where local-data/ exists
npm run build      # production build in dist/
```

After `npm run data`, the private link is in `local-data/private-link.txt`.

React 18 · TypeScript · Vite · d3-scale/d3-shape · Inter & Fraunces (self-hosted) · Vitest. Deployed to GitHub Pages by GitHub Actions.
