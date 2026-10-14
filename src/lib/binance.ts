import type { Candle, Interval, SymbolId } from "./types";
const BASE="https://fapi.binance.com";
export async function getCandles(symbol:SymbolId,interval:Interval | "1w",limit=700):Promise<Candle[]> {
  const url=new URL('/fapi/v1/klines',BASE);url.searchParams.set('symbol',symbol);url.searchParams.set('interval',interval);url.searchParams.set('limit',String(Math.min(1500,Math.max(250,limit))));
  const res=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(12000)});
  if(!res.ok)throw new Error(`Binance returned ${res.status}. Check exchange access or try again.`);
  const raw:unknown=await res.json();if(!Array.isArray(raw))throw new Error('Unexpected Binance response');
  const candles:Candle[]=raw.map((r:unknown)=>{if(!Array.isArray(r)||r.length<7)throw new Error('Invalid OHLCV data');return {time:Number(r[0]),open:Number(r[1]),high:Number(r[2]),low:Number(r[3]),close:Number(r[4]),volume:Number(r[5]),closeTime:Number(r[6])};}).filter((c:Candle&{closeTime:number})=>c.closeTime<Date.now()).map(({closeTime,...c}:Candle&{closeTime:number})=>c);
  if(candles.length<210||candles.some(c=>![c.time,c.open,c.high,c.low,c.close,c.volume].every(Number.isFinite)))throw new Error('Not enough valid closed candles returned');
  return candles;
}
