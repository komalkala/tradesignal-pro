import type {Candle,Side} from './types';
import {performanceMetrics} from './performance-metrics';

export type SmcEvent={kind:'BOS'|'CHoCH'|'ORDER_BLOCK'|'FVG';side:Side;time:number;low:number;high:number;description:string};
export type SmcTrade={side:Side;entryTime:number;exitTime:number;entry:number;exit:number;stop:number;target:number;pnl:number;reason:string;setup:string};
export type SmcSignal={side:Side;setup:'BOS_FVG'|'CHoCH_OB';stop:number;target:number;reason:string};
const M5=300_000;
const isSwingHigh=(c:Candle[],idx:number)=>idx>=3&&idx+3<c.length&&c.slice(idx-3,idx).every(x=>x.high<c[idx].high)&&c.slice(idx+1,idx+4).every(x=>x.high<c[idx].high);
const isSwingLow=(c:Candle[],idx:number)=>idx>=3&&idx+3<c.length&&c.slice(idx-3,idx).every(x=>x.low>c[idx].low)&&c.slice(idx+1,idx+4).every(x=>x.low>c[idx].low);
/** Incremental detector: new pivots become knowable only three bars after occurrence. */
export function detectSmcEvents(candles:Candle[],maxEvents=40):SmcEvent[]{
 const out:SmcEvent[]=[];
 let hi:number|null=null,lo:number|null=null,trend:Side|null=null,brokenHigh:number|null=null,brokenLow:number|null=null;
 for(let i=7;i<candles.length;i++){
  const p=i-3;
  if(isSwingHigh(candles,p)){hi=candles[p].high;brokenHigh=null;}
  if(isSwingLow(candles,p)){lo=candles[p].low;brokenLow=null;}
  const c=candles[i],prev=candles[i-1];
  const up=hi!=null&&c.close>hi&&prev.close<=hi&&brokenHigh!==hi;
  const down=lo!=null&&c.close<lo&&prev.close>=lo&&brokenLow!==lo;
  if(up||down){
   const side:Side=up?'LONG':'SHORT',level=up?hi!:lo!;
   const kind:SmcEvent['kind']=trend&&trend!==side?'CHoCH':'BOS';
   out.push({kind,side,time:c.time,low:level,high:level,description:`Confirmed candle close through previously confirmed ${up?'swing high':'swing low'}`});
   trend=side;if(up)brokenHigh=hi;else brokenLow=lo;
   const candidate=candles.slice(Math.max(0,i-8),i).reverse().find(x=>side==='LONG'?x.close<x.open:x.close>x.open);
   if(candidate)out.push({kind:'ORDER_BLOCK',side,time:c.time,low:candidate.low,high:candidate.high,description:'Last opposite candle before structure break; heuristic zone, not proof of institutional orders'});
  }
  if(i>=2){
   const a=candles[i-2],z=c;
   if(a.high<z.low&&candles[i-1].close>candles[i-1].open)out.push({kind:'FVG',side:'LONG',time:z.time,low:a.high,high:z.low,description:'Three-candle bullish wick imbalance'});
   if(a.low>z.high&&candles[i-1].close<candles[i-1].open)out.push({kind:'FVG',side:'SHORT',time:z.time,low:z.high,high:a.low,description:'Three-candle bearish wick imbalance'});
  }
 }
 return out.slice(-maxEvents);
}
/** Research candidate at a particular candle close; never reads future candles. */
export function smcCandidate(history:Candle[],events:SmcEvent[]):SmcSignal|null{
 if(history.length<40)return null;
 const c=history.at(-1)!, recent=events.filter(e=>e.time>=c.time-12*M5&&e.time<=c.time);
 const breaks=recent.filter(e=>e.kind==='BOS'||e.kind==='CHoCH');
 const br=breaks.at(-1);if(!br)return null;
 const zones=recent.filter(e=>e.side===br.side&&e.time>=br.time&&(e.kind==='FVG'||e.kind==='ORDER_BLOCK'));
 const zone=zones.at(-1);if(!zone)return null;
 const bullish=br.side==='LONG';
 // Retrace into zone and reclaim zone midpoint in the signal candle.
 const mid=(zone.low+zone.high)/2;
 const touched=bullish?c.low<=zone.high&&c.close>mid:c.high>=zone.low&&c.close<mid;
 if(!touched||c.time===br.time)return null;
 const range=history.slice(-15),atr=range.reduce((s,x)=>s+x.high-x.low,0)/range.length;
 const stop=bullish?Math.min(zone.low,c.low)-.15*atr:Math.max(zone.high,c.high)+.15*atr;
 const dist=Math.abs(c.close-stop);
 if(!(dist>0&&dist<=3*atr))return null;
 const target=bullish?c.close+2*dist:c.close-2*dist;
 return {side:br.side,setup:br.kind==='CHoCH'?'CHoCH_OB':'BOS_FVG',stop,target,reason:`${br.kind} plus ${zone.kind} retest; heuristic research candidate`};
}
/** Closed-bar next-open replay, 60-minute cap; stop-first, fee/slippage included. */
export function runSmcBacktest(candles:Candle[],maxHoldBars=12):{trades:SmcTrade[];metrics:ReturnType<typeof performanceMetrics>}{
 const trades:SmcTrade[]=[];let balance=750,skipUntil=40;
 for(let i=40;i<candles.length-maxHoldBars-1;i++){
  if(i<skipUntil)continue;
  // A prefix is intentionally used so future bars never influence events.
  const hist=candles.slice(0,i+1);const detected=detectSmcEvents(hist,80);
  const signal=smcCandidate(hist,detected);if(!signal)continue;
  const dir=signal.side==='LONG'?1:-1,entry=candles[i+1].open*(1+dir*.0002);
  const risk=dir*(entry-signal.stop);if(risk<=0)continue;
  const qty=balance*.005/(risk+entry*.0014);
  let exit=0,reason='Time exit',j=i+maxHoldBars;
  for(let k=i+1;k<=i+maxHoldBars;k++){
   const bar=candles[k],stopHit=dir===1?bar.low<=signal.stop:bar.high>=signal.stop;
   const targetHit=dir===1?bar.high>=signal.target:bar.low<=signal.target;
   if(stopHit){j=k;exit=dir===1?Math.min(bar.open,signal.stop):Math.max(bar.open,signal.stop);reason='Stop';break;}
   if(targetHit){j=k;exit=signal.target;reason='Target';break;}
  }
  if(!exit)exit=candles[j].close;
  exit*=1-dir*.0002;
  const pnl=qty*(exit-entry)*dir-qty*(entry+exit)*.0005;
  balance=Math.max(0,balance+pnl);
  trades.push({side:signal.side,entryTime:candles[i+1].time,exitTime:candles[j].time+M5,entry,exit,stop:signal.stop,target:signal.target,pnl,reason,setup:signal.setup});
  skipUntil=j+1;
 }
 return {trades,metrics:performanceMetrics(trades)};
}
