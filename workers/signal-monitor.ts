/**
 * TradeSignal Pro — read-only completed-candle Telegram monitor.
 * Keeps the existing 5m quick and 15m/1h/4h/1d engines.
 * State lives on persistent disk; run exactly ONE worker process.
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getCandles } from '../src/lib/binance';
import { profile, qualitySignal } from '../src/lib/pro';
import { evaluateQuickSignal, QUICK_MIN_SCORE } from '../src/lib/quick-signal';
import { sendTelegramMessage } from '../src/lib/alerts/telegram';
import {
  WATCH_SYMBOLS, ADDITIONAL_SYMBOLS, alertKey, closeMs, formatSignalAlert,
  freshestComplete, higherInterval, isConfirmed, isFresh, INTERVAL_MS,
} from '../src/lib/alerts/logic';
import type { Candle, Interval, SymbolId } from '../src/lib/types';
const MONITORED_SYMBOLS: readonly SymbolId[] = process.env.ALERT_EXTRA_SYMBOLS_ENABLED === 'true' ? [...WATCH_SYMBOLS, ...ADDITIONAL_SYMBOLS] : WATCH_SYMBOLS;

type AnyInterval = Interval | '1w';
type State = { version: 1; lastEvaluated: Record<string, number>; sent: Record<string, string> };
const emptyState = (): State => ({ version: 1, lastEvaluated: {}, sent: {} });
const dryRun = process.env.ALERT_DRY_RUN === 'true';
const sendOnStart = process.env.ALERT_SEND_ON_START === 'true';
const quickEnabled = process.env.ALERT_QUICK_ENABLED === 'true';
// Legacy economic-event reminders removed. V7_EVENTS_JSON + V7 worker are the single source.
// Default to 1h/4h swing monitoring; 15m/1d remain opt-in.
const WATCH_INTERVALS: readonly Interval[] = (process.env.ALERT_WATCH_INTERVALS ?? '1h,4h')
  .split(',').map(x => x.trim()).filter((x): x is Interval =>
    ['15m','1h','4h','1d'].includes(x));
if (!WATCH_INTERVALS.length) throw Error('ALERT_WATCH_INTERVALS must include 15m, 1h, 4h or 1d');
const pollRaw = Number(process.env.ALERT_POLL_MS ?? '60000');
const pollMs = Number.isFinite(pollRaw) ? Math.max(30_000, pollRaw) : 60_000;
const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
const stateFile = path.resolve(process.cwd(), dryRun ? '.signal-alerts/state.dry-run.json' : '.signal-alerts/state.json');
let state: State = emptyState();
let running = false;
let stopping = false;
let currentFetchCache = new Map<string, Promise<Candle[]>>();

function log(message: string) { console.log(`[${new Date().toISOString()}] ${message}`); }
function errorText(e: unknown) { return e instanceof Error ? e.message : String(e); }

async function persist(): Promise<void> {
  await mkdir(path.dirname(stateFile), { recursive: true });
  const tmp = `${stateFile}.tmp`;
  await writeFile(tmp, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  await rename(tmp, stateFile);
}
async function loadState(): Promise<boolean> {
  try {
    const raw: unknown = JSON.parse(await readFile(stateFile, 'utf8'));
    if (!raw || typeof raw !== 'object') throw Error('Invalid state');
    const s = raw as Partial<State>;
    if (s.version !== 1 || !s.lastEvaluated || !s.sent ||
      typeof s.lastEvaluated !== 'object' || typeof s.sent !== 'object') throw Error('Unsupported state version');
    state = { version: 1, lastEvaluated: s.lastEvaluated, sent: s.sent };
    return true;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw Error(`Cannot load ${stateFile}: ${errorText(e)}`);
  }
}
function cachedCandles(symbol: SymbolId, interval: AnyInterval, limit = 700) {
  const key = `${symbol}:${interval}:${limit}`;
  const existing = currentFetchCache.get(key);
  if (existing) return existing;
  const promise = getCandles(symbol, interval, limit);
  currentFetchCache.set(key, promise);
  return promise;
}
function describeChecks(q: ReturnType<typeof qualitySignal>) {
  const missing = q.checks.filter(x => !x.passed).map(x => x.id);
  return `decision=${q.decision} score=${q.score}/100 long=${q.longScore} short=${q.shortScore}` +
    (missing.length ? ` failed=[${missing.join(',')}]` : '') +
    (q.vetoes.length ? ` vetoes=[${q.vetoes.join('; ')}]` : '');
}
function eligible(bars: Candle[], interval: AnyInterval, asOf: number): Candle[] {
  const out = bars.filter(c => closeMs(c, interval) <= asOf);
  const last = out.at(-1);
  if (!last) throw Error(`No closed ${interval} context`);
  const age = asOf - closeMs(last, interval);
  if (age < 0 || age > 2 * INTERVAL_MS[interval]) throw Error(`Stale ${interval} context, age=${Math.round(age/60000)}m`);
  return out;
}
function pruneSent() {
  const keys = Object.keys(state.sent);
  if (keys.length > 1000) for (const key of keys.slice(0, keys.length - 1000)) delete state.sent[key];
}
async function dispatch(id: string, message: string, side: string): Promise<void> {
  if (state.sent[id]) return;
  if (dryRun) {
    log(`DRY RUN ${id}: ${side} (no Telegram delivery)`);
    return; // a dry-run must never be recorded as sent
  }
  await sendTelegramMessage(token!, chatId!, message);
  state.sent[id] = side; // only after Telegram confirms success
  log(`SENT ${id}: ${side}`);
}
async function analyzeRegular(symbol: SymbolId, interval: Interval, now: number) {
  const hi = higherInterval(interval);
  const base = await cachedCandles(symbol, interval);
  const last = freshestComplete(base, interval, now);
  if (!last || !isFresh(last, interval, now)) {
    log(`${symbol} ${interval}: stale/missing base candle`);
    return;
  }
  const key = `${symbol}:${interval}`;
  if ((state.lastEvaluated[key] ?? -1) >= last.time) return;
  const asOf = closeMs(last, interval);
  const [higher, btc] = await Promise.all([
    cachedCandles(symbol, hi), cachedCandles('BTCUSDT', hi),
  ]);
  const q = qualitySignal({
    candles: base.filter(c => c.time <= last.time),
    higher: profile(eligible(higher, hi, asOf)),
    btc: profile(eligible(btc, hi, asOf)), symbol,
  });
  log(`${symbol} ${interval}: ${describeChecks(q)}`);
  if (isConfirmed(q)) await dispatch(alertKey(symbol, interval, last),
    formatSignalAlert({ symbol, interval, candle: last, signal: q }), q.decision);
  state.lastEvaluated[key] = last.time;
  pruneSent();
  await persist();
}
async function analyzeQuick(symbol: SymbolId, now: number) {
  const base = await cachedCandles(symbol, '5m');
  const last = freshestComplete(base, '5m', now);
  if (!last || !isFresh(last, '5m', now)) {
    log(`${symbol} QUICK: stale/missing 5m candle`);
    return;
  }
  const key = `${symbol}:quick:5m`;
  if ((state.lastEvaluated[key] ?? -1) >= last.time) return;
  const asOf = closeMs(last, '5m');
  const [fifteen, hourly, btcHourly] = await Promise.all([
    cachedCandles(symbol, '15m'), cachedCandles(symbol, '1h'), cachedCandles('BTCUSDT', '1h'),
  ]);
  const evaluation = evaluateQuickSignal({
    candles: base.filter(c => c.time <= last.time),
    fifteen: eligible(fifteen, '15m', asOf),
    hourly: eligible(hourly, '1h', asOf),
    btcHourly: eligible(btcHourly, '1h', asOf), symbol,
  });
  const q = evaluation.signal;
  log(`${symbol} QUICK: ${describeChecks(q)} quickThreshold=${QUICK_MIN_SCORE} confirmed=${evaluation.confirmed} reason=${evaluation.reason}`);
  if (evaluation.confirmed && isConfirmed(q)) {
    const message = [
      `⚡ QUICK ${q.decision} — ${symbol} (5m)`,
      `Confirmed at ${new Date(asOf).toISOString()}`,
      `15m + 1h confirmed; score ${q.score}/100 (not win probability)`,
      `Reference entry: ${q.entry?.toFixed(4)}`,
      `Stop: ${q.stop?.toFixed(4)} | Target: ${q.target?.toFixed(4)}`,
      'Research horizon up to 60 minutes; NO automatic exit or order',
      'No daily alert cap; research only. Futures involve high risk.',
    ].join('\n');
    await dispatch(`${symbol}:QUICK:5m:${last.time}`, message, q.decision);
  }
  state.lastEvaluated[key] = last.time;
  pruneSent();
  await persist();
}
async function scan() {
  if (running || stopping) return;
  running = true;
  currentFetchCache = new Map();
  const started = Date.now();
  try {
    // 5m checks first, instead of waiting for 12 regular markets.
    if (quickEnabled) {
      for (const symbol of MONITORED_SYMBOLS) {
        if (stopping) return;
        try { await analyzeQuick(symbol, Date.now()); }
        catch (e) { log(`${symbol} QUICK ERROR: ${errorText(e)}`); }
      }
    }
    for (const interval of WATCH_INTERVALS) {
      for (const symbol of MONITORED_SYMBOLS) {
        if (stopping) return;
        try { await analyzeRegular(symbol, interval, Date.now()); }
        catch (e) { log(`${symbol} ${interval} ERROR: ${errorText(e)}`); }
      }
    }
  } finally {
    currentFetchCache.clear();
    running = false;
    log(`Scan finished in ${((Date.now() - started)/1000).toFixed(1)}s`);
  }
}
async function baseline() {
  log('First run: baselining latest candles; no historical alerts will be sent.');
  let count = 0;
  const markets: {symbol: SymbolId; interval: Interval; key: string}[] = [];
  for (const symbol of MONITORED_SYMBOLS) {
    if (quickEnabled) markets.push({symbol, interval: '5m', key: `${symbol}:quick:5m`});
    for (const interval of WATCH_INTERVALS) markets.push({symbol, interval, key: `${symbol}:${interval}`});
  }
  for (const {symbol, interval, key} of markets) {
    try {
      const candles = await getCandles(symbol, interval, 250);
      const last = freshestComplete(candles, interval, Date.now());
      if (last && isFresh(last, interval, Date.now())) {
        state.lastEvaluated[key] = last.time;
        count++;
      }
    } catch (e) { log(`Baseline ${symbol} ${interval}: ${errorText(e)}`); }
  }
  if (count === 0) throw Error('No accessible Binance markets during baseline. Worker not started.');
  await persist();
  log(`Baselined ${count}/${markets.length} markets`);
}
async function main() {
  if ((!token || !chatId) && !dryRun) throw Error('Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env.local');
  if (process.argv.includes('--test')) {
    if (dryRun) log('DRY RUN: Telegram test not delivered');
    else await sendTelegramMessage(token!, chatId!, '✅ TradeSignal Pro Telegram connection test (not a signal).');
    log('Test completed');
    return;
  }
  const loaded = await loadState();
  if (!loaded && !sendOnStart) await baseline();
  if (loaded && !sendOnStart && quickEnabled) {
    for (const symbol of MONITORED_SYMBOLS) {
      const key = `${symbol}:quick:5m`;
      if (state.lastEvaluated[key] != null) continue;
      try {
        const candles = await getCandles(symbol, '5m', 250);
        const last = freshestComplete(candles, '5m', Date.now());
        if (last) state.lastEvaluated[key] = last.time;
      } catch (e) { log(`Quick baseline ${symbol}: ${errorText(e)}`); }
    }
    await persist();
  }
  log(`Watching ${MONITORED_SYMBOLS.join(',')} at ${WATCH_INTERVALS.join(',')} + quick=${quickEnabled}; poll=${pollMs/1000}s dryRun=${dryRun}`);
  await scan();
  const timer = setInterval(() => { void scan().catch(e => log(`SCAN ERROR: ${errorText(e)}`)); }, pollMs);
  const shutdown = () => { stopping = true; clearInterval(timer); log('Shutdown requested'); };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
void main().catch(e => { console.error(`Worker failed: ${errorText(e)}`); process.exitCode = 1; });
