import type {Candle, SymbolId} from './types';
import {profile,qualitySignal} from './pro';

export type SimTrade={side:'LONG'|'SHORT';signalTime:number;entryTime:number;exitTime:number;entry:number;exit:number;stop:number;target:number;score:number;pnl:number;fee:number;reason:string;balance:number};
export type ProBacktestResult={trades:SimTrade[];startingBalance:number;endingBalance:number;netReturn:number;winRate:number;profitFactor:number|null;maxDrawdown:number;expectancy:number;summary:string;settings:{riskPct:number;feeRate:number;slippageRate:number;fundingRatePer8h:number;rewardRatio:number;atrMultiple:number}};
export type ReplaySettings={balance?:number;riskPct?:number;feeRate?:number;slippageRate?:number;fundingRatePer8h?:number;rewardRatio?:number;atrMultiple?:number};

// Each HTF candle is eligible only after it has fully closed. Candle time is its OPEN time.
function lastClosedIndex(c:Candle[],asOf:number,durationMs:number):number{
 let lo=0,hi=c.length-1,best=-1;
 while(lo<=hi){const mid=(lo+hi)>>1;if(c[mid].time+durationMs<=asOf){best=mid;lo=mid+1}else hi=mid-1;}
 return best;
}
export function runProBacktest(input:{candles:Candle[];higher:Candle[];btc:Candle[];symbol:SymbolId;entryMs:number;higherMs:number;settings?:ReplaySettings}):ProBacktestResult{
 const {candles,higher,btc,symbol,entryMs,higherMs}=input;
 const s={riskPct:.5,feeRate:.0005,slippageRate:.0002,fundingRatePer8h:0,rewardRatio:2,atrMultiple:1.5,...input.settings};
 if(!(s.riskPct>0&&s.riskPct<=1&&s.feeRate>=0&&s.slippageRate>=0&&s.rewardRatio>0&&s.atrMultiple>0&&s.fundingRatePer8h>=0))throw Error('Invalid backtest settings');
 const startingBalance=Math.max(1,s.balance??750);let balance=startingBalance,peak=balance,maxDrawdown=0;
 const trades:SimTrade[]=[];
 // Replay uses only candles <= signal close. Entry happens at next bar's OPEN.
 for(let i=210;i<candles.length-1;){
  const signalAt=candles[i].time+entryMs;
  const h=lastClosedIndex(higher,signalAt,higherMs),b=lastClosedIndex(btc,signalAt,higherMs);
  if(h<205||b<205){i++;continue;}
  const slice=candles.slice(0,i+1);
  const q=qualitySignal({candles:slice,higher:profile(higher.slice(0,h+1)),btc:profile(btc.slice(0,b+1)),symbol,rr:s.rewardRatio,atrMult:s.atrMultiple});
  if(q.decision==='WAIT'||q.entry==null||q.stop==null||q.target==null){i++;continue;}
  const side=q.decision,dir=side==='LONG'?1:-1;
  const next=candles[i+1];const entry=next.open*(1+dir*s.slippageRate);
  const stop=q.stop,target=q.target;
  // Invalidate if next-bar gap makes the intended stop nonsensical.
  const distance=dir*(entry-stop);
  if(distance<=0){i++;continue;}
  const riskBudget=balance*s.riskPct/100;
  const riskPerUnit=distance+entry*(2*s.feeRate+2*s.slippageRate);
  const quantity=riskBudget/riskPerUnit;
  let exit=0,reason='End of data',j=i+1;
  for(;j<candles.length;j++){
   const bar=candles[j];const hitStop=side==='LONG'?bar.low<=stop:bar.high>=stop;
   const hitTarget=side==='LONG'?bar.high>=target:bar.low<=target;
   // Worst-case assumption if stop and target touched within the same OHLC bar.
   if(hitStop){exit=side==='LONG'?Math.min(stop,bar.open):Math.max(stop,bar.open);reason='Stop / intrabar ambiguity';break;}
   if(hitTarget){exit=target;reason='Target';break;}
  }
  if(j>=candles.length){j=candles.length-1;exit=candles[j].close;reason='End of data';}
  exit*=1-dir*s.slippageRate;
  const fee=quantity*(entry+exit)*s.feeRate;
  const hours=(candles[j].time-candles[i+1].time+entryMs)/3600000;
  const funding=quantity*entry*s.fundingRatePer8h*(hours/8); // constant adverse funding assumption, not historical funding reconstruction
  const pnl=quantity*dir*(exit-entry)-fee-funding;
  balance=Math.max(0,balance+pnl);peak=Math.max(peak,balance);maxDrawdown=Math.max(maxDrawdown,(peak-balance)/peak*100);
  trades.push({side,signalTime:candles[i].time,entryTime:next.time,exitTime:candles[j].time,entry,exit,stop,target,score:q.score,pnl,fee:fee+funding,reason,balance});
  i=j+1; // never overlap positions in one symbol
 }
 const winners=trades.filter(t=>t.pnl>0),losses=trades.filter(t=>t.pnl<0);
 const grossWin=winners.reduce((s,t)=>s+t.pnl,0),grossLoss=-losses.reduce((s,t)=>s+t.pnl,0);
 return {trades,startingBalance,endingBalance:balance,netReturn:(balance/startingBalance-1)*100,winRate:trades.length?winners.length/trades.length*100:0,profitFactor:grossLoss>0?grossWin/grossLoss:null,maxDrawdown,expectancy:trades.length?(balance-startingBalance)/trades.length:0,summary:trades.length?'Historical simulation only. Not predictive of future returns.':'No trades met all conditions; this does not establish strategy performance.',settings:{riskPct:s.riskPct,feeRate:s.feeRate,slippageRate:s.slippageRate,fundingRatePer8h:s.fundingRatePer8h,rewardRatio:s.rewardRatio,atrMultiple:s.atrMultiple}};
}
