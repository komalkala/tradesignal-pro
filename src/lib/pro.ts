import type {Candle, Side, SymbolId} from './types';
import {indicatorSeries} from './indicators';

export type Snapshot={fundingRate:number|null; openInterest:number|null; bidAskSpreadPct:number|null; orderBookImbalance:number|null; warnings:string[]};
export type Trend='BULLISH'|'BEARISH'|'NEUTRAL';
export type Profile={trend:Trend;lastClose:number;ema20:number;ema50:number;ema200:number;rsi:number;atr:number};
export type SignalCheck={id:string;label:string;passed:boolean;detail:string};
export type Quality={candidateSide:Side;checks:SignalCheck[];shortChecks:SignalCheck[];decision:Side|'WAIT';score:number;longScore:number;shortScore:number;reasons:string[];vetoes:string[];parts:{name:string;points:number;possible:number}[];entry:number|null;stop:number|null;target:number|null;support:number|null;resistance:number|null;marketStructure:string;isResearchOnly:true};
export function profile(c:Candle[]):Profile {
 const i=indicatorSeries(c).at(-1);const last=c.at(-1);if(!i||!last)throw Error('Insufficient candles');
 const trend:Trend=i.ema20>i.ema50&&last.close>i.ema200?'BULLISH':i.ema20<i.ema50&&last.close<i.ema200?'BEARISH':'NEUTRAL';
 return {trend,lastClose:last.close,ema20:i.ema20,ema50:i.ema50,ema200:i.ema200,rsi:i.rsi,atr:i.atr};
}
export function structure(c:Candle[],lookback=60){
 const bars=c.slice(-lookback);const pivH:number[]=[],pivL:number[]=[];
 for(let k=2;k<bars.length-2;k++){
  if(bars.slice(k-2,k+3).every((x,j)=>j===2||bars[k].high>x.high))pivH.push(bars[k].high);
  if(bars.slice(k-2,k+3).every((x,j)=>j===2||bars[k].low<x.low))pivL.push(bars[k].low);
 }
 const highs=pivH.slice(-2),lows=pivL.slice(-2);
 const bullish=highs.length===2&&lows.length===2&&highs[1]>highs[0]&&lows[1]>lows[0];
 const bearish=highs.length===2&&lows.length===2&&highs[1]<highs[0]&&lows[1]<lows[0];
 return {trend:bullish?'BULLISH' as Trend:bearish?'BEARISH' as Trend:'NEUTRAL' as Trend,
  support:pivL.at(-1)??Math.min(...bars.map(x=>x.low)),resistance:pivH.at(-1)??Math.max(...bars.map(x=>x.high)),description:bullish?'Higher highs + higher lows':bearish?'Lower highs + lower lows':'Mixed swing structure'};
}
export function qualitySignal(input:{candles:Candle[];higher:Profile;btc:Profile;symbol:SymbolId;snapshot?:Snapshot;rr?:number;atrMult?:number}):Quality {
 const {candles,higher,btc,symbol,snapshot}=input;const i=indicatorSeries(candles).at(-1)!;const close=candles.at(-1)!.close;
 const ms=structure(candles);const rr=input.rr??2,atrMult=input.atrMult??1.5;
 const ready=[i.ema20,i.ema50,i.ema200,i.rsi,i.atr,i.macdHistogram,i.volumeRatio].every(Number.isFinite)&&i.atr>0;
 if(!ready)return {candidateSide:'LONG',shortChecks:[],checks:[{id:'data',label:'Valid indicator history',passed:false,detail:'Need enough completed candles'}],decision:'WAIT',score:0,longScore:0,shortScore:0,reasons:[],vetoes:['Not enough valid historical data'],parts:[],entry:null,stop:null,target:null,support:null,resistance:null,marketStructure:'Unknown',isResearchOnly:true};
 const trend=(s:Side)=>s==='LONG'?'BULLISH':'BEARISH';
 function calc(side:Side){const t=trend(side);const bullish=side==='LONG';const ema=bullish?i.ema20>i.ema50&&close>i.ema200:i.ema20<i.ema50&&close<i.ema200;
  const momentum=bullish?i.rsi>=50&&i.rsi<=70&&i.macdHistogram>0:i.rsi>=30&&i.rsi<=50&&i.macdHistogram<0;
  const btcOk=symbol==='BTCUSDT'||btc.trend===t;
  const dist=bullish?(close-ms.support):(ms.resistance-close);
  const zone=dist>0&&dist<=i.atr*3;
  const parts=[{name:'Higher timeframe trend',points:higher.trend===t?20:0,possible:20},
   {name:'Market structure',points:ms.trend===t?20:ms.trend==='NEUTRAL'?5:0,possible:20},
   {name:'Momentum',points:momentum?15:0,possible:15},
   {name:'Volume participation',points:i.volumeRatio>=1.1?15:i.volumeRatio>=1?8:0,possible:15},
   {name:'Futures positioning data',points:0,possible:10}, // snapshot data shown, NEVER inferred predictive scoring from levels
   {name:'Entry location',points:zone?10:0,possible:10},
   {name:'Risk/reward',points:rr>=2?10:rr>=1.5?5:0,possible:10}];
  const score=parts.reduce((a,x)=>a+x.points,0);
  const vetoes=[...(!ema?['EMA trend not aligned']:[]),...(!momentum?['Momentum not confirmed']:[]),...(!btcOk?['BTC directional filter not aligned']:[]),...(higher.trend!==t?['Higher timeframe disagrees']:[]),...(ms.trend!==t?['Swing structure unconfirmed']:[]),...(i.volumeRatio<1.05?['Volume below minimum confirmation']:[])];
  const checks:SignalCheck[]=[
   {id:'ema',label:'EMA direction',passed:ema,detail:bullish?'EMA 20 > EMA 50 and close > EMA 200':'EMA 20 < EMA 50 and close < EMA 200'},
   {id:'higher',label:'Higher timeframe confirmation',passed:higher.trend===t,detail:`Required ${t}; actual ${higher.trend}`},
   {id:'structure',label:'Swing structure',passed:ms.trend===t,detail:bullish?'Higher highs and higher lows':'Lower highs and lower lows'},
   {id:'momentum',label:'RSI + MACD momentum',passed:momentum,detail:bullish?`RSI 50–70 and MACD histogram > 0 (RSI ${i.rsi.toFixed(1)}, histogram ${i.macdHistogram.toFixed(4)})`:`RSI 30–50 and MACD histogram < 0 (RSI ${i.rsi.toFixed(1)}, histogram ${i.macdHistogram.toFixed(4)})`},
   {id:'volume',label:'Volume confirmation',passed:i.volumeRatio>=1.05,detail:`Volume ≥ 1.05× recent average; now ${i.volumeRatio.toFixed(2)}×`},
   {id:'btc',label:'BTC directional filter',passed:btcOk,detail:symbol==='BTCUSDT'?'BTC itself selected':`BTC trend needs ${t}; now ${btc.trend}`},
   {id:'quality',label:'Quality score threshold',passed:score>=75,detail:`At least 75/100; now ${score}/100`}
  ];
  return {score,parts,vetoes,ema,checks};
 }
 // Select the most actionable directional candidate, not simply the highest raw score.
 // A passing candidate outranks one with mandatory vetoes. When neither is valid,
 // fewer vetoes and more passed checks provide clearer diagnostics, not a trade.
 const long=calc('LONG'),short=calc('SHORT');
 const rank=(x:ReturnType<typeof calc>)=>({valid:x.score>=75&&x.vetoes.length===0, vetoes:x.vetoes.length, passed:x.checks.filter(c=>c.passed).length});
 const l=rank(long),s=rank(short);
 const isLong=l.valid!==s.valid?l.valid:l.vetoes!==s.vetoes?l.vetoes<s.vetoes:l.passed!==s.passed?l.passed>s.passed:long.score>=short.score;
 const best=isLong?long:short;
 const side:Side=isLong?'LONG':'SHORT';const decision=best.score>=75&&best.vetoes.length===0?side:'WAIT';
 const distance=i.atr*atrMult;
 return {candidateSide:side,checks:best.checks,shortChecks:short.checks,decision,score:best.score,longScore:long.score,shortScore:short.score,parts:best.parts,vetoes:best.vetoes,
 reasons:[`EMA trend ${i.ema20>i.ema50?'up':'down'}`,`RSI ${i.rsi.toFixed(1)}, volume ${i.volumeRatio.toFixed(2)}×`,`Higher timeframe ${higher.trend}`,`BTC trend ${btc.trend}`,...(snapshot?.warnings??[])],
 entry:decision==='WAIT'?null:close,stop:decision==='WAIT'?null:side==='LONG'?close-distance:close+distance,
 target:decision==='WAIT'?null:side==='LONG'?close+rr*distance:close-rr*distance,
 support:ms.support,resistance:ms.resistance,marketStructure:ms.description,isResearchOnly:true};
}
export async function futuresSnapshot(symbol:SymbolId):Promise<Snapshot>{
 const url='https://fapi.binance.com';const warnings:string[]=[];
 async function get(path:string){try{const r=await fetch(url+path,{cache:'no-store',signal:AbortSignal.timeout(6500)});if(!r.ok)throw Error(String(r.status));return await r.json() as any;}catch{warnings.push(`Unavailable: ${path.split('?')[0]}`);return null;}}
 const [premium,oi,depth]=await Promise.all([get(`/fapi/v1/premiumIndex?symbol=${symbol}`),get(`/fapi/v1/openInterest?symbol=${symbol}`),get(`/fapi/v1/depth?symbol=${symbol}&limit=20`)]);
 const bid=Number(depth?.bids?.[0]?.[0]),ask=Number(depth?.asks?.[0]?.[0]);
 const bv=Array.isArray(depth?.bids)?depth.bids.reduce((s:number,x:string[])=>s+Number(x[1]),0):NaN;
 const av=Array.isArray(depth?.asks)?depth.asks.reduce((s:number,x:string[])=>s+Number(x[1]),0):NaN;
 return {fundingRate:premium?.lastFundingRate!=null&&Number.isFinite(Number(premium.lastFundingRate))?Number(premium.lastFundingRate):null,
  openInterest:oi?.openInterest!=null&&Number.isFinite(Number(oi.openInterest))?Number(oi.openInterest):null,
  bidAskSpreadPct:bid>0&&ask>0?(ask-bid)/((bid+ask)/2)*100:null,
  orderBookImbalance:Number.isFinite(bv+av)&&bv+av>0?(bv-av)/(bv+av):null,warnings};
}
