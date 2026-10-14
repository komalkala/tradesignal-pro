import type { Candle } from './types';

export type HistoryInterval = '5m'|'15m'|'1h'|'4h'|'1d'|'1w';
export const INTERVAL_MS: Record<HistoryInterval, number> = {
  '5m': 300000, '15m': 900000, '1h': 3600000, '4h': 14400000,
  '1d': 86400000, '1w': 604800000
};

/** Verify OHLCV integrity BEFORE permitting historical strategy evaluation. */
export function validateHistory(candles:Candle[], interval:HistoryInterval):{valid:boolean; gaps:number; duplicates:number; invalid:number; first:number|null; last:number|null}{
  let gaps=0,duplicates=0,invalid=0;
  const delta=INTERVAL_MS[interval];
  for(let i=0;i<candles.length;i++){
    const c=candles[i];
    if(!Number.isFinite(c.time)||![c.open,c.high,c.low,c.close,c.volume].every(Number.isFinite)||c.open<=0||c.close<=0||c.high<=0||c.low<=0||c.volume<0||c.high<Math.max(c.open,c.close,c.low)||c.low>Math.min(c.open,c.close,c.high))invalid++;
    if(i){ const d=c.time-candles[i-1].time; if(d<=0)duplicates++; else if(d>delta)gaps+=Math.max(1,Math.round(d/delta)-1); else if(d!==delta)invalid++; }
  }
  return {valid:candles.length>=211&&gaps===0&&duplicates===0&&invalid===0,gaps,duplicates,invalid,first:candles[0]?.time??null,last:candles.at(-1)?.time??null};
}

/** Multiple REST pages, oldest-first, deduplicated, no active candles. No API keys. */
export async function loadHistoricalCandles(
  symbol:'SOLUSDT'|'BTCUSDT'|'ETHUSDT',interval:HistoryInterval,
  requested=5000, fetcher:typeof fetch=fetch
):Promise<Candle[]>{
  if(!['SOLUSDT','BTCUSDT','ETHUSDT'].includes(symbol)||!Object.hasOwn(INTERVAL_MS,interval))throw Error('Unsupported market');
  const max=Math.min(10000,Math.max(250,Math.floor(requested)));
  const pages:Candle[]=[]; let endTime:number|undefined;
  for(let page=0;pages.length<max&&page<10;page++){
    const limit=Math.min(1500,max-pages.length);
    const url=new URL('https://fapi.binance.com/fapi/v1/klines');
    url.searchParams.set('symbol',symbol);url.searchParams.set('interval',interval);url.searchParams.set('limit',String(limit));
    if(endTime!==undefined)url.searchParams.set('endTime',String(endTime));
    const response=await fetcher(url.toString(),{cache:'no-store',signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw Error(`Binance history request failed: HTTP ${response.status}`);
    const raw:unknown=await response.json();
    if(!Array.isArray(raw))throw Error('Binance history response is not an array');
    const chunk:Candle[]=raw.flatMap(row=>{
      if(!Array.isArray(row)||row.length<7)throw Error('Invalid OHLCV response');
      if(Number(row[6])>=Date.now())return [];
      return [{time:Number(row[0]),open:Number(row[1]),high:Number(row[2]),low:Number(row[3]),close:Number(row[4]),volume:Number(row[5])}];
    });
    if(!chunk.length)break;
    pages.unshift(...chunk);
    const nextEnd=chunk[0].time-1;
    if(endTime!==undefined&&nextEnd>=endTime)throw Error('Historical pagination did not advance');
    endTime=nextEnd;
    if(raw.length<limit)break;
  }
  const sorted=[...new Map(pages.map(c=>[c.time,c])).values()].sort((a,b)=>a.time-b.time).slice(-max);
  const quality=validateHistory(sorted,interval);
  if(!quality.valid)throw Error(`Invalid historical candles: ${quality.gaps} missing, ${quality.duplicates} duplicates, ${quality.invalid} invalid. Backtest halted.`);
  return sorted;
}
