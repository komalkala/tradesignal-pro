import type { Candle, Interval, SymbolId } from '../types';
import type { Quality } from '../pro';

export const WATCH_INTERVALS = ['15m', '1h', '4h', '1d'] as const satisfies readonly Interval[];
export const WATCH_SYMBOLS = ['SOLUSDT', 'BTCUSDT', 'ETHUSDT'] as const satisfies readonly SymbolId[];
export const INTERVAL_MS: Record<Interval | '1w', number> = {
  '5m': 300_000,
  '15m': 900_000,
  '1h': 3_600_000,
  '4h': 14_400_000,
  '1d': 86_400_000,
  '1w': 604_800_000,
};
export function higherInterval(i: Interval): Interval | '1w' {
  return i === '5m' ? '15m' : i === '15m' ? '1h' : i === '1h' ? '4h' : i === '4h' ? '1d' : '1w';
}
export function closeMs(c: Candle, interval: Interval | '1w'): number {
  return c.time + INTERVAL_MS[interval];
}
export function isClosed(c: Candle, interval: Interval | '1w', now: number): boolean {
  return closeMs(c, interval) <= now;
}
export function freshestComplete(c: Candle[], interval: Interval | '1w', now: number): Candle | undefined {
  return c.filter(x => isClosed(x, interval, now)).at(-1);
}
// The latest closed candle is naturally up to one interval old. A small extra grace
// period guards against a stalled exchange feed without treating normal candles as stale.
export function isFresh(c: Candle, interval: Interval, now: number, graceMs = 5 * 60_000): boolean {
  const age = now - closeMs(c, interval);
  return age >= 0 && age <= INTERVAL_MS[interval] + graceMs;
}
export function alertKey(symbol: SymbolId, interval: Interval, candle: Candle): string {
  return `${symbol}:${interval}:${candle.time}`;
}
export function isConfirmed(q: Quality): boolean {
  return (q.decision === 'LONG' || q.decision === 'SHORT') &&
    q.score >= 75 && q.vetoes.length === 0 &&
    Number.isFinite(q.entry) && Number.isFinite(q.stop) && Number.isFinite(q.target);
}
export function formatSignalAlert(input: {
  symbol: SymbolId; interval: Interval; candle: Candle; signal: Quality;
}): string {
  const { symbol, interval, candle, signal } = input;
  const side = signal.decision;
  const fmt = (n: number | null) => n == null ? '—' : '$' + n.toFixed(n >= 1000 ? 2 : 4);
  const mode = interval === '4h' || interval === '1d' ? 'Swing' : 'Intraday';
  return [
    `📊 TradeSignal Pro — ${side === 'LONG' ? '🟢 LONG' : '🔴 SHORT'} confirmed`,
    `Market: ${symbol} · ${interval} · ${mode}`,
    `Score: ${signal.score}/100 (NOT win probability)`,
    `Candle closed: ${new Date(closeMs(candle, interval)).toISOString()}`,
    `Reference entry: ${fmt(signal.entry)}`,
    `Reference stop: ${fmt(signal.stop)}`,
    `Reference target: ${fmt(signal.target)}`,
    'Research signal only • not an executable quote',
    'No order placed. Futures are high risk.',
  ].join('\n');
}
