import { INTERVALS, SYMBOLS, type Interval, type SymbolId } from './types';

export type MarketParams = { symbol: SymbolId; interval: Interval };

export function parseMarketParams(searchParams: URLSearchParams): MarketParams | { error: string } {
  const rawSymbol = searchParams.get('symbol') ?? 'SOLUSDT';
  const rawInterval = searchParams.get('interval') ?? '1h';
  const symbol = rawSymbol.trim().replace(/[\s/_-]/g, '').toUpperCase();
  const interval = rawInterval.trim().toLowerCase();

  if (!SYMBOLS.some((s) => s === symbol) || !INTERVALS.some((t) => t === interval)) {
    return {
      error: `Invalid symbol or timeframe (received symbol=${JSON.stringify(rawSymbol)}, interval=${JSON.stringify(rawInterval)}). Allowed symbols: ${SYMBOLS.join(', ')}; intervals: ${INTERVALS.join(', ')}.`,
    };
  }

  return { symbol: symbol as SymbolId, interval: interval as Interval };
}
