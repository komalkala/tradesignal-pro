import {NextRequest,NextResponse} from 'next/server';
import {getCandles} from '@/lib/binance';
import {futuresSnapshot,profile,qualitySignal} from '@/lib/pro';
import {parseMarketParams} from '@/lib/market-params';
import type {Interval} from '@/lib/types';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 const p=parseMarketParams(req.nextUrl.searchParams);if('error'in p)return NextResponse.json(p,{status:400});
 try{
  const higher:Interval=p.interval==='15m'?'1h':p.interval==='1h'?'4h':p.interval==='4h'?'1d':'1w';
  const [candles,higherCandles,btcCandles,snapshot]=await Promise.all([
   getCandles(p.symbol,p.interval,700),getCandles(p.symbol,higher,300),getCandles('BTCUSDT',higher,300),futuresSnapshot(p.symbol)]);
  const signal=qualitySignal({candles,higher:profile(higherCandles),btc:profile(btcCandles),symbol:p.symbol,snapshot});
  return NextResponse.json({symbol:p.symbol,interval:p.interval,higherInterval:higher,candles,signal,higher:profile(higherCandles),btc:profile(btcCandles),snapshot,updatedAt:new Date().toISOString()},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Market request failed'},{status:502});}
}
