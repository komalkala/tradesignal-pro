/**
 * Local Telegram monitor. Independent of Next.js browser and page lifecycle.
 * Run from project root: npm run alerts:monitor
 * Uses exactly the dashboard's qualitySignal() logic, on completed candle arrays.
 */
import { readFile, mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getCandles } from '../src/lib/binance';
import { profile, qualitySignal } from '../src/lib/pro';
import type { Candle, Interval, SymbolId } from '../src/lib/types';
import {
  WATCH_INTERVALS, WATCH_SYMBOLS, alertKey, closeMs, formatSignalAlert,
  freshestComplete, higherInterval, isConfirmed, isFresh,
} from '../src/lib/alerts/logic';
import { sendTelegramMessage } from '../src/lib/alerts/telegram';
import { evaluateQuickSignal, QUICK_MIN_SCORE } from '../src/lib/quick-signal';
import { riskContext, utcDay } from '../src/lib/event-risk';

const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
const pollMs = Math.max(30_000, Number(process.env.ALERT_POLL_MS) || 60_000);
const stateFile = path.resolve(process.cwd(), '.signal-alerts/state.json');
const dryRun = process.env.ALERT_DRY_RUN === 'true';
const sendOnStart = process.env.ALERT_SEND_ON_START === 'true';

type State = { version: 1; lastEvaluated: Record<string, number>; sent: Record<string, string> };
let state: State = { version: 1, lastEvaluated: {}, sent: {} };
let running = false;
let stopping = false;

function log(message: string): void { console.log(`[${new Date().toISOString()}] ${message}`); }
async function persist(): Promise<void> {
  await mkdir(path.dirname(stateFile), { recursive: true });
  const tmp = stateFile + '.tmp';
  await writeFile(tmp, JSON.stringify(state, null, 2) + '\n', { mode: 0o600 });
  await rename(tmp, stateFile);
}
async function loadState(): Promise<boolean> {
  try {
    const loaded = JSON.parse(await readFile(stateFile, 'utf8')) as Partial<State>;
    if (loaded.version !== 1 || !loaded.lastEvaluated || !loaded.sent) throw Error('Unsupported state format');
    state = { version: 1, lastEvaluated: loaded.lastEvaluated, sent: loaded.sent };
    return true;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw new Error(`Cannot load alert state: ${(e as Error).message}. Repair or back up ${stateFile} before continuing.`);
  }
}

// Higher-timeframe candles must have CLOSED before the entry candle closes.
// This ensures that no developing higher-timeframe candle leaks into the signal.
async function analyze(symbol: SymbolId, interval: Interval, now: number) {
  const hi = higherInterval(interval);
  const [base, higher, btc] = await Promise.all([
    getCandles(symbol, interval, 700),
    getCandles(symbol, hi, 300),
    getCandles('BTCUSDT', hi, 300),
  ]);
  const last = freshestComplete(base, interval, now);
  if (!last || !isFresh(last, interval, now)) {
    log(`${symbol} ${interval}: stale or missing completed candles, no alert`);
    return;
  }
  const key = `${symbol}:${interval}`;
  // On recheck of the same candle never re-notify, including after restart.
  if ((state.lastEvaluated[key] ?? -1) >= last.time) return;

  const asOf = closeMs(last, interval);
  const eligibleHigher = higher.filter(c => closeMs(c, hi) <= asOf);
  const eligibleBTC = btc.filter(c => closeMs(c, hi) <= asOf);
  // Do not use current/unfinished HTF candle or a significantly lagging stream.
  if (!eligibleHigher.length || !eligibleBTC.length) {
    log(`${symbol} ${interval}: higher-timeframe data unavailable`);
    return;
  }
  const hLast = eligibleHigher.at(-1)!;
  const bLast = eligibleBTC.at(-1)!;
  if (asOf - closeMs(hLast, hi) > 2 * (hi === '1w' ? 604800000 : hi === '1d' ? 86400000 : hi === '4h' ? 14400000 : 3600000) ||
      asOf - closeMs(bLast, hi) > 2 * (hi === '1w' ? 604800000 : hi === '1d' ? 86400000 : hi === '4h' ? 14400000 : 3600000)) {
    log(`${symbol} ${interval}: higher-timeframe candles stale`);
    return;
  }

  const signal = qualitySignal({
    candles: base.filter(c => c.time <= last.time),
    higher: profile(eligibleHigher), btc: profile(eligibleBTC), symbol,
  });
  const id = alertKey(symbol, interval, last);
  const confirmed = isConfirmed(signal);
  if (confirmed && !state.sent[id]) {
    if (dryRun) log(`DRY RUN ${id}: ${signal.decision} score ${signal.score}`);
    else {
      await sendTelegramMessage(token!, chatId!, formatSignalAlert({ symbol, interval, candle: last, signal }));
      log(`Sent confirmed ${signal.decision} alert: ${id}`);
    }
    state.sent[id] = signal.decision;
  } else log(`${symbol} ${interval}: ${signal.decision} ${signal.score}/100`);
  state.lastEvaluated[key] = last.time;
  // Keep dedupe record bounded; evaluated watermark is preserved for each market.
  const ids = Object.keys(state.sent);
  if (ids.length > 1000) for (const old of ids.slice(0, ids.length - 1000)) delete state.sent[old];
  await persist();
}

