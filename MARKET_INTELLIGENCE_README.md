# Market Intelligence / Event Risk Add-on

URL: `/market-intelligence`.

Included: closed-candle confirmed HH/HL/LH/LL market structure, basic trend classification, UTC weekend caution, manually curated FOMC meeting end dates, optional Telegram reminders one UTC date before and on meeting date.

Important: This version **does not** automatically ingest US CPI schedules, ETF flows, token unlocks, Solana outages, or protocol upgrades. Those sources are shown as reference links only. Add official event dates to `src/lib/event-risk.ts` after verifying them. The dashboard clearly marks this gap. Missing events never means market-safe.

Telegram: add `ALERT_EVENT_ENABLED=true` to `.env.local` and restart **one** `npm run alerts:monitor` process. It retains all original alerts and uses the existing sent-state file to deduplicate event messages. Reminders use UTC calendar dates, **not a verified release clock time**. No new trading restriction is enforced automatically.

Structure pivots are only confirmed after three right-hand candles close, preventing look-ahead in displayed structure. Trend classification considers recent confirmed high and low pivots, not macroeconomic direction.

Verification: run `npm install`, `npm run typecheck`, `npm test`, `npm run build` and test `/market-intelligence` locally. Never commit `.env.local` or bot tokens.
