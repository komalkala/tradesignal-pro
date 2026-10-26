# TradeSignal Pro V7 — Clean Dashboard

## What changed
- Consolidated `/v7` landing page shows signal status, 1D/4H/1H context, buyer/seller aggressive-taker pressure, 1h/4h closed-candle volume, and economic-event cautions.
- Six coin buttons, single refresh button, 60s auto-refresh, compact Poppins typography.
- All diagnostics and other research links live under optional expandable sections.
- API errors are shown separately; a missing order-flow API cannot be misinterpreted as an approved signal.
- Reuses existing `/api/v7` and `/api/order-flow` and existing worker. No new indicator or trading-rule changes.

## Important limitations
- Buyer/seller percentage is based on up to 1,000 most recent aggregated executed Binance Futures trades, **not** all participants or the full one-hour bar.
- HIGH / LOW volume compares last completed 1H/4H candle with preceding 20 candles.
- V7 signal is research-only; no automated Binance trades.
- CPI/FOMC events still require manual verified V7_EVENTS_JSON configuration; the dashboard does not block entries.
- No claim of validated profitability.

## Installation
Extract and merge into a backed-up existing Next.js project; or use included package.json if bootstrapping. Run npm install, npm run typecheck, npm test, npm run build, npm run dev. Open /v7. Existing pages are kept unchanged.
