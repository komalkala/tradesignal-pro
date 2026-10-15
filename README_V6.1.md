# TradeSignal Pro V6.1 — additive research update

This is a complete *source snapshot* of the uploaded `tests.zip`, plus research modules and a read-only research page. The original live Telegram worker, existing signals, scoring thresholds, and other pages are unchanged. The uploaded ZIP did not contain `package.json`, lockfile, `tsconfig.json`, or installed dependencies. Do **not** treat this as a proven complete deployable application.

## New features
- `src/lib/market-regime.ts`: simple, explicitly heuristic range/trend/volatility labels.
- `src/lib/entry-confirmation.ts`: research-only breakout/pullback conditions.
- `src/lib/performance-metrics.ts`: closed-trade performance summary.
- `src/lib/walk-forward.ts`: chronological, fixed-rule windows. **Not actual rolling retraining or optimization**, and not out-of-sample proof.
- `src/lib/signal-journal.ts`: pure journal record builder, not automatically persisted; integrate only after tests.
- `src/app/api/strategy-research/route.ts`: loads 5m/15m/1h candles, reruns the EXISTING quick backtest, compares the baseline.
- `src/app/strategy-research/page.tsx`: research UI at `/strategy-research`.
- `tests/v61-research.test.ts`: unit tests for new functions.

## Setup
Copy files over your existing project, retaining your existing `package.json`, lockfile and `tsconfig.json`. Never copy `.signal-alerts/state.json` from this archive over production; it is an existing local notification state file and can suppress alerts or cause duplicate alerts. Do not deploy it. This ZIP intentionally omits the `.signal-alerts/` directory.

From the project root:
```
npm install
npm run typecheck
npm test
npm run build
npm run dev
```
Open `http://localhost:3000/strategy-research`, select a symbol and click Run research. Its Binance calls need network access and may fail in restricted hosting regions. Signal-alert worker is NOT changed.

## Caveats
- No live market validation was performed by this package creator.
- There is no price-provider failover in this update.
- Heuristic indicators and displayed candidate entries are not independently validated trading rules.
- `chronologicalValidation` only segments trades from one existing fixed-rule replay; it does not optimize on train periods and test untouched periods.
- 2,500 five-minute bars represent roughly 8.7 days, NOT four years, and may yield too few trades for useful conclusions.
- A 60-minute quick exit is enforced in historical simulation, not in live Telegram alerts.
- One worker process and persistent state are required for reliable alerts.
