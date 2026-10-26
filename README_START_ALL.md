# Start everything from ONE terminal (V7.1)

## Setup
1. Ensure Node.js 20+ and `npm install` completed.
2. Keep your existing `.env.local`; add missing keys from `.env.example`. Never commit or share real bot tokens.
3. IMPORTANT: define `ALERT_DRY_RUN` **only once** in `.env.local`. `true` means no real Telegram sends; `false` enables real Telegram messages (but does not place Binance orders). All three Telegram workers plus the V7 worker share this switch.
4. If your Telegram credentials have been exposed, regenerate the bot token with BotFather.
5. Stop all previously running npm monitor/dev terminals first to prevent double processing and duplicate journal writes.

## Run
```bash
npm install
npm run dev:all:check
npm run dev:all
```

Only one terminal is needed. The app logs show `[WEB]`, `[SIGNALS]`, `[SENTIMENT]`, `[ORDER-FLOW]`, `[V7-SWING]`, and `[JOURNAL]` prefixes. The `dev:all` launcher starts the web app, original/QUICK Telegram signals, Fear & Greed/RSI digest, buyer/seller + volume worker, V7 swing/event worker, and V7.1 journal. It skips optional workers disabled with their respective `*_TELEGRAM_ENABLED` switches. On unexpected exits it attempts to restart with a bounded backoff. `Ctrl+C` stops all managed child processes.

Dashboard: `http://localhost:3000`, or the port Next.js announces if 3000 is occupied.

## Caveats
- `V7_TELEGRAM_ENABLED=true` is **required** for the V7 paper swing/event Telegram worker to send messages; this setting is independent of `ALERT_DRY_RUN=false`.
- The V7 event monitor does **not** automatically fetch economic dates. `V7_EVENTS_JSON` must contain verified real events or no CPI/FOMC Telegram event reminders will be sent. Event warnings NEVER block trades.
- The monitoring workers must keep running; closing the terminal stops alerts and journal updates.
- `.signal-alerts/` contains persistent state. Do not delete it or run multiple journals against one state file.
- Next.js dev server is for local development. For an always-on server, use a real process supervisor/host and persistent volumes.
- Monitor REST request rates and Binance limits when all modules run together. All signals are research / paper-only; no orders are placed.
