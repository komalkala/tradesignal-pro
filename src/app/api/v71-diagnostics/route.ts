import {NextRequest,NextResponse} from 'next/server';
import {loadHistoricalCandles} from '@/lib/history';
import {SYMBOLS,type SymbolId} from '@/lib/types';
import {v7Decision} from '@/lib/v7-decision';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 const name=req.nextUrl.searchParams.get('symbol')||'BTCUSDT';if(!SYMBOLS.includes(name as SymbolId))return NextResponse.json({error:'Invalid symbol'},{status:400});
 try{const sym=name as SymbolId;const [h,f,d]=await Promise.all([loadHistoricalCandles(sym,'1h',500),loadHistoricalCandles(sym,'4h',500),loadHistoricalCandles(sym,'1d',500)]);
 const eligible=h.filter(c=>c.time+3600000<=Date.now());const sample=eligible.slice(-120);
 const fail:Record<string,number>={};const statuses:Record<string,number>={};let evaluated=0;let noData=0;
 const funnel={trendAligned:0,pullback:0,structure:0,pullbackAndStructure:0,volume:0,confirmed:0};
 for(const c of sample){
   const cutoff=c.time+3600000;const hh=eligible.filter(x=>x.time+3600000<=cutoff);
   const result=v7Decision(sym,hh,f,d,cutoff);
   if(result.status==='INSUFFICIENT_DATA'){noData++;continue}
   evaluated++;statuses[result.status]=(statuses[result.status]??0)+1;
   const passed=(key:string)=>result.checks.some(x=>x.key===key&&x.passed);
   if(passed('bias'))funnel.trendAligned++;
   if(passed('bias')&&passed('pullback'))funnel.pullback++;
   if(passed('bias')&&passed('structure'))funnel.structure++;
   if(passed('bias')&&passed('pullback')&&passed('structure'))funnel.pullbackAndStructure++;
   if(passed('bias')&&passed('volume'))funnel.volume++;
   if(result.status==='CONFIRMED_LONG'||result.status==='CONFIRMED_SHORT')funnel.confirmed++;
   for(const x of result.checks)if(!x.passed)fail[x.name]=(fail[x.name]??0)+1;
 }
 const sorted=Object.entries(fail).sort((a,b)=>b[1]-a[1]).map(([reason,count])=>({reason,count,percent:evaluated?count/evaluated*100:0}));
 return NextResponse.json({symbol:sym,sampled:sample.length,evaluated,insufficientData:noData,statuses,funnel,rejections:sorted,notes:'Counts measure completed candles in the recent sample, not win probability. Strict EMA reclaim + structure breakout on the same 1H candle may yield few entries. Do not loosen rules without out-of-sample testing.'},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Diagnostics failed'},{status:502})}
}
