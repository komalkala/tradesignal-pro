# TradeSignal Pro V2 — Binance USDⓈ-M Futures research

Read-only Next.js 15 / TypeScript research prototype for SOL, BTC and ETH, with 15m, 1h and 4h completed candles.

## Start locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. Also run `npm run typecheck`, `npm test`, and `npm run build` before deployment. Node.js 20+ is recommended. Binance futures market-data endpoints must be reachable from the machine hosting Next.js. No API key is needed for the public endpoints used here.

## New V2 functionality

- Multi-timeframe EMA direction and BTC context filter
- Confirmed 5-bar swing-point market structure, support/resistance reference
- Long/short setup quality scores with explicit vetoes
- Live funding-rate, aggregate open interest, and top-20 order book snapshot (not historical / validated predictive scoring)
- ATR-based reference stop / 2R target, risk-budget sizing with estimated execution-cost buffer, UI-only daily-loss / correlated-open-risk guards
- Baseline historical candle-only backtest (carried over from V1). **The baseline backtest does not test V2 score rules.**
- Save paper-trade setup snapshots in local React session state only; this is **not** a paper-execution engine, journal database or realized-P&L tracker.

## Important limitations

**No** automatic/live order placement, guaranteed trades, liquidation calculation, stop execution, real portfolio risk enforcement, trade history persistence, Telegram alerts, historical open-interest/funding analysis, walk-forward V2 validation or proven probability model. Futures can exceed a planned loss due to slippage, gaps and liquidation.

For responsible use, first implement a candle-aligned V2 historical evaluator with BTC/higher-timeframe synchronization and point-in-time derivatives data; then out-of-sample and walk-forward tests, exchange filters, simulated fills and durable paper ledger before any live-trading consideration.


## V2 Poppins eye-comfort UI
- Poppins 300–700 via Google Fonts CSS import (needs network access for initial font load; system sans-serif fallback).
- Softer deep-navy/teal palette, medium-weight headings, comfortable spacing and subtle outlines.
- Signal, risk, backtesting and Binance API logic are unchanged.

## V3: V2 rule backtesting and swing trading

- **Swing mode** defaults to the 4h entry chart, confirming with the latest **completed** 1d higher-timeframe candle. A 1d chart with 1w confirmation is also available. Intraday uses 15m/1h.
- **Advanced tools → Run test** calls `/api/pro-backtest?symbol=SOLUSDT&interval=4h` to replay the same `qualitySignal` logic used by the live dashboard (including the BTC trend filter). It waits for higher-timeframe candles to close before allowing them into the simulation; a qualifying completed signal can only enter at the **next bar open**.
- Simulates one position at a time per coin, ATR stop, 2R target, pessimistic intrabar stop-first fills, 0.5% planned risk, 0.05% per-side fee and 0.02% per-side slippage. Funding is **0 by default**: the optional adverse funding-cost model is a constant-rate estimate, **not historical funding**. Results show return, win rate, drawdown, profit factor and trades.
- No Binance keys, leverage management, liquidation simulator, correlated multi-coin portfolio backtest, persistent paper trading, historical funding reconstruction, out-of-sample test, or automatic orders. Test results can be misleading due to short history and sampling. Binance may limit historical candle data or network access.
- Use this for research and paper trading, not as proof of profitable swing signals. Entered manual risk limits do not protect Binance positions.

## V3 Local Telegram Signal Alerts

This package adds a dedicated **read-only** notification worker under `workers/signal-monitor.ts`. It imports the **same** `qualitySignal`, `profile`, and `getCandles` modules as the dashboard. It monitors SOLUSDT/BTCUSDT/ETHUSDT at **15m and 1h intraday**, **4h and 1d swing**, including the 1-week higher timeframe for 1d setups. Only **confirmed LONG / SHORT** scores with no strategy vetoes are sent. WAIT never sends an alert.

### Setup

1. Install Node.js 20+ and run `npm install`.
2. In Telegram search for **@BotFather**, send `/newbot`, choose a name/username, and save the bot token privately.
3. Open your new bot chat and press **Start**, then send a message such as `hello`.
4. To find your Telegram numeric chat ID, use this URL **privately** in your browser: `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates`. Find `result[].message.chat.id`. The `<YOUR_TOKEN>` placeholder must be replaced with your actual token; never share the URL, screenshot, token, or JSON publicly. Alternative: call Telegram Bot API with a private terminal script.
5. Copy `.env.example` to `.env.local` and enter `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` (no quotes).
6. Run `npm run alerts:test` — you should receive a harmless Telegram test message.
7. Run `npm run alerts:monitor` in a **second terminal**. You may also run `npm run dev` to view the dashboard, but it is NOT required for alerts.

**Local only:** Alerts can arrive with the dashboard/browser closed, but **not** when the laptop is off, sleeping, without network access, or when the worker terminal/process stops. Keep the worker running in its own terminal.

### Safeguards

