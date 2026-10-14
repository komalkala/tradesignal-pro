# TradeSignal Pro V5.4 — Signal Diagnostics Add-on

This adds a **Signal engine health** panel to the existing main trading dashboard without changing signal thresholds, Binance API routes, backtesting, Telegram monitoring, or market intelligence.

The panel displays the last closed candle time, next expected close, last REST refresh, health of indicator history, manual risk-guard status, exact PASS/FAIL strategy checks and veto reasons. It distinguishes an actual API/data error from an ordinary WAIT signal. It **does not** monitor Telegram process health (a different process) and **does not** certify the signals as profitable.

Install: `npm install`, `npm run typecheck`, `npm test`, `npm run dev`. Navigate to `/`.

Notes: For intervals 15m, 1h, 4h and 1d the panel uses the REST snapshot's close timestamp. A brief delay between candle close and Binance publication is normal. The panel does not alter scoring. The checks describe the best candidate side; the dashboard already supports viewing the SHORT alternative. All times on the panel are UTC.