// Add-on mode: unlimited distinct 5m alerts, using same exact rules as quick backtest.
// Legacy 15m/1h/4h/1d monitoring above remains unchanged.
async function analyzeQuick(symbol: SymbolId, now: number): Promise<void> {
  const [base, fifteen, hourly, btcHourly] = await Promise.all([
    getCandles(symbol, '5m', 700),
    getCandles(symbol, '15m', 700),
    getCandles(symbol, '1h', 700),
    getCandles('BTCUSDT', '1h', 700),
  ]);
  const last = freshestComplete(base, '5m', now);
  if (!last || !isFresh(last, '5m', now)) {
    const latest = base.at(-1);
    const ageMinutes = last ? (now - closeMs(last, '5m')) / 60_000 : null;
    log(
      `${symbol} QUICK: stale/missing 5m candle; ` +
      `now=${new Date(now).toISOString()}; ` +
      `candles=${base.length}; ` +
      `latestOpen=${latest ? new Date(latest.time).toISOString() : 'NONE'}; ` +
      `lastClosedOpen=${last ? new Date(last.time).toISOString() : 'NONE'}; ` +
      `lastClosedAgeMinutes=${ageMinutes === null ? 'N/A' : ageMinutes.toFixed(2)}`
    );
    return;
  }
  const key = `${symbol}:quick:5m`;
  if ((state.lastEvaluated[key] ?? -1) >= last.time) return;
  // Verify that the latest HTF candles genuinely closed before this 5m candle.
  const asOf = closeMs(last, '5m');
  const ready = (bars: Candle[], interval: '15m' | '1h') => {
    const eligible = bars.filter(c => closeMs(c, interval) <= asOf);
    const recent = eligible.at(-1);
    if (!recent || asOf - closeMs(recent, interval) >= 2 * (interval === '15m' ? 900_000 : 3_600_000)) {
      throw new Error(`Missing or stale ${interval} context`);
    }
    return eligible;
  };
  const evaluation = evaluateQuickSignal({
    candles: base.filter(c => c.time <= last.time),
    fifteen: ready(fifteen, '15m'),
    hourly: ready(hourly, '1h'),
    btcHourly: ready(btcHourly, '1h'), symbol,
  });
  const id = `${symbol}:QUICK:5m:${last.time}`;
  if (evaluation.confirmed && !state.sent[id]) {
    const sig = evaluation.signal;
    const message = [
      `⚡ QUICK ${sig.decision} — ${symbol} (5m)`,
      `Confirmed at ${new Date(asOf).toISOString()}`,
      `15m + 1h trend aligned; score ${sig.score}/100 (not win probability)`,
      `Reference entry: $${sig.entry?.toFixed(4)}`,
      `Stop: $${sig.stop?.toFixed(4)} | Target: $${sig.target?.toFixed(4)}`,
      `Maximum planned holding: 60 minutes`,
      `No daily alert cap • 0.05% fee/side + 0.02% slippage/side assumed in backtest`,
      `Manual decisions only; no position is opened or automatically closed.`,
    ].join('\n');
    if (dryRun) log(`DRY RUN ${id}: ${sig.decision} ${sig.score}/100`);
    else {
      await sendTelegramMessage(token!, chatId!, message);
      log(`Sent QUICK ${sig.decision} alert: ${id}`);
    }
    state.sent[id] = sig.decision;
  } else log(`${symbol} QUICK: ${evaluation.signal.decision} ${evaluation.signal.score}/100 — ${evaluation.reason}`);
  state.lastEvaluated[key] = last.time;
  const ids = Object.keys(state.sent);
  if (ids.length > 1000) for (const old of ids.slice(0, ids.length - 1000)) delete state.sent[old];
  await persist();
}

