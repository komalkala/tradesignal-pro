import type {Candle,Side} from './types';
export type EntryCandidate={side:Side;kind:'BREAKOUT'|'PULLBACK';confirmed:boolean;reason:string;signalTime:number};
// Uses only the last completed candle and earlier candles, never the next bar.
export function researchEntry(candles:Candle[],side:Side):EntryCandidate[]{
 if(candles.length<25)return [];
 const last=candles.at(-1)!;const previous=candles.slice(-21,-1);const recent=candles.slice(-6,-1);
 const highest=Math.max(...previous.map(c=>c.high));const lowest=Math.min(...previous.map(c=>c.low));
 const mean=previous.reduce((n,c)=>n+c.close,0)/previous.length;
 const breakout=side==='LONG'?last.close>highest:last.close<lowest;
 const touched=side==='LONG'?recent.some(c=>c.low<=mean):recent.some(c=>c.high>=mean);
 const recovered=side==='LONG'?last.close>mean&&last.close>last.open:last.close<mean&&last.close<last.open;
 return [
 {side,kind:'BREAKOUT',confirmed:breakout,reason:breakout?'Closed beyond previous 20-bar extreme':'No 20-bar close breakout',signalTime:last.time},
 {side,kind:'PULLBACK',confirmed:touched&&recovered,reason:touched&&recovered?'Prior pullback and directional recovery':'Pullback/recovery unconfirmed',signalTime:last.time}
 ];
}
