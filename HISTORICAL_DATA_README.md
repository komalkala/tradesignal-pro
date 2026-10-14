# Historical Market Movement add-on (V5.2)

Existing dashboard, strategy, alerts, and backtests remain unchanged.

## Route
Open `http://localhost:3000/historical-data`.

## Features
- Four years of completed Binance USD-M futures daily candles (BTC, SOL, ETH)
- 25-row pages, filters for bullish/bearish/high range days, sortable change and range, date filter
- Expand any day for 1-hour or 5-minute UTC candle table, download CSV
- Daily and intraday rows have OHLC and quote volume; daily trade count is returned by API
- Server-side Binance endpoint and guarded, paginated kline requests; no credentials required

## Important limits
- Four-year daily coverage is up to the exchange's available contract history.
- UTC dates; unfinished candles are excluded. One day is fetched on demand for intraday detail.
- Historical-data endpoint is intended for manual research; it does not change trading signals.
- You need connectivity to `fapi.binance.com` from your Next.js server.
- Public deployments may benefit from persistent server-side caching and per-IP rate limits.

## Start
`npm install` then `npm run dev`. Open `/historical-data`.
