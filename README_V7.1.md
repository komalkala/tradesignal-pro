# V7.1 — Automatic Paper Journal + Zero-Trade Diagnostics

## Routes
- `/trade-journal` — recorded NEW paper signals, simulated entries and exits, metrics.
- `/setup-diagnostics` — why the current V7 engine rejects setups across recent completed 1h candles.

## Start

```bash
npm install
npm run typecheck
npm test
npm run build
npm run dev
```

For persistent paper tracking, **separate terminal**:

```bash
npm run v71:journal
```

The first run only records its startup candle watermarks; it does NOT backfill historical alert setups. Monitoring must stay online. Results only use completed 1h candles. The paper journal is stored in `.signal-alerts/v71-paper-journal.json`, which must be on a persistent, shared disk accessible to the Next.js server. Run only ONE journal worker using a given journal path. If the worker and web process run in different containers, share this state directory using a mounted volume or move to a database later. No Telegram dependencies, no Binance orders, no capital movement. Existing Telegram workers are unchanged.

Optional `.env.local`:

```
V71_JOURNAL_POLL_MS=300000
V71_SYMBOLS=BTCUSDT,ETHUSDT,SOLUSDT,TAOUSDT,LINKUSDT,BNBUSDT
V71_JOURNAL_PATH=.signal-alerts/v71-paper-journal.json
```

## Limitations & model assumptions
- Research-only signals. No profitability has been established. No auto-order execution.
- The journaling worker stores only fresh signals seen **after its startup**. If it was offline during an entry candle, its next polling may be too late; monitor uptime matters.
- Next completed 1h bar open used as paper entry; this is a simulation, not an actual order fill. Stop-first if both stop and target occur within same candle.
- Estimated taker fees of 0.05% each side and slippage of 0.02% each side; funding, gap-based stop execution, liquidation and variable fees not modeled.
- Original V7 swing rules are unmodified, including restrictive same-bar EMA reclaim and structure breakout. Low/zero trade counts remain possible.
- `/setup-diagnostics` counts failed checks as **descriptive** signals, not independently proven causes of losing trades, and not a reason to automatically loosen rules.
- Do not place API credentials or real exchange positions in the journal. Protect the journal and access to the dashboard when deployed publicly.
