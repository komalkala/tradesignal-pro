import type {Candle} from './types';

export type AggTrade={p:string;q:string;m:boolean;T:number};
export type Pressure='BUYERS_DOMINANT'|'SELLERS_DOMINANT'|'BALANCED';
export type VolumeLevel='HIGH'|'LOW'|'NORMAL';
export type OrderFlow={buyersUsdt:number;sellersUsdt:number;buyPercent:number;sellPercent:number;imbalancePercent:number;pressure:Pressure;tradeCount:number;firstTradeTime:number|null;lastTradeTime:number|null;};
export type VolumeReport={interval:'1h'|'4h';lastCandleTime:number;lastClosedVolume:number;averagePrevious20:number;volumeRatio:number;level:VolumeLevel;direction:'UP'|'DOWN'|'FLAT'};
export function analyzeAggTrades(trades:AggTrade[]):OrderFlow{
 let buyersUsdt=0,sellersUsdt=0;let firstTradeTime:number|null=null,lastTradeTime:number|null=null;
 for(const t of trades){const p=Number(t.p),q=Number(t.q);if(!Number.isFinite(p)||!Number.isFinite(q)||p<=0||q<=0||!Number.isFinite(t.T))continue;
 const v=p*q;if(t.m)sellersUsdt+=v;else buyersUsdt+=v;firstTradeTime=firstTradeTime===null? t.T:Math.min(firstTradeTime,t.T);lastTradeTime=lastTradeTime===null?t.T:Math.max(lastTradeTime,t.T);
 }
 const total=buyersUsdt+sellersUsdt;const buyPercent=total?buyersUsdt/total*100:50;const sellPercent=total?sellersUsdt/total*100:50;
 const imbalancePercent=buyPercent-sellPercent;
 const pressure:Pressure=total===0||Math.abs(imbalancePercent)<10?'BALANCED':imbalancePercent>0?'BUYERS_DOMINANT':'SELLERS_DOMINANT';
 return {buyersUsdt,sellersUsdt,buyPercent,sellPercent,imbalancePercent,pressure,tradeCount:trades.length,firstTradeTime,lastTradeTime};
}
export function analyzeVolume(candles:Candle[],interval:'1h'|'4h'):VolumeReport{
 if(candles.length<21)throw Error('Need 21 completed candles for volume baseline');
 const last=candles[candles.length-1],prev=candles.slice(-21,-1);
 const averagePrevious20=prev.reduce((s,c)=>s+c.volume,0)/prev.length;
 if(!Number.isFinite(averagePrevious20)||averagePrevious20<=0)throw Error('Invalid volume baseline');
 const volumeRatio=last.volume/averagePrevious20;
 const level:VolumeLevel=volumeRatio>=1.5?'HIGH':volumeRatio<=0.7?'LOW':'NORMAL';
 return {interval,lastCandleTime:last.time,lastClosedVolume:last.volume,averagePrevious20,volumeRatio,level,direction:last.close>last.open?'UP':last.close<last.open?'DOWN':'FLAT'};
}
