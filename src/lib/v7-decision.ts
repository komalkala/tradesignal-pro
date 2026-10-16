import type {Candle,SymbolId,Side} from './types';
import {ema,rsi,macd,atr} from './indicators';
import {evaluateSwing,type SwingSetup} from './swing-research';
export type V7Status='CONFIRMED_LONG'|'CONFIRMED_SHORT'|'SETUP_FORMING'|'WAIT'|'INSUFFICIENT_DATA';
export type V7Check={key:string;name:string;passed:boolean;detail:string};
export type V7Decision={symbol:SymbolId;status:V7Status;side:Side|null;score:number;signalTime:number;expiresAt:number;isFresh:boolean;bias:SwingSetup['bias'];trend:SwingSetup['trend'];entry:number|null;stop:number|null;target:number|null;checks:V7Check[];missing:string[];message:string;researchOnly:true};
const H=3600000;
const lastClosed=(candles:Candle[],cutoff:number,period:number)=>{for(let i=candles.length-1;i>=0;i--)if(candles[i].time+period<=cutoff)return i;return -1};
export function v7Decision(symbol:SymbolId,hour:Candle[],four:Candle[],day:Candle[],now=Date.now()):V7Decision{
 const i=lastClosed(hour,now,H);if(i<0)throw Error('No completed 1h candle');
 const c=hour[i],closed=c.time+H;
 const j=lastClosed(four,closed,4*H),k=lastClosed(day,closed,24*H);
 const enough=i>=210&&j>=210&&k>=210;
 const old=evaluateSwing(symbol,hour.slice(0,i+1),four,day,i);
 const base={symbol,signalTime:closed,expiresAt:closed+H,isFresh:now-closed<=H+120000,bias:old.bias,trend:old.trend,entry:old.entry,stop:old.stop,target:old.target,researchOnly:true as const};
 if(!enough)return {...base,status:'INSUFFICIENT_DATA',side:null,score:0,checks:[],missing:['At least 211 completed candles required for each timeframe'],message:'Historical data insufficient; no confirmed setup.'};
 const h=hour.slice(0,i+1),cl=h.map(x=>x.close),e=ema(cl,20),rs=rsi(cl),m=macd(cl),a=atr(h);
 const last=i;const prev=h[i-1];const up=prev.close<=e[last-1]&&c.close>e[last]&&c.close>c.open;
 const down=prev.close>=e[last-1]&&c.close<e[last]&&c.close<c.open;
 const bullBreak=c.close>Math.max(...h.slice(-7,-1).map(x=>x.high));
 const bearBreak=c.close<Math.min(...h.slice(-7,-1).map(x=>x.low));
 const avgVol=h.slice(-21,-1).reduce((v,x)=>v+x.volume,0)/20;
 const ratio=avgVol>0?c.volume/avgVol:0;
 const preferred:Side|null=old.bias==='BULLISH'&&old.trend==='BULLISH'?'LONG':old.bias==='BEARISH'&&old.trend==='BEARISH'?'SHORT':null;
 const checks:V7Check[]=[
 {key:'bias',name:'1D and 4H alignment',passed:preferred!==null,detail:`1D ${old.bias} / 4H ${old.trend}`},
 {key:'pullback',name:'1H EMA20 reclaim or rejection',passed:preferred==='LONG'?up:preferred==='SHORT'?down:false,detail:up?'Bullish reclaim':down?'Bearish rejection':'Not confirmed'},
 {key:'structure',name:'1H structure break',passed:preferred==='LONG'?bullBreak:preferred==='SHORT'?bearBreak:false,detail:bullBreak?'Breakout':bearBreak?'Breakdown':'Not confirmed'},
 {key:'rsi',name:'1H RSI momentum',passed:preferred==='LONG'?rs[last]>=50&&rs[last]<=72:preferred==='SHORT'?rs[last]<=50&&rs[last]>=28:false,detail:Number.isFinite(rs[last])?rs[last].toFixed(1):'N/A'},
 {key:'macd',name:'MACD histogram',passed:preferred==='LONG'?m.histogram[last]>0:preferred==='SHORT'?m.histogram[last]<0:false,detail:Number.isFinite(m.histogram[last])?m.histogram[last].toFixed(4):'N/A'},
 {key:'volume',name:'Volume confirmation >= 1.05x',passed:ratio>=1.05,detail:`${ratio.toFixed(2)}x`},
 {key:'atr',name:'Valid ATR',passed:Number.isFinite(a[last])&&a[last]>0,detail:Number.isFinite(a[last])?a[last].toFixed(4):'N/A'},
 ];
 const missing=checks.filter(x=>!x.passed).map(x=>x.name);
 const confirmed=old.decision!=='WAIT'&&checks.every(x=>x.passed);
 const forming=preferred!==null&&(checks[1].passed||checks[2].passed||checks[3].passed||checks[4].passed);
 const status:V7Status=confirmed?(old.decision==='LONG'?'CONFIRMED_LONG':'CONFIRMED_SHORT'):forming?'SETUP_FORMING':'WAIT';
 return {...base,status,side:confirmed?old.decision:preferred,score:Math.round(checks.filter(x=>x.passed).length/checks.length*100),checks,missing,message:confirmed?'Historically defined setup confirmed on last closed 1h candle; research-only, not a verified profitable signal.':forming?'Trend aligned and partial setup present; do not mistake this for confirmation.':'No qualified setup. Waiting is an acceptable trading decision.'};
}
