import { NextRequest, NextResponse } from 'next/server';
import { getCandles } from '@/lib/binance';
import { marketStructure } from '@/lib/market-structure';
import { riskContext, EVENT_SOURCES } from '@/lib/event-risk';
import {SYMBOLS, type SymbolId} from '@/lib/types';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 const symbol=req.nextUrl.searchParams.get('symbol')||'SOLUSDT';
 const interval=req.nextUrl.searchParams.get('interval')||'1h';
 if(!SYMBOLS.some(s=>s===symbol)||!['15m','1h','4h','1d'].includes(interval))
  return NextResponse.json({error:'Invalid market params'},{status:400});
 try {
  const now=Date.now();
  const candles=await getCandles(symbol as SymbolId,interval as '15m'|'1h'|'4h'|'1d',280);
  const duration=({'15m':900000,'1h':3600000,'4h':14400000,'1d':86400000} as const)[interval as '15m'|'1h'|'4h'|'1d'];
  const closed=candles.filter(c=>c.time+duration<=now);
  return NextResponse.json({symbol,interval,structure:marketStructure(closed),risk:riskContext(now,symbol.replace('USDT','') as 'BTC'|'ETH'|'SOL'|'TAO'|'LINK'|'BNB'),sources:EVENT_SOURCES,lastClose:closed.at(-1)?.time??null},{headers:{'Cache-Control':'no-store'}});
 } catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Data unavailable'},{status:502});}
}
