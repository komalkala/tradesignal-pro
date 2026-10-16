import {NextRequest,NextResponse} from 'next/server';
import {loadHistoricalCandles} from '@/lib/history';
import {evaluateSwing,backtestSwing} from '@/lib/swing-research';
import {SYMBOLS,type SymbolId} from '@/lib/types';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 const symbol=req.nextUrl.searchParams.get('symbol')??'BTCUSDT';
 if(!SYMBOLS.some(s=>s===symbol))return NextResponse.json({error:'Invalid symbol'},{status:400});
 const bars=Number(req.nextUrl.searchParams.get('bars')??1000);
 if(!Number.isInteger(bars)||bars<500||bars>3000)return NextResponse.json({error:'bars must be 500–3000'},{status:400});
 try{
  const s=symbol as SymbolId;
  // 1d >= 211 closed candles means 7+ months of data for real bias computation.
  const [hour,four,day]=await Promise.all([loadHistoricalCandles(s,'1h',bars),loadHistoricalCandles(s,'4h',Math.max(500,Math.ceil(bars/4)+250)),loadHistoricalCandles(s,'1d',500)]);
  const result=backtestSwing(s,hour,four,day);
  const live=evaluateSwing(s,hour,four,day);
  return NextResponse.json({symbol:s,interval:'1h',bars:hour.length,from:new Date(hour[0].time).toISOString(),to:new Date(hour.at(-1)!.time+3600000).toISOString(),researchOnly:true,live:{...live,executable:false},...result,sample:result.trades.slice(-20),notes:['RESEARCH ONLY: no automatic orders, no Telegram alerts','1d and 4h candle MUST be closed before 1h signal close','1h signal at close; backtest buys/sells at NEXT 1h open','Only 1h data simulated: stop wins when stop and target both touch within same candle','Taker fees and slippage modeled; historical funding and liquidation NOT modeled','70/30 time split is diagnostic, not parameter-fit walk-forward','Historical 1h request maximum 3000 bars (~125 days), not multi-year validation']},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Swing research unavailable'},{status:502});}
}
