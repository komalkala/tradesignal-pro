import type {Candle,SymbolId,Side} from './types';
import {evaluateQuickSignal} from './quick-signal';
import {closedAt} from './closed-at';
import type {ReplaySettings,SimTrade,ProBacktestResult} from './pro-backtest';

export type QuickSettings=ReplaySettings&{maxMinutes?:number;maxTradesPerDay?:number;minScore?:number};
const M5=300000,M15=900000,H1=3600000;
export {closedAt} from "./closed-at";
export function simulateExit(args:{bars:Candle[];startIndex:number;entry:number;stop:number;target:number;side:Side;maxBars:number;slippageRate:number}){
 const {bars,startIndex,entry,stop,target,side,maxBars,slippageRate}=args;
 const dir=side==='LONG'?1:-1;
 for(let j=startIndex;j<Math.min(bars.length,startIndex+maxBars);j++){
  const bar=bars[j],stopHit=side==='LONG'?bar.low<=stop:bar.high>=stop;
  const targetHit=side==='LONG'?bar.high>=target:bar.low<=target;
  // Gap through a stop executes at bar open if worse; ambiguous OHLC always stop-first.
  if(stopHit)return {index:j,exit:(side==='LONG'?Math.min(stop,bar.open):Math.max(stop,bar.open))*(1-dir*slippageRate),reason:targetHit?'Stop (both touched)':'Stop'};
  if(targetHit)return {index:j,exit:target*(1-dir*slippageRate),reason:'Target'};
  if(j===startIndex+maxBars-1)return {index:j,exit:bar.close*(1-dir*slippageRate),reason:'Time exit'};
 }
 return null; // skip unfinished trade at end of dataset
}
export function runQuickBacktest(input:{candles:Candle[];higher:Candle[];btcHourly:Candle[];hourly:Candle[];symbol:SymbolId;settings?:QuickSettings}):ProBacktestResult&{maxMinutes:number;timeExits:number;averageMinutes:number;warnings:string[]}{
 const s={balance:750,riskPct:.5,feeRate:.0005,slippageRate:.0002,fundingRatePer8h:0,rewardRatio:2,atrMultiple:1.5,maxMinutes:60,maxTradesPerDay:0,minScore:85,...input.settings};
 if(!Number.isInteger(s.maxMinutes)||s.maxMinutes<5||s.maxMinutes>60||s.maxMinutes%5!==0||s.riskPct<=0||s.riskPct>1||s.feeRate<0||s.slippageRate<0||s.atrMultiple<=0||s.rewardRatio<=0||(s.maxTradesPerDay!==0&&(s.maxTradesPerDay<1||s.maxTradesPerDay>100))||s.minScore<75||s.minScore>100)throw Error('Invalid quick trade settings');
 if(!Number.isFinite(s.balance)||s.balance<=0)throw Error('Invalid account balance');
 const maxBars=s.maxMinutes/5,initial=s.balance;
 let balance=initial,peak=balance,maxDrawdown=0;const trades:SimTrade[]=[];const counts=new Map<string,number>();
 const {candles,higher,btcHourly,hourly,symbol}=input;
 // All series are prevalidated closed candles, and all lookup values are strictly closed by decision time.
 for(let i=210;i<candles.length-maxBars-1;){
  const at=candles[i].time+M5;
  const h=closedAt(higher,at,M15),b=closedAt(btcHourly,at,H1),h1=closedAt(hourly,at,H1);
  if(h<205||b<205||h1<205){i++;continue;}
  const day=new Date(at).toISOString().slice(0,10);
  if(s.maxTradesPerDay>0 && (counts.get(day)??0)>=s.maxTradesPerDay){i++;continue;}
  // Reuse exactly the quick alert qualification rules; no future 15m/1h bars.
  const evaluation=evaluateQuickSignal({
    candles:candles.slice(Math.max(0,i-499),i+1),
    fifteen:higher.slice(0,h+1),
    hourly:hourly.slice(0,h1+1),
    btcHourly:btcHourly.slice(0,b+1),
    symbol,minScore:s.minScore,rewardRatio:s.rewardRatio,atrMultiple:s.atrMultiple,
  });
  const q=evaluation.signal;
  if(!evaluation.confirmed||q.stop==null||q.target==null||q.decision==='WAIT'){i++;continue;}
  const dir=q.decision==='LONG'?1:-1,start=i+1,entry=candles[start].open*(1+dir*s.slippageRate),distance=dir*(entry-q.stop);
  if(distance<=0){i++;continue;}
  // Estimate two fees and 2x slippage in per-unit risk; slippage is conservatively reserved.
  const unitRisk=distance+entry*(2*s.feeRate+2*s.slippageRate),qty=balance*s.riskPct/100/unitRisk;
  if(!Number.isFinite(qty)||qty<=0){i++;continue;}
  const exit=simulateExit({bars:candles,startIndex:start,entry,stop:q.stop,target:q.target,side:q.decision,maxBars,slippageRate:s.slippageRate});
  if(!exit)break;
  const fee=qty*(entry+exit.exit)*s.feeRate;
  // Assumed adverse funding, not historical Binance funding. Under one hour this typically defaults to zero.
  const hours=(exit.index-start+1)*5/60;
  const funding=qty*entry*s.fundingRatePer8h*hours/8;
  const pnl=qty*dir*(exit.exit-entry)-fee-funding;
  balance=Math.max(0,balance+pnl);peak=Math.max(peak,balance);maxDrawdown=Math.max(maxDrawdown,(peak-balance)/peak*100);
  trades.push({side:q.decision,signalTime:candles[i].time,entryTime:candles[start].time,exitTime:candles[exit.index].time+M5,entry,exit:exit.exit,stop:q.stop,target:q.target,score:q.score,pnl,fee:fee+funding,reason:exit.reason,balance});
  counts.set(day,(counts.get(day)??0)+1);i=exit.index+1;
 }
 const winners=trades.filter(t=>t.pnl>0),losers=trades.filter(t=>t.pnl<0);
 const win=winners.reduce((n,t)=>n+t.pnl,0),loss=-losers.reduce((n,t)=>n+t.pnl,0);
 return {trades,startingBalance:initial,endingBalance:balance,netReturn:(balance/initial-1)*100,winRate:trades.length?winners.length/trades.length*100:0,profitFactor:loss>0?win/loss:null,maxDrawdown,expectancy:trades.length?(balance-initial)/trades.length:0,summary:trades.length?'5m closed-candle strategy research, not evidence of a profitable system.':'No qualifying completed trades; cannot establish profitability.',settings:{riskPct:s.riskPct,feeRate:s.feeRate,slippageRate:s.slippageRate,fundingRatePer8h:s.fundingRatePer8h,rewardRatio:s.rewardRatio,atrMultiple:s.atrMultiple},maxMinutes:s.maxMinutes,timeExits:trades.filter(t=>t.reason==='Time exit').length,averageMinutes:trades.length?trades.reduce((n,t)=>n+(t.exitTime-t.entryTime)/60000,0)/trades.length:0,warnings:['Funding defaults to 0%; real funding not reconstructed','OHLC bars cannot resolve exact order of intrabar levels; stop-first used','No actual order book, maker fills, latency, liquidation or leverage-margin simulation','No time-of-day selection or automated live entries','No daily alert limit; backtest still models one position at a time','Limited Binance REST history; low trade counts are inconclusive']};
}
