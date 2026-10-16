import type {Candle,SymbolId,Side} from './types';
import {ema,rsi,atr,macd} from './indicators';
import {performanceMetrics} from './performance-metrics';

/** All timestamps are Binance candle OPEN timestamps in milliseconds. */
const HOUR=3600000;
export type SwingSetup={symbol:SymbolId;decision:Side|'WAIT';candleTime:number;confirmedAt:number;entry:number|null;stop:number|null;target:number|null;score:number;reasons:string[];bias:'BULLISH'|'BEARISH'|'MIXED';trend:'BULLISH'|'BEARISH'|'MIXED';atr:number|null;executable:boolean};
export type SwingTrade={side:Side;entryTime:number;exitTime:number;entry:number;exit:number;stop:number;target:number;pnl:number;reason:'TARGET'|'STOP'|'TIME';score:number};
export type SwingConfig={riskPct:number;initialEquity:number;feeRate:number;slippageRate:number;maxHoldHours:number;rewardRatio:number;atrStopMultiple:number};
export const SWING_DEFAULTS:SwingConfig={riskPct:0.005,initialEquity:750,feeRate:0.0005,slippageRate:0.0002,maxHoldHours:72,rewardRatio:2,atrStopMultiple:1.5};
const empty=(symbol:SymbolId,c:Candle,reasons:string[],bias:SwingSetup['bias']='MIXED',trend:SwingSetup['trend']='MIXED'):SwingSetup=>({symbol,decision:'WAIT',candleTime:c.time,confirmedAt:c.time+HOUR,entry:null,stop:null,target:null,score:0,reasons,bias,trend,atr:null,executable:false});
function lastCompletedIndex(candles:Candle[],completedAt:number,periodMs:number){let l=0,r=candles.length-1,idx=-1;while(l<=r){const m=(l+r)>>1;if(candles[m].time+periodMs<=completedAt){idx=m;l=m+1}else r=m-1}return idx;}
export function evaluateSwing(symbol:SymbolId,hour:Candle[],four:Candle[],day:Candle[],i=hour.length-1):SwingSetup{
 const c=hour[i];if(!c)throw Error('Missing hourly candle');
 const cutoff=c.time+HOUR;const j=lastCompletedIndex(four,cutoff,4*HOUR),k=lastCompletedIndex(day,cutoff,24*HOUR);
 if(i<210||j<210||k<210)return empty(symbol,c,['Not enough PREVIOUSLY CLOSED 1h, 4h and 1d candles']);
 // Indicators calculated on series ending at the completed candle (never future data).
 const h=hour.slice(0,i+1),f=four.slice(0,j+1),d=day.slice(0,k+1);
 const he=ema(h.map(v=>v.close),20),fe50=ema(f.map(v=>v.close),50),fe200=ema(f.map(v=>v.close),200),de50=ema(d.map(v=>v.close),50),de200=ema(d.map(v=>v.close),200);
 const rs=rsi(h.map(v=>v.close)),mc=macd(h.map(v=>v.close)),a=atr(h),idx=h.length-1;
 const bias=d[k].close>de50[k]&&de50[k]>de200[k]?'BULLISH':d[k].close<de50[k]&&de50[k]<de200[k]?'BEARISH':'MIXED';
 const trend=f[j].close>fe50[j]&&fe50[j]>fe200[j]?'BULLISH':f[j].close<fe50[j]&&fe50[j]<fe200[j]?'BEARISH':'MIXED';
 const volAverage=h.slice(-21,-1).reduce((s,v)=>s+v.volume,0)/20;
 const up=h[idx-1].close<=he[idx-1]&&c.close>he[idx]&&c.close>c.open;
 const down=h[idx-1].close>=he[idx-1]&&c.close<he[idx]&&c.close<c.open;
 const higherHigh=c.close>Math.max(...h.slice(-7,-1).map(v=>v.high));
 const lowerLow=c.close<Math.min(...h.slice(-7,-1).map(v=>v.low));
 const volOK=volAverage>0&&c.volume/volAverage>=1.05;
 const bullish=bias==='BULLISH'&&trend==='BULLISH'&&up&&rs[idx]>=50&&rs[idx]<=72&&mc.histogram[idx]>0&&volOK&&higherHigh;
 const bearish=bias==='BEARISH'&&trend==='BEARISH'&&down&&rs[idx]<=50&&rs[idx]>=28&&mc.histogram[idx]<0&&volOK&&lowerLow;
 const side:Side|'WAIT'=bullish?'LONG':bearish?'SHORT':'WAIT';
 const checks=[bias!=='MIXED'&&bias===trend,up||down,volOK,mc.histogram[idx]*(up?1:-1)>0,higherHigh||lowerLow];
 const score=checks.filter(Boolean).length*20;
 const reasons=[`1d bias: ${bias}`,`4h trend: ${trend}`,`1h EMA20 reclaim/rejection: ${up?'bullish':down?'bearish':'none'}`,`1h RSI: ${rs[idx].toFixed(1)}`,`MACD histogram: ${mc.histogram[idx].toFixed(4)}`,`Volume ratio: ${volAverage? (c.volume/volAverage).toFixed(2):'n/a'}`,`Structure close break: ${higherHigh?'up':lowerLow?'down':'none'}`];
 if(side==='WAIT')return {...empty(symbol,c,reasons,bias,trend),score,atr:Number.isFinite(a[idx])?a[idx]:null};
 const entry=c.close,dist=a[idx]*SWING_DEFAULTS.atrStopMultiple;
 if(!Number.isFinite(dist)||dist<=0)return empty(symbol,c,['Invalid ATR'],bias,trend);
 return {symbol,decision:side,candleTime:c.time,confirmedAt:cutoff,entry,stop:side==='LONG'?entry-dist:entry+dist,target:side==='LONG'?entry+dist*SWING_DEFAULTS.rewardRatio:entry-dist*SWING_DEFAULTS.rewardRatio,score,reasons,bias,trend,atr:a[idx],executable:false};
}
/** Non-overlapping 1h simulations, next-bar entry, stop-first intrabar ambiguity. Research only. */
export function backtestSwing(symbol:SymbolId,hour:Candle[],four:Candle[],day:Candle[],config:SwingConfig=SWING_DEFAULTS){
 const trades:SwingTrade[]=[];let equity=config.initialEquity;let nextEligible=0;
 for(let i=210;i<hour.length-2;i++){
  if(i<nextEligible||equity<=0)continue;
  const sig=evaluateSwing(symbol,hour,four,day,i);if(sig.decision==='WAIT'||sig.entry===null||sig.atr===null)continue;
  const side=sig.decision,entryC=hour[i+1],entry=entryC.open*(1+(side==='LONG'?1:-1)*config.slippageRate);
  const distance=sig.atr*config.atrStopMultiple,stop=side==='LONG'?entry-distance:entry+distance,target=side==='LONG'?entry+distance*config.rewardRatio:entry-distance*config.rewardRatio;
  const qty=equity*config.riskPct/distance;
  const maxExit=Math.min(hour.length-1,i+1+config.maxHoldHours);
  let exit=hour[maxExit].close,reason:SwingTrade['reason']='TIME',exitIdx=maxExit;
  for(let z=i+1;z<=maxExit;z++){
   const cc=hour[z],stopHit=side==='LONG'?cc.low<=stop:cc.high>=stop,targetHit=side==='LONG'?cc.high>=target:cc.low<=target;
   if(stopHit||targetHit){exit=stopHit?stop:target;reason=stopHit?'STOP':'TARGET';exitIdx=z;break;}
  }
  const executedExit=exit*(1+(side==='LONG'?-1:1)*config.slippageRate);
  const gross=(executedExit-entry)*qty*(side==='LONG'?1:-1);
  const fees=qty*(entry+executedExit)*config.feeRate;
  const pnl=gross-fees;equity+=pnl;
  trades.push({side,entryTime:entryC.time,exitTime:hour[exitIdx].time+HOUR,entry,exit:executedExit,stop,target,pnl,reason,score:sig.score});
  nextEligible=exitIdx+1;
 }
 const cutoff=hour[Math.floor(hour.length*.7)].time;
 return {trades,metrics:performanceMetrics(trades,config.initialEquity),training:performanceMetrics(trades.filter(t=>t.entryTime<cutoff),config.initialEquity),holdout:performanceMetrics(trades.filter(t=>t.entryTime>=cutoff),config.initialEquity),cutoff,config};
}
