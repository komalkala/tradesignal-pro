# V7 Add-on — Buyer/Seller Pressure & Volume

- Visit `/order-flow` or use the V7 nav link.
- API: `/api/order-flow?symbol=BTCUSDT` (all six configured symbols supported).
- Aggressive execution buys/sells come from Binance USDT-M Futures **recent 1000 aggregate trades**. The Binance `m` field is `isBuyerMaker`: `m=false` means buyer taker/aggressive buy; `m=true` means seller taker/aggressive sell.
- Pressure is BUYERS_DOMINANT when buy% > sell% by 10 percentage points; SELLERS_DOMINANT vice versa; otherwise BALANCED. This threshold is an illustrative classification, not independently validated.
- 1h/4h high volume >= 1.5x previous 20 **closed** candles, low <= 0.7x, else normal. Thresholds are heuristics, not profitable trading signals.
- Does **not** see future traders entering the market, identify institutions, or guarantee trend changes. A buyer and seller exist on each trade.
- Recent 1000 trades span variable minutes/seconds depending on market activity. This is NOT whole-hour order flow.
- Read-only, manual decision. No orders. Telegram integration not included in this add-on; existing workers unchanged.
- This uploaded source snapshot does NOT contain package.json, so full npm typecheck/build and tests could not be run here. Copy its `src` and `tests` additions into the full Next.js project, then run `npm run typecheck && npm test && npm run build`.

## Optional Telegram pressure alerts

Included: `workers/order-flow-monitor.ts`. It runs **independently** of the existing trade alert workers, and alerts only on a switch to BUYERS_DOMINANT or SELLERS_DOMINANT or on newly closed HIGH-volume 1h/4h candles. LOW volume remains visible in the dashboard; it is not spammed to Telegram. The first scan creates a baseline to avoid false 'new' alerts. State is persisted in `.signal-alerts/order-flow.json` or `.signal-alerts/order-flow.dry-run.json`.

Add to `.env.local`:

```env
ORDER_FLOW_TELEGRAM_ENABLED=true
ORDER_FLOW_POLL_MINUTES=5
ORDER_FLOW_SYMBOLS=BTCUSDT,ETHUSDT,SOLUSDT,TAOUSDT,LINKUSDT,BNBUSDT
ALERT_DRY_RUN=true
```

Then run with your installed `tsx` (from the existing project dependencies):

```bash
node --env-file=.env.local --import tsx workers/order-flow-monitor.ts
```

After confirming the logs, `ALERT_DRY_RUN=false` sends actual Telegram notifications (and also changes the behavior of existing workers that use that flag). Keep your existing Telegram bot credentials private. The monitor doesn't place orders or interfere with V7 news warnings. Buyer/seller percentage is not a probability that price will rise/fall. Persistent state changes only after successful delivery, so temporary Telegram failure is retried on a later scan.
