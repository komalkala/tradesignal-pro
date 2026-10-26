import {NextRequest,NextResponse} from 'next/server';
import {getCandles} from '@/lib/binance';
import {SYMBOLS,type SymbolId} from '@/lib/types';
import {analyzeAggTrades,analyzeVolume,type AggTrade} from '@/lib/order-flow';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 try{
  const symbol=req.nextUrl.searchParams.get('symbol')??'BTCUSDT';
  if(!SYMBOLS.some(s=>s===symbol))return NextResponse.json({error:'Unsupported symbol'},{status:400});
  const id=symbol as SymbolId;
  const url=new URL('https://fapi.binance.com/fapi/v1/aggTrades');
  url.searchParams.set('symbol',id);url.searchParams.set('limit','1000');
  const [tradeResp,h1,h4]=await Promise.all([fetch(url,{cache:'no-store',signal:AbortSignal.timeout(12000)}),getCandles(id,'1h',250),getCandles(id,'4h',250)]);
  if(!tradeResp.ok)throw Error(`Binance aggregated trades API HTTP ${tradeResp.status}`);
  const trades:unknown=await tradeResp.json();
  if(!Array.isArray(trades))throw Error('Unexpected aggregated trades response');
  const valid=trades.filter((x):x is AggTrade=>typeof x==='object'&&x!==null&&'p'in x&&'q'in x&&'m'in x&&'T'in x&&typeof x.m==='boolean');
  const flow=analyzeAggTrades(valid);
  if(flow.buyersUsdt+flow.sellersUsdt===0)throw Error('No valid trades');
  return NextResponse.json({symbol:id,checkedAt:new Date().toISOString(),orderFlow:flow,volume1h:analyzeVolume(h1,'1h'),volume4h:analyzeVolume(h4,'4h'),notes:['Buyer/seller pressure uses 1,000 most recent Binance Futures aggregated trades, not the entire previous hour.','m=false means buyer was the taker (aggressive buy); m=true means seller was the taker (aggressive sell).','High/low volume compares the last closed candle with the previous 20 closed candles.','Dominance is descriptive, not a prediction or a confirmed trade entry.']});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:String(e)},{status:502});}
}
