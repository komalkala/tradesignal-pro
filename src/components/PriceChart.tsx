'use client';
import {useEffect,useRef} from 'react';import {createChart,ColorType,CandlestickSeries,type UTCTimestamp} from 'lightweight-charts';import type {Candle} from '@/lib/types';
export default function PriceChart({candles}:{candles:Candle[]}){
 const host=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(!host.current||!candles.length)return;const element=host.current;
 const chart=createChart(element,{width:element.clientWidth,height:320,layout:{background:{type:ColorType.Solid,color:'#172333'},textColor:'#9badbc'},grid:{vertLines:{color:'#263649'},horzLines:{color:'#263649'}},timeScale:{borderColor:'#324759'},rightPriceScale:{borderColor:'#324759'}});
 const series=chart.addSeries(CandlestickSeries,{upColor:'#5cb89d',downColor:'#e38e97',borderVisible:false,wickUpColor:'#5cb89d',wickDownColor:'#e38e97'});
 series.setData(candles.map(c=>({time:Math.floor(c.time/1000) as UTCTimestamp,open:c.open,high:c.high,low:c.low,close:c.close})));
 // Chart is informational; indicators and signals are computed using the full historical dataset server-side.
 chart.timeScale().fitContent();const observer=new ResizeObserver(()=>chart.applyOptions({width:element.clientWidth}));observer.observe(element);return()=>{observer.disconnect();chart.remove()};
 },[candles]);return <div ref={host} className="w-full" role="img" aria-label="Candlestick market price chart"/>;
}
