import {NextRequest,NextResponse} from 'next/server';
import {parseMarketParams} from '@/lib/market-params';
import {loadHistoricalCandles,INTERVAL_MS} from '@/lib/history';
import {runProBacktest} from '@/lib/pro-backtest';
import {analyzeOutOfSample} from '@/lib/research';
import type {HistoryInterval} from '@/lib/history';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 const p=parseMarketParams(req.nextUrl.searchParams);if('error'in p)return NextResponse.json(p,{status:400});
 const higher:HistoryInterval=p.interval==='15m'?'1h':p.interval==='1h'?'4h':p.interval==='4h'?'1d':'1w';
 try{
  const bars=Number(req.nextUrl.searchParams.get('bars')??5000);
  if(!Number.isInteger(bars)||bars<500||bars>10000)return NextResponse.json({error:'bars must be 500–10000'},{status:400});
  const hBars=Math.min(10000,Math.ceil(bars*INTERVAL_MS[p.interval]/INTERVAL_MS[higher])+250);
  const [candles,high,btc]=await Promise.all([
   loadHistoricalCandles(p.symbol,p.interval,bars),
   loadHistoricalCandles(p.symbol,higher,hBars),
   loadHistoricalCandles('BTCUSDT',higher,hBars)
  ]);
  const result=runProBacktest({candles,higher:high,btc,symbol:p.symbol,entryMs:INTERVAL_MS[p.interval],higherMs:INTERVAL_MS[higher]});
  const splitTime=candles[Math.floor(candles.length*.7)].time;
  const validation=analyzeOutOfSample(result,splitTime);
  return NextResponse.json({symbol:p.symbol,interval:p.interval,higherInterval:higher,result,validation,historyBars:candles.length,historyFrom:new Date(candles[0].time).toISOString(),historyTo:new Date(candles.at(-1)!.time).toISOString(),assumptions:['Next-bar entry after completed candle','Stop-first when both stop and target touched','Flat adverse funding rate; historical funding not reconstructed','In-sample 70% / chronological holdout 30%; descriptive only']},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Backtest failed'},{status:502});}
}
