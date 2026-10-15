# V6.3 Clear comparison UI

## Changes
- `src/components/Dashboard.tsx`: top navigation to Old Strategy, New SMC, Compare Both.
- `src/app/smc-compare/page.tsx`: prominent comparison tabs, side-by-side performance, holdout/overall/training controls, per-strategy trades, SMC pattern list.
- No changes to live signal engine, backtest strategy definitions, API routes, Telegram worker, or alert settings.

## Run
`npm install && npm run typecheck && npm test && npm run build && npm run dev`

Open the local port shown by Next.js. Click **Compare Both** on the homepage, choose coin and number of bars, and select **Compare strategies**.

**Important**: Comparison uses 5-minute backtesting. The dashboard's 4h signal score is not directly comparable to this research view. Historical results do not prove profitability.
