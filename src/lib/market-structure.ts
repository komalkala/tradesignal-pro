import type { Candle } from './types';

export type SwingPoint = { index: number; time: number; price: number; kind: 'high' | 'low'; tag: 'HH' | 'LH' | 'HL' | 'LL' | 'FIRST' };
export type TrendState = 'UPTREND' | 'DOWNTREND' | 'RANGE / MIXED' | 'INSUFFICIENT DATA';
export type StructureReport = { trend: TrendState; swings: SwingPoint[]; latestHigh: number | null; latestLow: number | null; explanation: string; };
/** Uses only closed candles. A pivot is confirmed RIGHT bars later; never treat it as known at the pivot candle. */
export function marketStructure(candles: Candle[], left = 3, right = 3): StructureReport {
  const data = [...candles].sort((a,b) => a.time-b.time);
  const highs: SwingPoint[] = [], lows: SwingPoint[] = [];
  for (let i = left; i < data.length-right; i++) {
    const pivot = data[i];
    const before = data.slice(i-left,i), after = data.slice(i+1,i+right+1);
    if (before.every(c=>pivot.high>c.high) && after.every(c=>pivot.high>c.high)) {
      const prev = highs.at(-1);
      highs.push({index:i,time:data[i+right].time,price:pivot.high,kind:'high',tag:prev ? (pivot.high>prev.price?'HH':'LH'):'FIRST'});
    }
    if (before.every(c=>pivot.low<c.low) && after.every(c=>pivot.low<c.low)) {
      const prev = lows.at(-1);
      lows.push({index:i,time:data[i+right].time,price:pivot.low,kind:'low',tag:prev ? (pivot.low>prev.price?'HL':'LL'):'FIRST'});
    }
  }
  const h=highs.at(-1), l=lows.at(-1);
  const trend:TrendState = !h||!l||h.tag==='FIRST'||l.tag==='FIRST' ? 'INSUFFICIENT DATA'
    : h.tag==='HH'&&l.tag==='HL' ? 'UPTREND'
    : h.tag==='LH'&&l.tag==='LL' ? 'DOWNTREND' : 'RANGE / MIXED';
  const explanation=trend==='UPTREND'?'Higher highs + higher lows: upward structure.'
    :trend==='DOWNTREND'?'Lower highs + lower lows: downward structure.'
    :trend==='RANGE / MIXED'?'Swings disagree; wait for a confirmed structure change.'
    :'More confirmed swing highs and lows are required.';
  return {trend,swings:[...highs,...lows].sort((a,b)=>a.time-b.time).slice(-16),latestHigh:h?.price??null,latestLow:l?.price??null,explanation};
}
