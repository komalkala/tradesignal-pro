import type { Candle, Indicators } from "./types";
export function ema(values: number[], period: number): number[] {
  const out = Array(values.length).fill(NaN); if (values.length < period) return out;
  const alpha = 2 / (period + 1); let sum = 0;
  for(let i=0;i<period;i++) sum+=values[i]; out[period-1]=sum/period;
  for(let i=period;i<values.length;i++) out[i]=values[i]*alpha+out[i-1]*(1-alpha);
  return out;
}
export function rsi(values: number[], period=14): number[] {
  const out=Array(values.length).fill(NaN); if(values.length<=period)return out;
  let gains=0,losses=0;
  for(let i=1;i<=period;i++){const d=values[i]-values[i-1];gains+=Math.max(d,0);losses+=Math.max(-d,0);}
  let avgGain=gains/period,avgLoss=losses/period;
  const calc=()=>avgLoss===0?(avgGain===0?50:100):100-100/(1+avgGain/avgLoss);
  out[period]=calc();
  for(let i=period+1;i<values.length;i++){const d=values[i]-values[i-1];avgGain=(avgGain*(period-1)+Math.max(d,0))/period;avgLoss=(avgLoss*(period-1)+Math.max(-d,0))/period;out[i]=calc();}
  return out;
}
export function macd(values:number[]): {line:number[];signal:number[];histogram:number[]} {
  const fast=ema(values,12),slow=ema(values,26);
  const line=values.map((_,i)=>Number.isFinite(fast[i])&&Number.isFinite(slow[i])?fast[i]-slow[i]:NaN);
  const valid=line.slice(25); const sig=ema(valid,9);
  const signal=line.map((_,i)=>i>=25?sig[i-25]:NaN);
  return {line,signal,histogram:line.map((v,i)=>Number.isFinite(signal[i])?v-signal[i]:NaN)};
}
export function atr(c:Candle[],period=14):number[]{
  const out=Array(c.length).fill(NaN);if(c.length<period)return out;
  const tr=c.map((x,i)=>i===0?x.high-x.low:Math.max(x.high-x.low,Math.abs(x.high-c[i-1].close),Math.abs(x.low-c[i-1].close)));
  let sum=0;for(let i=0;i<period;i++)sum+=tr[i];out[period-1]=sum/period;
  for(let i=period;i<c.length;i++)out[i]=(out[i-1]*(period-1)+tr[i])/period;
  return out;
}
export function indicatorSeries(c:Candle[]):Indicators[]{
  const close=c.map(x=>x.close),vol=c.map(x=>x.volume),e20=ema(close,20),e50=ema(close,50),e200=ema(close,200),rs=rsi(close),m=macd(close),a=atr(c);
  let volumeSum=0;
  return c.map((_,i)=>{volumeSum+=vol[i];if(i>=20)volumeSum-=vol[i-20];const avg=i>=19?volumeSum/20:NaN;
    return {ema20:e20[i],ema50:e50[i],ema200:e200[i],rsi:rs[i],macd:m.line[i],macdSignal:m.signal[i],macdHistogram:m.histogram[i],atr:a[i],volumeRatio:avg>0?vol[i]/avg:NaN};
  });
}
