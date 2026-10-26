import type {Candle, Side, SymbolId} from './types';
import type {V7Decision} from './v7-decision';
export type PaperStatus='PENDING_ENTRY'|'OPEN'|'TARGET'|'STOP'|'EXPIRED';
export type PaperTrade={id:string;symbol:SymbolId;side:Side;signalTime:number;createdAt:number;status:PaperStatus;reference:number;stop:number;target:number;entry:number|null;entryTime:number|null;exit:number|null;exitTime:number|null;netR:number|null;lastChecked:number};
export type JournalState={version:1;trades:PaperTrade[];watermarks:Partial<Record<SymbolId,number>>};
export const emptyJournal=():JournalState=>({version:1,trades:[],watermarks:{}});
const H=3600000;
export function makePaperTrade(d:V7Decision,now:number):PaperTrade|null{
 if(!d.isFresh||!['CONFIRMED_LONG','CONFIRMED_SHORT'].includes(d.status)||!d.side||d.entry===null||d.stop===null||d.target===null)return null;
 if((d.side==='LONG'&&!(d.stop<d.entry&&d.entry<d.target))||(d.side==='SHORT'&&!(d.target<d.entry&&d.entry<d.stop)))return null;
 return {id:`${d.symbol}:${d.signalTime}:${d.side}`,symbol:d.symbol,side:d.side,signalTime:d.signalTime,createdAt:now,status:'PENDING_ENTRY',reference:d.entry,stop:d.stop,target:d.target,entry:null,entryTime:null,exit:null,exitTime:null,netR:null,lastChecked:now};
}
/** Entry at NEXT completed hour's open, only when observed after candle close. No historical P&L is mislabeled as live execution. */
export function advancePaperTrade(t:PaperTrade,candles:Candle[],now:number,opts:{feePerSide?:number;slippage?:number;maxHoldHours?:number}={}):PaperTrade{
 if(['TARGET','STOP','EXPIRED'].includes(t.status))return t;
 const fee=opts.feePerSide??0.0005,slip=opts.slippage??0.0002,maxHold=opts.maxHoldHours??72;
 const bars=candles.filter(c=>c.time>=t.signalTime&&c.time+H<=now).sort((a,b)=>a.time-b.time);
 let x={...t,lastChecked:now};
 if(x.status==='PENDING_ENTRY'){
   // Only the candle immediately after the signal may become the simulated entry.
   // Do not create a fake late fill if polling was down or history has moved on.
   const first=bars[0]; if(!first)return x;
   if(first.time!==t.signalTime) return {...x,status:'EXPIRED',exitTime:first.time,netR:null};
   const observedEntry=first.open*(1+(t.side==='LONG'?slip:-slip));
   // Re-anchor SL/TP to original ATR risk distance, preserving R multiple.
   const dist=Math.abs(t.reference-t.stop); const rr=Math.abs(t.reference-t.target)/dist;
   if(!(dist>0&&rr>0))return x;
   x={...x,status:'OPEN',entry:observedEntry,entryTime:first.time,stop:t.side==='LONG'?observedEntry-dist:observedEntry+dist,target:t.side==='LONG'?observedEntry+dist*rr:observedEntry-dist*rr};
 }
 if(x.entry===null||x.entryTime===null)return x;
 const relevant=bars.filter(c=>c.time>=x.entryTime);
 for(const c of relevant){
   const stopHit=t.side==='LONG'?c.low<=x.stop:c.high>=x.stop;
   const targetHit=t.side==='LONG'?c.high>=x.target:c.low<=x.target;
   const timed=c.time>=x.entryTime+maxHold*H;
   if(!stopHit&&!targetHit&&!timed)continue;
   // Same-candle ambiguity: conservative stop-first assumption.
   const status:PaperStatus=stopHit?'STOP':targetHit?'TARGET':'EXPIRED';
   const rawExit=stopHit?x.stop:targetHit?x.target:c.close;
   const executedExit=rawExit*(1+(t.side==='LONG'?-slip:slip));
   const risk=Math.abs(x.entry-x.stop);
   const gross=(executedExit-x.entry)*(t.side==='LONG'?1:-1);
   const netR=(gross-fee*(x.entry+executedExit))/risk;
   return {...x,status,exit:executedExit,exitTime:c.time+H,netR};
 }
 return x;
}
export function paperMetrics(trades:PaperTrade[]){
 const closed=trades.filter(t=>t.netR!==null),wins=closed.filter(t=>t.netR !== null && t.netR > 0),positive=wins.reduce((a,t)=>a+t.netR!,0),negative=-closed.filter(t=>t.netR !== null && t.netR < 0).reduce((a,t)=>a+t.netR!,0);
 return {total:trades.length,open:trades.filter(t=>['OPEN','PENDING_ENTRY'].includes(t.status)).length,missedEntries:trades.filter(t=>t.status==='EXPIRED'&&t.entry===null).length,closed:closed.length,winRate:closed.length?wins.length/closed.length*100:null,expectancyR:closed.length?closed.reduce((a,t)=>a+t.netR!,0)/closed.length:null,profitFactor:negative>0?positive/negative:null,netR:closed.reduce((a,t)=>a+t.netR!,0)};
}
