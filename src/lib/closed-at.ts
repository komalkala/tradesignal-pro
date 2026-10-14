import type { Candle } from './types';
export function closedAt(c: Candle[], at: number, duration: number): number {
  let low=0, high=c.length-1, best=-1;
  while(low<=high){ const m=(low+high)>>1; if(c[m].time+duration<=at){best=m;low=m+1;} else high=m-1; }
  return best;
}
