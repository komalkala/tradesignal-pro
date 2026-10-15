import type {Candle,Side} from './types';
import {indicatorSeries} from './indicators';
import {performanceMetrics} from './performance-metrics';
import {simulateExit} from './quick-backtest';

export type HpTrade={side:Side;entryTime:number;exitTime:number;entry:number;exit:number;stop:number;target:number;pnl:number;reason:string;setup:string};
export type HpCandidate={side:Side;stop:number;target:number;reason:string};
const M5=300_000;
/** Experimental conservative trend-pullback entry, evaluated only at a closed 5m bar.
 * HTF context is the latest completed 1h candle at the 5m decision close.
 */
export function highProbabilityCandidate(bars:Candle[], hourly:Candle[], btcHourly:Candle[], symbol:string):HpCandidate|null{
 if(bars.length<220||hourly.length<220||btcHourly.length<220)return null;
 const last=bars.at(-1)!;const at=last.time+M5;
 const closed=(series:Candle[])=>series.filter(x=>x.time+3_600_000<=at);
 const h=closed(hourly),btc=closed(btcHourly);
 if(h.length<210||btc.length<210)return null;
 const ind=indicatorSeries(bars),i=ind.at(-1)!,prev=ind.at(-2)!;
 const hi=indicatorSeries(h).at(-1)!,bi=indicatorSeries(btc).at(-1)!;
 if(![i.atr,i.ema20,i.ema50,i.ema200,i.rsi,i.macdHistogram,i.volumeRatio,hi.ema20,hi.ema50,hi.ema200,bi.ema20,bi.ema50,bi.ema200].every(Number.isFinite)||i.atr<=0)return null;
 // Trend direction is confirmed by 5m and last closed 1h candle.
 const long=last.close>i.ema200&&i.ema20>i.ema50&&h.at(-1)!.close>hi.ema200&&hi.ema20>hi.ema50;
 const short=last.close<i.ema200&&i.ema20<i.ema50&&h.at(-1)!.close<hi.ema200&&hi.ema20<hi.ema50;
 const side:Side|null=long?'LONG':short?'SHORT':null;
 if(!side)return null;
 if(symbol!=='BTCUSDT' && (side==='LONG' ? !(btc.at(-1)!.close>bi.ema200&&bi.ema20>bi.ema50) : !(btc.at(-1)!.close<bi.ema200&&bi.ema20<bi.ema50)))return null;
 const recent=bars.slice(-8,-1);
 const touch=side==='LONG'?recent.some(x=>x.low<=prev.ema20):recent.some(x=>x.high>=prev.ema20);
 const recovery=side==='LONG'?last.close>last.open&&last.close>i.ema20&&i.rsi>=50&&i.rsi<=68&&i.macdHistogram>0:last.close<last.open&&last.close<i.ema20&&i.rsi>=32&&i.rsi<=50&&i.macdHistogram<0;
 const vol=i.volumeRatio>=1.05;
 if(!touch||!recovery||!vol)return null;
 const swing=side==='LONG'?Math.min(...bars.slice(-12).map(x=>x.low)):Math.max(...bars.slice(-12).map(x=>x.high));
 const stop=side==='LONG'?Math.min(swing,last.close-1.2*i.atr):Math.max(swing,last.close+1.2*i.atr);
 const dist=Math.abs(last.close-stop);
 if(!(dist>0&&dist<=3*i.atr))return null;
 const target=side==='LONG'?last.close+1.5*dist:last.close-1.5*dist;
 return {side,stop,target,reason:'5m EMA pullback and candle recovery, 1h direction, BTC trend, RSI/MACD and relative volume'};
}
/** Same starting equity, position risk and execution costs as the comparison engines.
 * 60-minute maximum hold, next-open entries, stop-first on ambiguous bars.
 */
export function runHighProbabilityBacktest(input:{candles:Candle[];hourly:Candle[];btcHourly:Candle[];symbol:string;maxHoldBars?:number}){
 const {candles,hourly,btcHourly,symbol}=input;const maxBars=input.maxHoldBars??12;
 const trades:HpTrade[]=[];let balance=750,skipUntil=0;
 // Pre-compute 5m indicators once; candidate uses a 250-bar prefix to cap work.
 for(let idx=220;idx<candles.length-maxBars;idx++){
  if(idx<skipUntil)continue;
  const recent=candles.slice(Math.max(0,idx-299),idx+1);
  const candidate=highProbabilityCandidate(recent,hourly,btcHourly,symbol);
  if(!candidate)continue;
  const dir=candidate.side==='LONG'?1:-1;
  const entry=candles[idx+1].open*(1+dir*.0002);
  const unitRisk=dir*(entry-candidate.stop);
  if(unitRisk<=0)continue;
  const qty=(balance*.005)/(unitRisk+entry*.0014);
  if(!Number.isFinite(qty)||qty<=0)continue;
  const out=simulateExit({bars:candles,startIndex:idx+1,entry,stop:candidate.stop,target:candidate.target,side:candidate.side,maxBars,slippageRate:.0002});
  if(!out)break;
  const pnl=qty*(out.exit-entry)*dir-qty*(entry+out.exit)*.0005;
  balance=Math.max(0,balance+pnl);
  trades.push({side:candidate.side,entryTime:candles[idx+1].time,exitTime:candles[out.index].time+M5,entry,exit:out.exit,stop:candidate.stop,target:candidate.target,pnl,reason:out.reason,setup:'CONFIRMED_TREND_PULLBACK'});
  skipUntil=out.index+1;
 }
 return {trades,metrics:performanceMetrics(trades)};
}
