import {NextRequest,NextResponse} from 'next/server';
import {loadHistoricalCandles} from '@/lib/history';
import {runQuickBacktest} from '@/lib/quick-backtest';
import {analyzeOutOfSample} from '@/lib/research';
import type {SymbolId} from '@/lib/types';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 const symbol=req.nextUrl.searchParams.get('symbol')??'SOLUSDT';
 if(!['SOLUSDT','BTCUSDT','ETHUSDT'].includes(symbol))return NextResponse.json({error:'Invalid symbol'},{status:400});
 const bars=Number(req.nextUrl.searchParams.get('bars')??5000);
 const maxMinutes=Number(req.nextUrl.searchParams.get('maxMinutes')??60);
 if(!Number.isInteger(bars)||bars<1000||bars>10000||![15,30,45,60].includes(maxMinutes))return NextResponse.json({error:'bars: 1000–10000; maxMinutes: 15,30,45,60'},{status:400});
 try{
  const [candles,higher,hourly,btcHourly]=await Promise.all([
   loadHistoricalCandles(symbol as SymbolId,'5m',bars),
   loadHistoricalCandles(symbol as SymbolId,'15m',Math.min(10000,Math.ceil(bars/3)+260)),
   loadHistoricalCandles(symbol as SymbolId,'1h',Math.min(10000,Math.ceil(bars/12)+260)),
   loadHistoricalCandles('BTCUSDT','1h',Math.min(10000,Math.ceil(bars/12)+260))]);
  const result=runQuickBacktest({candles,higher,hourly,btcHourly,symbol:symbol as SymbolId,settings:{maxMinutes}});
  const splitTime=candles[Math.floor(candles.length*.7)].time;
  return NextResponse.json({result,validation:analyzeOutOfSample(result,splitTime),symbol,interval:'5m',historyBars:candles.length,historyFrom:new Date(candles[0].time).toISOString(),historyTo:new Date(candles.at(-1)!.time).toISOString(),holdMinutes:maxMinutes},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Quick backtest failed'},{status:502});}
}
