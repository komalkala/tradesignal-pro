import {SYMBOLS as AVAILABLE_SYMBOLS} from '@/lib/types';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const SYMBOLS = new Set<string>(AVAILABLE_SYMBOLS);
const INTERVALS = new Set(['1d','1h','5m']);
const INTERVAL_MS: Record<string,number> = {'1d':86_400_000,'1h':3_600_000,'5m':300_000};
const FOUR_YEARS_MS = 4 * 366 * 86_400_000;
type Bar = { time:number; open:number; high:number; low:number; close:number; volume:number; quoteVolume:number; trades:number };
function fail(message:string,status=400){return NextResponse.json({error:message},{status});}
export async function GET(request: NextRequest){
 const query=request.nextUrl.searchParams;
 const symbol=query.get('symbol')??'SOLUSDT';
 const interval=query.get('interval')??'1d';
 if(!SYMBOLS.has(symbol)||!INTERVALS.has(interval)) return fail('Unsupported symbol or interval');
 const start=Number(query.get('start'));
 const end=Number(query.get('end'));
 const now=Date.now();
 if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end<=start||end>now+86_400_000)return fail('Invalid date range');
 if(end-start>FOUR_YEARS_MS+86_400_000)return fail('Select at most four years');
 if(interval==='5m'&&end-start>2*86_400_000)return fail('5m detail may cover at most two days');
 if(interval==='1h'&&end-start>32*86_400_000)return fail('Hourly detail may cover at most 32 days');
 const maximum=interval==='1d'?1600:interval==='1h'?800:600;
 const rows:Bar[]=[];
 let cursor=start;
 try{
  while(cursor<end&&rows.length<maximum){
   const url=new URL('https://fapi.binance.com/fapi/v1/klines');
   url.searchParams.set('symbol',symbol);
   url.searchParams.set('interval',interval);
   url.searchParams.set('startTime',String(cursor));
   url.searchParams.set('endTime',String(Math.min(end-1,now)));
   url.searchParams.set('limit','1000');
   const res=await fetch(url,{signal:AbortSignal.timeout(15000),cache:'no-store'});
   if(!res.ok) throw new Error(`Binance returned ${res.status}`);
   const json:unknown=await res.json();
   if(!Array.isArray(json))throw new Error('Unexpected Binance response');
   const batch:Bar[]=json.map(row=>{
     if(!Array.isArray(row)||row.length<9)throw new Error('Malformed candle');
     return {time:Number(row[0]),open:Number(row[1]),high:Number(row[2]),low:Number(row[3]),close:Number(row[4]),volume:Number(row[5]),quoteVolume:Number(row[7]),trades:Number(row[8])};
   });
   if(batch.some(b=> !Object.values(b).every(Number.isFinite)||b.open<=0||b.high<Math.max(b.open,b.close)||b.low>Math.min(b.open,b.close)||b.low<=0||b.volume<0)) throw new Error('Invalid market candle');
   for(const bar of batch){if(bar.time>=start&&bar.time<end&&bar.time+INTERVAL_MS[interval]<=now&&(!rows.length||bar.time>rows[rows.length-1].time))rows.push(bar);}
   if(batch.length===0)break;
   const next=batch[batch.length-1].time+INTERVAL_MS[interval];
   if(next<=cursor)throw new Error('Non-advancing candle cursor');
   cursor=next;
   if(batch.length<1000)break;
  }
  if(cursor<end&&rows.length>=maximum)return fail('Range exceeds data limit',400);
  return NextResponse.json({symbol,interval,timezone:'UTC',rows,updatedAt:new Date().toISOString()});
 }catch(error){return fail(error instanceof Error?error.message:'Unable to load market data',502);}
}
