# TradeSignal Pro — independent sentiment module

Adds `/sentiment` and `/api/sentiment?interval=1h` (also 4h,1d). Existing trading signals, strategy research and `alerts:monitor` are unchanged.

- Fear & Greed: Alternative.me market-wide index, 0–100. Attribution shown on page and in Telegram. It is NOT coin-specific.
- RSI(14) overbought/oversold for SOL/BTC/ETH/TAO/LINK/BNB on completed Binance Futures candles. >=70 OVERBOUGHT, <=30 OVERSOLD.
- Overbought/oversold is not a trade instruction. This data has no effect on existing Telegram trade alerts.
- Combined digest sent in ONE Telegram message for all six coins (1h RSI) plus global Fear & Greed. Its worker is independent; no 6 separate messages.
- Sends on category changes, or once per 24 hours otherwise. `SENTIMENT_POLL_MINUTES` defaults to 60 (minimum 15). Any incomplete market data suppresses messages rather than claiming everything neutral.
- Starts with one digest immediately when enabled. If not wanted, keep `SENTIMENT_TELEGRAM_ENABLED=false`.
- Dry-run uses independent `.signal-alerts/sentiment.dry-run.json`, live uses `.signal-alerts/sentiment.json`. Do not run duplicate sentiment workers on the same state folder.

## Setup

Add to your existing `.env.local` (do not commit credentials):

```
SENTIMENT_TELEGRAM_ENABLED=true
SENTIMENT_POLL_MINUTES=60
ALERT_DRY_RUN=true
```

`TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are reused from existing project.

Run `npm run typecheck`, `npm test`, `npm run build`, `npm run dev` then open `http://localhost:3000/sentiment` (or whatever port Next chooses).

In another terminal: `npm run sentiment:monitor`. It is separate from `npm run alerts:monitor`; both require a persistent server for 24/7 operation. Change `ALERT_DRY_RUN=false` and restart sentiment worker only after dry-run verification.

Data-fetch errors: alternative.me blocked/unavailable or Binance 4xx/5xx will be reported; not silently replaced with fabricated data.
