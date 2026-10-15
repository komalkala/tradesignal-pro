import {NextRequest,NextResponse} from 'next/server';
import {loadHistoricalCandles} from '@/lib/history';
import {detectRegime} from '@/lib/market-regime';
import {researchEntry} from '@/lib/entry-confirmation';
import {runQuickBacktest} from '@/lib/quick-backtest';
import {performanceMetrics} from '@/lib/performance-metrics';
import {chronologicalValidation} from '@/lib/walk-forward';
import {SYMBOLS, type SymbolId} from '@/lib/types';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 const symbol=req.nextUrl.searchParams.get('symbol')??'SOLUSDT';
 if(!SYMBOLS.some(s=>s===symbol))return NextResponse.json({error:'Invalid symbol'},{status:400});
 try{
  const s=symbol as SymbolId,bars=2500;
  const [candles,fifteen,hourly,btcHourly]=await Promise.all([
   loadHistoricalCandles(s,'5m',bars),loadHistoricalCandles(s,'15m',1200),
   loadHistoricalCandles(s,'1h',550),loadHistoricalCandles('BTCUSDT','1h',550)
  ]);
  const result=runQuickBacktest({symbol:s,candles,higher:fifteen,hourly,btcHourly,settings:{maxMinutes:60}});
  return NextResponse.json({symbol,interval:'5m',researchOnly:true,regime:detectRegime(candles),entries:{long:researchEntry(candles,'LONG'),short:researchEntry(candles,'SHORT')},baseline:performanceMetrics(result.trades),validation:chronologicalValidation(result.trades,candles[0].time,candles.at(-1)!.time),historyBars:candles.length,assumptions:result.warnings},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Research failed'},{status:502});}
}
