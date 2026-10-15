# TradeSignal Pro V6.4 — Research-only third strategy

## Additions
- `src/lib/high-probability-research.ts`: experimental confirmed trend-pullback candidate and historical next-bar replay, using closed 5m candles and last fully closed 1h/BTC context. No live orders, Telegram changes, new dependencies or changed original strategies.
- `/api/smc-compare`: now returns `highProbability` alongside `baseline` and `smc`.
- `/smc-compare`: four tabs (Old / SMC / V6.4 / Compare All), three side-by-side cards and comparison table.
- `tests/high-probability-research.test.ts`: safety checks for absent HTF context and flat market.

## Usage
Merge project files into existing app without replacing `.env.local` or `.signal-alerts/state.json`. From your project root run:
`npm install && npm run typecheck && npm test && npm run build && npm run dev`.
Open `/smc-compare`, select a symbol and 5,000 bars, click Compare strategies, and review **Holdout 30%** first.

## Limits
- This is an unvalidated experimental strategy, **not** a demonstrated high-win-rate system.
- Entry rules: 5m EMA20/50/200 alignment, latest closed 1h trend, BTC direction (for alts), recent EMA20 pullback, directional candle recovery, RSI/MACD confirmation, >=1.05x relative volume; stop based on recent swing/ATR; target 1.5 nominal risk units.
- Matching execution assumptions: 0.5% equity risk, 0.05% per-side taker fees, 0.02% per-side adverse slippage, stop-first on ambiguous OHLC, 60-minute max hold. Each strategy uses different signal logic, and the baseline/SMC legacy engine is not changed.
- 5,000 5m bars cover approximately 17 days. Small holdout trade samples cannot establish accuracy. The holdout split calculates segment summaries from backtest trades; it does not implement independent walk-forward reoptimization.
- Full `npm run typecheck` / Next build requires installed dependencies and should be verified on your machine. Signal rules are not connected to Telegram.
