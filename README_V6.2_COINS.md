# TradeSignal Pro V6.2 — Six-market expansion

Six Binance USDT futures symbols are in `src/lib/types.ts`: SOLUSDT, BTCUSDT, ETHUSDT, TAOUSDT, LINKUSDT and BNBUSDT.

The Dashboard, historical-data tables/API, market intelligence API/UI, 5m quick backtest, research API/page, and WebSocket type support all six. Existing EMA/RSI/MACD/structure qualification is unchanged.

**Alert safety:** The existing three coins are monitored by default. To opt into Telegram research alerts for the three new symbols, set `ALERT_EXTRA_SYMBOLS_ENABLED=true` in `.env.local`. The regular and quick alert engines both use this flag. Backtest and paper-trade first; contract status, bid/ask spread, minimum order rules and slippage have not been live-verified.

The `risk-context` service now maps `TAOUSDT` to `TAO` (not `TAO` via hardcoded first-3-character mistakes for LINK and BNB); the event calendar remains manually maintained and does not cover token-specific events automatically.

## Setup

1. Preserve your existing `.env.local` and `.signal-alerts/state.json`; never share bot tokens.
2. Install dependencies: `npm install` (the uploaded archive did not contain a lockfile).
3. Run `npm run typecheck`, `npm test`, and `npm run build`.
4. Check `/api/pro?symbol=TAOUSDT&interval=1h`, `/api/strategy-research?symbol=LINKUSDT` and `/historical-data`.
5. For Telegram: start with `ALERT_DRY_RUN=true`, `ALERT_EXTRA_SYMBOLS_ENABLED=true` and `npm run alerts:monitor`. Only after checking feed health and backtests switch to live delivery.

**Limitations:** Cannot claim improved profitability, guaranteed signals or live Binance futures availability from source changes alone. All market-data REST endpoints remain Binance-dependent. 5m strategy's 85/100 threshold and regular strategy's 75/100 remain unchanged. Research strategy is not auto-promoted to alerts.
