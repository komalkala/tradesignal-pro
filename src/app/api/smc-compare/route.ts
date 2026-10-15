import {NextRequest,NextResponse} from 'next/server';
import {loadHistoricalCandles} from '@/lib/history';
import {runQuickBacktest} from '@/lib/quick-backtest';
import {detectSmcEvents,runSmcBacktest} from '@/lib/smc-research';
import {runHighProbabilityBacktest} from '@/lib/high-probability-research';
import {performanceMetrics} from '@/lib/performance-metrics';
import {SYMBOLS,type SymbolId} from '@/lib/types';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 const symbol=req.nextUrl.searchParams.get('symbol')??'SOLUSDT';
 if(!SYMBOLS.some(s=>s===symbol))return NextResponse.json({error:'Invalid symbol'},{status:400});
 const bars=Number(req.nextUrl.searchParams.get('bars')??2500);
 if(!Number.isInteger(bars)||bars<1000||bars>5000)return NextResponse.json({error:'bars must be 1000–5000'},{status:400});
 try{
  const s=symbol as SymbolId;
  const [candles,fifteen,hourly,btcHourly]=await Promise.all([
   loadHistoricalCandles(s,'5m',bars),loadHistoricalCandles(s,'15m',Math.ceil(bars/3)+260),
   loadHistoricalCandles(s,'1h',Math.ceil(bars/12)+260),loadHistoricalCandles('BTCUSDT','1h',Math.ceil(bars/12)+260)
  ]);
  const baseline=runQuickBacktest({candles,higher:fifteen,hourly,btcHourly,symbol:s,settings:{maxMinutes:60}});
  const smc=runSmcBacktest(candles);
  const highProbability=runHighProbabilityBacktest({candles,hourly,btcHourly,symbol:s});
  const cutoff=candles[Math.floor(candles.length*.7)].time;
  const split=(trades:{entryTime:number;exitTime:number;pnl:number}[])=>({
   training:performanceMetrics(trades.filter(t=>t.entryTime<cutoff)),
   holdout:performanceMetrics(trades.filter(t=>t.entryTime>=cutoff))
  });
  return NextResponse.json({symbol,interval:'5m',bars:candles.length,from:new Date(candles[0].time).toISOString(),to:new Date(candles.at(-1)!.time).toISOString(),cutoff:new Date(cutoff).toISOString(),researchOnly:true,baseline:{metrics:performanceMetrics(baseline.trades),split:split(baseline.trades),sample:baseline.trades.slice(-10)},highProbability:{metrics:highProbability.metrics,split:split(highProbability.trades),sample:highProbability.trades.slice(-10)},smc:{metrics:smc.metrics,split:split(smc.trades),events:detectSmcEvents(candles,25),sample:smc.trades.slice(-10)},assumptions:['Both strategies run on the same 5-minute history','0.05% taker fee/side, 0.02% adverse slippage/side','60-minute maximum holding; next-bar entry and stop-first OHLC ambiguity','Risk budget 0.5% per trade, initial equity 750 USDT','Distinct strategy entry logic; same backtest cost and exit model assumptions','Only closed historical candles; chronological 70/30 split, not trained walk-forward optimization','High-probability strategy is experimental and only uses previously closed 1h trend data','Small holdout samples are inconclusive; no live alerts enabled']},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Comparison unavailable'},{status:502});}
}
