import type {Candle} from './types';
export type MarketRegime='UPTREND'|'DOWNTREND'|'RANGE'|'HIGH_VOLATILITY'|'INSUFFICIENT_DATA';
export type RegimeReport={regime:MarketRegime;atrPercent:number;trendStrength:number;reason:string};
// Research label only. Uses exclusively the provided completed candles.
export function detectRegime(candles:Candle[],lookback=50):RegimeReport{
 if(candles.length<Math.max(55,lookback+1))return {regime:'INSUFFICIENT_DATA',atrPercent:0,trendStrength:0,reason:'Need at least 55 completed candles'};
 const c=candles.slice(-lookback);const last=c.at(-1)!;
 const tr=c.map((bar,i)=>i===0?bar.high-bar.low:Math.max(bar.high-bar.low,Math.abs(bar.high-c[i-1].close),Math.abs(bar.low-c[i-1].close)));
 const atr=tr.slice(-14).reduce((a,b)=>a+b,0)/14;
 const atrPercent=100*atr/last.close;
 const first=c[0].close;const trendStrength=Math.abs(last.close-first)/Math.max(atr,Number.EPSILON);
 const up=last.close>first, volatility=atrPercent>=4;
 const regime:MarketRegime=volatility?'HIGH_VOLATILITY':trendStrength<2?'RANGE':up?'UPTREND':'DOWNTREND';
 return {regime,atrPercent,trendStrength,reason:volatility?'ATR exceeds 4% of last close':trendStrength<2?'Net move less than 2 ATR':up?'Positive lookback trend':'Negative lookback trend'};
}