- Loads **only completed** Binance futures candles and uses the original V3 `qualitySignal` method. Higher timeframe and BTC confirmations must have completed by the evaluated entry candle's close (no future candle leakage).
- Evaluates a symbol/timeframe only once per new completed candle and only notifies a confirmed LONG or SHORT if its score >= 75 with **zero vetoes**.
- Stops notification if the most recent completed candle is stale (> one additional timeframe beyond its close, plus five minutes).
- `.signal-alerts/state.json` stores per-market candle watermarks and sent alert IDs across worker restarts. Keep that file persistent for stable deduplication.
- First launch baselines all available markets without sending old/historical signals. To change this, set `ALERT_SEND_ON_START=true` explicitly.
- Uses read-only public Binance Futures endpoints. **No Binance keys, no trading orders, no live positions, and no leverage management.**
- `ALERT_DRY_RUN=true` can be used to inspect signals without contacting Telegram.

### Operational notes

- Binance may be inaccessible on some networks; the terminal logs individual data-fetch failures. Test `npm run alerts:test` separately from Binance connectivity.
- Simultaneous workers using the same state file are **not supported**; start only one monitor.
- Telegram messages are not a replacement for exchange stops. Network outages, token revocation, process crashes, and polling delays can result in missed alerts.
- Existing V3 backtests are simplified research tests, and this tool's signal score is **not a measured probability of winning**.

## V4 research upgrade (incremental, not a 10/10 profitability claim)

- The existing V3 dashboard, Poppins theme, strategy engine and Telegram worker are retained.
- Backtest retrieval now paginates historical Binance futures klines (default 5,000 candles, maximum 10,000) instead of relying on a single 1,400-candle request. Binance may rate-limit or block requests from particular networks.
- OHLC validity, duplicate timestamps and interval gaps are checked; invalid history stops a backtest instead of silently producing results.
- The backtest reports a chronological training/holdout split (70%/30%), with separate trade counts, net returns, profit factor, drawdown and missing-evidence notes.
- Running this validation does NOT prove profitability: no parameter optimization, independent walk-forward folds, true historical funding cash flows, margin/liquidation modeling or live paper-trade fills are implemented yet.
- No actual trades are placed; Telegram alerts still use the current closed-candle signal engine.

Run `npm install`, `npm run typecheck`, `npm test`, then `npm run dev`. Open Advanced tools and select Run test. Long history requests can take longer than the usual dashboard refresh.


## V5: Quick-trade 5m backtesting

In the dashboard, choose SOL/BTC/ETH → **Quick Trade Backtesting** → maximum duration 15/30/45/60 min → Run 5m test. This is a **separate historical research path**; your existing live alerts and 15m/1h/4h/1d signals are unchanged.

The new endpoint is `/api/quick-backtest?symbol=SOLUSDT&maxMinutes=60&bars=5000`. Closed 5m signals use completed 15m and 1h profiles with BTC 1h trend filter; entries fill at next 5m open plus slippage, exits stop-first if stop/target share a candle, otherwise target or forced time exit. Risk 0.5%, up to 2 trades per UTC calendar day. Fees: 0.05% taker/side; slippage: 0.02%/side. Funding defaults to zero. Training/holdout split is descriptive, NOT truly untouched if the strategy was previously selected using that data. Real-world latency, liquidation, exchange order limits, spread, historical funding and trade-by-trade portfolio correlation are NOT simulated. History defaults to 5,000 5m bars (~17 days), insufficient for statistical confidence.

`npm install && npm run typecheck && npm test && npm run build`


## V5.1 ADD-ON: Unlimited confirmed QUICK alerts (existing features preserved)

The existing V3/V4 intraday and swing monitors, dashboard, and backtests remain. An additional 5m QUICK scan monitors SOL, BTC and ETH using the same 5m / 15m / 1h and BTC confirmation as the QUICK backtester. Only completed candles qualify; every unique confirmed 5m signal can generate an alert, with **no daily count limit**. Threshold: 85/100, with mandatory filters. Default QUICK target: 2R; assumed execution costs 0.05% fee per side and 0.02% slippage per side. Historical QUICK backtest also defaults to unlimited trades per day, but assumes only one position at a time.

Set `ALERT_QUICK_ENABLED=true` in `.env.local` (the default if omitted). Keep your existing variables. Run `npm run alerts:test`, then `npm run alerts:monitor` in its own terminal while `npm run dev` runs the dashboard. The Telegram worker is read-only and does **not** close live trades after 60 minutes: 60 minutes is a backtest time-exit assumption and an alert reminder.

Alert watermarks persist in `.signal-alerts/state.json`. On upgrading an existing state file, the newest quick candle is baselined to avoid startup spam. Failed Telegram delivery is retried on next scan because evaluation state only advances after success. Do not run two workers against the same state file.

**Validation note:** the QUICK backtest and alerts share the qualification function; however, their historical feed and execution assumptions remain simplified. In particular, prior QUICK score inputs were not calibrated on unseen data; no profitability is guaranteed.
