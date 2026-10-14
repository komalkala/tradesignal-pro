# TypeScript weekly interval + quick candle diagnostics

This is the V5.4 project with additive fixes only.

- `src/lib/binance.ts`: `getCandles` now accepts `Interval | "1w"` for daily-to-weekly context.
- `src/lib/alerts/logic.ts`: 5m interval duration and mapping retained.
- `workers/signal-monitor.ts`: stale 5m logs include timestamps and age to distinguish feed/clock problems from strategy WAIT.

## Windows setup

Do not overwrite your existing secret `.env.local`. Copy it securely from the old folder into the new folder if creating a new project directory. Never commit it. Revoke previously exposed Telegram bot tokens.

```powershell
npm install
npm run typecheck
npm test
npm run alerts:monitor
```

Run `npm run dev` in a separate terminal for the dashboard. There is no real-money execution. A stale data message is a safety block, not proof of a signal.
