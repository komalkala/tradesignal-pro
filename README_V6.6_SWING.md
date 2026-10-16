# V6.6 — Swing Research (1D / 4H / 1H)

This package extends V6.5 without changing existing trade/sentiment workers. `src/lib/swing-research.ts` implements a **research-only** 1-hour strategy using *already closed* 1-day and 4-hour candles. `src/app/api/swing-research/route.ts` and `/swing-research` provide historical simulation, training/holdout split, and latest completed candle diagnostics.

## Run

```bash
npm install
npm run typecheck
npm test
npm run dev
```

Open `/swing-research`. It fetches Binance USDT Futures historical OHLCV. No API keys needed for historical klines.

## Design

- 1D EMA50/200 market bias; 4H EMA50/200 trend; 1H EMA20 reclaim/rejection, RSI, MACD, volume > 1.05x trailing 20-bar average, 6-bar structural breakout. Fully completed candles only.
- Next-hour open fill, stop-first within-bar tie, ATR1.5 stop, 2R target, max 72 bars hold, risk 0.5%/trade, 0.05% fee per side, 0.02% slippage per side, nonoverlapping trades.
- **Important limitations:** historical funding, liquidation, regime-specific tuning, exchange restrictions, spreads and gap/slippage stress not validated. 3000 1h bars ≈125 days, NOT multi-year validation. Chronological 70/30 is not a genuine optimization walk-forward. Strategy remains experimental, not recommended for live trading. The latest setup uses the last completed historical candle, not a continuously running monitoring daemon.
- There are no V6.6 Telegram alerts, auto orders, or claimed performance improvements.

## Follow-up validation roadmap

To claim robust swing performance, collect 1–2+ years 1h/4h/1d data; add separate historical funding/open-interest datasets where available, run rolling walk-forward over multiple regimes, track net returns after realistic execution, then run live forward **paper** signals with journalled outcomes. Existing Telegram alerts are unchanged.
