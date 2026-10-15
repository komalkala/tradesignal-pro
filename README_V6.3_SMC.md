# TradeSignal Pro — separate SMC research comparator

Open `http://localhost:3000/smc-compare` (or your running Next.js port).

- Existing 5m quick strategy and experimental SMC are evaluated **separately** on the same candle history.
- SMC detection includes confirmed swing structure breaks (BOS/CHoCH), last opposite-candle Order Block heuristics, and 3-candle FVG.
- Experimental entry: most recent structure break followed by a same-direction FVG/order-block zone retest, plus a volatility-bounded stop. This is intentionally simple, not a claim of institutional order-flow inference.
- Both replays use next-bar execution, 0.05% taker fee per side, 0.02% adverse slippage per side, 0.5% risk budget, 60-minute max hold, stop-first OHLC resolution, 750 USDT starting balance.
- **Important:** The strategies have different entry criteria; training/holdout windows and execution assumptions are comparable but this is not a controlled scientific proof. The SMC candidate uses candle-close prices to set hypothetical levels and verifies gap at next-bar entry.
- 70/30 split shows post-hoc segmented results; it is not rolling optimized walk-forward training. 1,500–5,000 5m bars spans about 5–17 days only. Favor much longer data for conclusions.
- This is **read-only**: live Telegram, quick alerts and existing dashboard signal rules are not modified.
- Setup: extract into existing project and run `npm install`, `npm run typecheck`, `npm test`, `npm run build`. This archive includes the existing app too.
- APIs: `/api/smc-compare?symbol=SOLUSDT&bars=2500`.
- Do not overwrite `.env.local` or `.signal-alerts/state.json`.
