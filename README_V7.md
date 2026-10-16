# TradeSignal Pro V7 — Phase 1 Research + Economic Warnings

## New pages and modules
- `/v7`: Swing Decision Center, separate from existing backtest. Status: CONFIRMED LONG/SHORT, SETUP FORMING, WAIT, INSUFFICIENT_DATA. Displays passed/failed criteria, 1D/4H/1H context, latest completed 1H candle time, and event cautions.
- `/api/v7?symbol=BTCUSDT`: JSON API for the above.
- `src/lib/v7-decision.ts`: Independent diagnostics on top of unchanged V6.6 evaluation rules.
- `src/lib/v7-events.ts`: Verified, operator-configured calendar and *nonblocking* market caution.
- `workers/v7-monitor.ts`: Separate research-only paper Telegram alerts + 24h, 60min, 15min event reminders. Not part of existing alerts or sentiment worker.

## Install & run
`npm install && npm run typecheck && npm test && npm run build && npm run dev`.
Navigate to `/v7` on port 3000, or port 3001 if Next picks that port.

For V7 Telegram use `npm run v7:monitor` in a separate terminal. `.env.local` example:

```
ALERT_DRY_RUN=true
V7_TELEGRAM_ENABLED=true
V7_POLL_MS=60000
V7_SETUP_FORMING_ALERTS=false
V7_SYMBOLS=BTCUSDT,ETHUSDT,SOLUSDT,TAOUSDT,LINKUSDT,BNBUSDT
# Existing TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID used
# UTC ISO8601 times must be VERIFIED against official schedules!
V7_EVENTS_JSON=[{"id":"example-cpi","name":"EXAMPLE ONLY - REMOVE AND REPLACE","timeUTC":"2030-01-01T13:30:00Z","impact":"CRITICAL","source":"https://www.bls.gov/schedule/news_release/cpi.htm"}]
```

**Remove illustrative example event** and replace with verified future release data before live alerts. When `V7_EVENTS_JSON` is absent/empty, no events are listed and no economic alerts can fire. This does not mean there are no economic events. The official source links are displayed on the dashboard. This is a configuration-driven calendar, **not an automatically synchronized calendar**.

`ALERT_DRY_RUN=true` suppresses actual Telegram sends. To send V7 paper notifications, set `ALERT_DRY_RUN=false`, `V7_TELEGRAM_ENABLED=true` and restart the worker. This also impacts existing alert workers. `V7_TELEGRAM_ENABLED=false` disables V7 sends independently.

First start saves a baseline for current 1h setup and does not replay prior trade signals. A confirmed setup message does not imply Binance orders or a proven winning strategy. Event warnings never block entries, and trading decisions remain manual.

## Scope & limitations
- **Phase 1 only**: no comprehensive zero-trade rejection *statistics*, no multi-year historical backtest, no funding-adjusted performance validation, no persistent outcome journal, no automated economic calendar sync, no unplanned-news feed. Those require additional implementation and testing.
- Original V6.6 signal logic preserved; V7 added transparent per-check diagnostics and setup-forming states. It does not fabricate extra confirmed trades.
- Telegram delivery requires outbound connectivity and credentials. Paper-only.
- Event reminders at 15 minutes depend on continuously running the V7 worker with a 1-minute poll. If the worker stops, notifications may be missed. Scheduler does not enforce an event blackout.
