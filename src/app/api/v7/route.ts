import {NextRequest,NextResponse} from 'next/server';
import {loadHistoricalCandles} from '@/lib/history';
import {SYMBOLS,type SymbolId} from '@/lib/types';
import {v7Decision} from '@/lib/v7-decision';
import {eventRisk,parseEvents,officialCalendarLinks} from '@/lib/v7-events';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 const selected=req.nextUrl.searchParams.get('symbol')||'BTCUSDT';
 if(!SYMBOLS.includes(selected as SymbolId))return NextResponse.json({error:'Invalid symbol'},{status:400});
 try{
  const symbol=selected as SymbolId;
  const [hour,four,day]=await Promise.all([loadHistoricalCandles(symbol,'1h',500),loadHistoricalCandles(symbol,'4h',500),loadHistoricalCandles(symbol,'1d',500)]);
  const decision=v7Decision(symbol,hour,four,day);
  const events=eventRisk(parseEvents(process.env.V7_EVENTS_JSON));
  return NextResponse.json({decision,events,officialCalendarLinks,checkedAt:new Date().toISOString(),notes:['Research-only status. No automatic orders.','Economic risk is informational; trading is not blocked.','Events require verified V7_EVENTS_JSON input; empty schedule does not mean no events exist.']},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'V7 evaluation failed'},{status:502});}
}
