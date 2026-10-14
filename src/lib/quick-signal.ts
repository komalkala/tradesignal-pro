import type { Candle, SymbolId } from './types';
import { profile, qualitySignal } from './pro';
import type { Quality } from './pro';
import { closedAt } from './closed-at';

export const QUICK_INTERVAL_MS = { '5m': 300_000, '15m': 900_000, '1h': 3_600_000 } as const;
export const QUICK_MIN_SCORE = 85;
export const QUICK_MAX_HOLD_MINUTES = 60;
export type QuickEvaluation = { signal: Quality; confirmed: boolean; reason: string };

/** Only uses candles whose close time is <= decision time. No ongoing candles leak in. */
export function evaluateQuickSignal(args: {
  candles: Candle[]; fifteen: Candle[]; hourly: Candle[]; btcHourly: Candle[];
  symbol: SymbolId; minScore?: number; rewardRatio?: number; atrMultiple?: number;
}): QuickEvaluation {
  const { candles, fifteen, hourly, btcHourly, symbol } = args;
  const last = candles.at(-1);
  if (!last || candles.length < 210) throw new Error('Insufficient 5m history');
  const at = last.time + QUICK_INTERVAL_MS['5m'];
  const i15 = closedAt(fifteen, at, QUICK_INTERVAL_MS['15m']);
  const i1h = closedAt(hourly, at, QUICK_INTERVAL_MS['1h']);
  const ibtc = closedAt(btcHourly, at, QUICK_INTERVAL_MS['1h']);
  if (i15 < 205 || i1h < 205 || ibtc < 205) throw new Error('Insufficient closed higher timeframe history');
  const fifteenClosed = fifteen.slice(Math.max(0, i15 - 499), i15 + 1);
  const hourlyClosed = hourly.slice(Math.max(0, i1h - 499), i1h + 1);
  const btcClosed = btcHourly.slice(Math.max(0, ibtc - 499), ibtc + 1);
  const h15 = profile(fifteenClosed);
  const h1 = profile(hourlyClosed);
  const btc = profile(btcClosed);
  const signal = qualitySignal({
    candles: candles.slice(-500), higher: h15, btc, symbol,
    rr: args.rewardRatio ?? 2, atrMult: args.atrMultiple ?? 1.5,
  });
  const confirmed = signal.decision !== 'WAIT' &&
    signal.score >= (args.minScore ?? QUICK_MIN_SCORE) &&
    signal.vetoes.length === 0 &&
    h1.trend === (signal.decision === 'LONG' ? 'BULLISH' : 'BEARISH') &&
    signal.entry != null && signal.stop != null && signal.target != null;
  return {
    signal,
    confirmed,
    reason: confirmed ? 'All 5m, 15m, 1h and BTC filters passed' :
      signal.decision === 'WAIT' ? 'Original quality filters did not confirm' :
      h1.trend !== (signal.decision === 'LONG' ? 'BULLISH' : 'BEARISH') ? '1h trend disagrees' :
      `Score ${signal.score} below quick threshold ${args.minScore ?? QUICK_MIN_SCORE}`,
  };
}