// Event awareness is informational and additive: does not change confirmed trading signals.
async function scanEventReminders(now:number):Promise<void>{
  if(process.env.ALERT_EVENT_ENABLED!=='true')return;
  const {upcoming}=riskContext(now);
  for(const event of upcoming.filter(e=>e.daysUntil===0||e.daysUntil===1)){
    const key=`EVENT:${event.id}:${event.daysUntil}:${utcDay(now)}`;
    if(state.sent[key])continue;
    const label=event.daysUntil===0?'Scheduled event day (UTC)':'Scheduled event tomorrow (UTC)';
    const message=`📅 TRADE EVENT RISK REMINDER\n${event.title}\n${label}: ${event.dateUTC}\nSource: ${event.source}\nNo directional prediction. Consider spread, volatility and avoiding new entries near the release.`;
    if(dryRun)log(`DRY RUN: ${message}`);
    else await sendTelegramMessage(token!,chatId!,message);
    state.sent[key]='EVENT';await persist();
  }
}

async function scan(): Promise<void> {
  if (running || stopping) return;
  running = true;
  try {
    const now = Date.now();
    try { await scanEventReminders(now); } catch(e) { log(`Event reminder: ${(e as Error).message}`); }
    for (const interval of WATCH_INTERVALS) {
      for (const symbol of WATCH_SYMBOLS) {
        if (stopping) return;
        try { await analyze(symbol, interval, now); }
        catch (e) { log(`${symbol} ${interval}: ${(e as Error).message}`); }
      }
    }
    if (process.env.ALERT_QUICK_ENABLED !== 'false') {
      for (const symbol of WATCH_SYMBOLS) {
        if (stopping) return;
        try { await analyzeQuick(symbol, Date.now()); }
        catch (e) { log(`${symbol} QUICK: ${(e as Error).message}`); }
      }
    }
  } finally { running = false; }
}

async function main(): Promise<void> {
  if ((!token || !chatId) && !dryRun) throw Error('Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env.local');
  if (process.argv.includes('--test')) {
    if (dryRun) log('DRY RUN: would send Telegram test message');
    else await sendTelegramMessage(token!, chatId!, '✅ TradeSignal Pro Telegram connection test. No trading signal.');
    log('Test complete'); return;
  }
  const loaded = await loadState();
  if (!loaded && !sendOnStart) {
    // Baseline existing candles, WITHOUT sending historical signals at startup.
    log('First run: baselining latest closed candles (no startup alerts).');
    let successes = 0;
    for (const interval of WATCH_INTERVALS) for (const symbol of WATCH_SYMBOLS) {
      try {
        const now = Date.now();
        const candles = await getCandles(symbol, interval, 250);
        const last = freshestComplete(candles, interval, now);
        if (last && isFresh(last, interval, now)) {
          state.lastEvaluated[`${symbol}:${interval}`] = last.time;
          successes++;
        }
      } catch (e) { log(`Baseline failed ${symbol} ${interval}: ${(e as Error).message}`); }
    }
    if (process.env.ALERT_QUICK_ENABLED !== 'false') {
      for (const symbol of WATCH_SYMBOLS) {
        try {
          const now = Date.now();
          const candles = await getCandles(symbol, '5m', 250);
          const last = freshestComplete(candles, '5m', now);
          if (last && isFresh(last, '5m', now)) state.lastEvaluated[`${symbol}:quick:5m`] = last.time;
        } catch (e) { log(`Quick baseline failed ${symbol}: ${(e as Error).message}`); }
      }
    }
    if (successes === 0) throw Error('All Binance baseline requests failed. Check network; worker did not start.');
    await persist();
    log(`Baselined ${successes}/12 markets. Future confirmed candles will be evaluated.`);
  }
  if (loaded && !sendOnStart && process.env.ALERT_QUICK_ENABLED !== 'false') {
    for (const symbol of WATCH_SYMBOLS) {
      const key = `${symbol}:quick:5m`;
      if (state.lastEvaluated[key] != null) continue;
      try {
        const candles = await getCandles(symbol, '5m', 250);
        const last = freshestComplete(candles, '5m', Date.now());
        if (last) state.lastEvaluated[key] = last.time;
      } catch(e) { log(`Quick baseline failed ${symbol}: ${(e as Error).message}`); }
    }
    await persist();
  }
  log(`Monitoring ${WATCH_SYMBOLS.join(', ')} on ${WATCH_INTERVALS.join(', ')} every ${pollMs / 1000}s; dryRun=${dryRun}`);
  await scan();
  const timer = setInterval(() => { void scan().catch(e => log(`Scan failed: ${(e as Error).message}`)); }, pollMs);
  const shutdown = () => { stopping = true; clearInterval(timer); log('Stopping worker.'); };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
void main().catch(e => { console.error(`Alert worker failed: ${(e as Error).message}`); process.exitCode = 1; });
