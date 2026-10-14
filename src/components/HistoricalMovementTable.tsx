'use client';
import {Fragment,useCallback,useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {ArrowLeft,ChevronDown,ChevronUp,Download,RefreshCw} from 'lucide-react';

type SymbolId='BTCUSDT'|'SOLUSDT'|'ETHUSDT';
type Interval='1d'|'1h'|'5m';
type Bar={time:number;open:number;high:number;low:number;close:number;volume:number;quoteVolume:number;trades:number};
const DAY=86_400_000;
const toDate=(ms:number)=>new Date(ms).toISOString().slice(0,10);
const num=(v:number,d=2)=>v.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
const percent=(v:number)=>`${v>=0?'+':''}${v.toFixed(2)}%`;
const dayReturn=(r:Bar)=>100*(r.close-r.open)/r.open;
const rangePct=(r:Bar)=>100*(r.high-r.low)/r.open;
const utcTime=(t:number)=>new Date(t).toLocaleString('en-GB',{timeZone:'UTC',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});
const validDay=(text:string)=>/^\d{4}-\d{2}-\d{2}$/.test(text)&&!Number.isNaN(new Date(text+'T00:00:00Z').getTime());
const parseDay=(text:string)=>new Date(text+'T00:00:00Z').getTime();
const startingDates=()=>{const now=new Date();const end=toDate(now.getTime());const startDate=new Date(Date.UTC(now.getUTCFullYear()-4,now.getUTCMonth(),now.getUTCDate()));return {start:toDate(startDate.getTime()),end};};
function downloadCsv(name:string,headers:string[],values:(string|number)[][]){
 const escape=(v:string|number)=>'"'+String(v).replaceAll('"','""')+'"';
 const csv='\uFEFF'+[headers,...values].map(row=>row.map(escape).join(',')).join('\r\n');
 const href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
 const a=document.createElement('a');a.href=href;a.download=name;document.body.append(a);a.click();a.remove();URL.revokeObjectURL(href);
}
async function fetchBars(symbol:SymbolId,interval:Interval,start:number,end:number,signal?:AbortSignal):Promise<Bar[]>{
 const res=await fetch(`/api/historical-data?${new URLSearchParams({symbol,interval,start:String(start),end:String(end)})}`,{signal,cache:'no-store'});
 const data=await res.json();if(!res.ok)throw Error(data.error??'Market data unavailable');return data.rows as Bar[];
}
export default function HistoricalMovementTable(){
 const initial=useMemo(startingDates,[]);
 const [symbol,setSymbol]=useState<SymbolId>('SOLUSDT');
 const [start,setStart]=useState(initial.start);
 const [end,setEnd]=useState(initial.end);
 const [direction,setDirection]=useState('all');
 const [search,setSearch]=useState('');
 const [sort,setSort]=useState<'newest'|'oldest'|'changeUp'|'changeDown'|'range'>('newest');
 const [page,setPage]=useState(1);
 const [rows,setRows]=useState<Bar[]>([]);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');
 const [refresh,setRefresh]=useState(0);
 const [expanded,setExpanded]=useState<number|null>(null);
 const [detailMode,setDetailMode]=useState<'1h'|'5m'>('1h');
 const [detail,setDetail]=useState<Bar[]>([]);
 const [detailError,setDetailError]=useState('');
 const [detailLoading,setDetailLoading]=useState(false);
 useEffect(()=>{
  const controller=new AbortController();setRows([]);setExpanded(null);setPage(1);
  if(!validDay(start)||!validDay(end)||parseDay(start)>parseDay(end)){setError('Select a valid start/end date');return ()=>controller.abort();}
  const startMs=parseDay(start);const endMs=parseDay(end)+DAY;
  if(endMs-startMs>4*366*DAY+DAY){setError('Select a range of four years or less');return ()=>controller.abort();}
  (async()=>{setLoading(true);setError('');try{const result=await fetchBars(symbol,'1d',startMs,endMs,controller.signal);if(!controller.signal.aborted)setRows(result);}catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Unable to load data');}finally{if(!controller.signal.aborted)setLoading(false);}})();
  return ()=>controller.abort();
 },[symbol,start,end,refresh]);
 useEffect(()=>{const controller=new AbortController();setDetail([]);setDetailError('');if(expanded===null)return ()=>controller.abort();
  (async()=>{setDetailLoading(true);try{const result=await fetchBars(symbol,detailMode,expanded,expanded+DAY,controller.signal);if(!controller.signal.aborted)setDetail(result);}catch(e){if(!controller.signal.aborted)setDetailError(e instanceof Error?e.message:'Could not load intraday detail');}finally{if(!controller.signal.aborted)setDetailLoading(false);}})();
  return ()=>controller.abort();
 },[symbol,expanded,detailMode]);
 const filtered=useMemo(()=>rows.filter(r=>{
  const change=dayReturn(r);const range=rangePct(r);
  const match=direction==='all'||direction==='up'&&change>0||direction==='down'&&change<0||direction==='volatile'&&range>=5;
  return match&&(!search||toDate(r.time).includes(search.trim()));
 }).sort((a,b)=>sort==='oldest'?a.time-b.time:sort==='newest'?b.time-a.time:sort==='changeUp'?dayReturn(b)-dayReturn(a):sort==='changeDown'?dayReturn(a)-dayReturn(b):rangePct(b)-rangePct(a)),[rows,direction,search,sort]);
 const pages=Math.max(1,Math.ceil(filtered.length/25));
 const visible=filtered.slice((Math.min(page,pages)-1)*25,Math.min(page,pages)*25);
 const summary=useMemo(()=>({up:rows.filter(r=>r.close>r.open).length,down:rows.filter(r=>r.close<r.open).length,high:rows.filter(r=>rangePct(r)>=5).length}),[rows]);
 const exportDaily=useCallback(()=>downloadCsv(`${symbol}-daily-${start}-${end}.csv`,['Date UTC','Open','High','Low','Close','Change % (open-close)','Range % (high-low / open)','Base volume','Quote volume USDT','Trades'],filtered.map(r=>[toDate(r.time),r.open,r.high,r.low,r.close,dayReturn(r).toFixed(4),rangePct(r).toFixed(4),r.volume,r.quoteVolume,r.trades])),[symbol,start,end,filtered]);
 return <main className="mx-auto max-w-[1460px] px-4 sm:px-6 py-7 sm:py-9 text-[13px]">
  <div className="flex flex-wrap items-center justify-between gap-3 mb-6"><div><Link className="inline-flex items-center gap-2 text-[#9ecbc8] mb-3 hover:underline" href="/"><ArrowLeft size={14}/> Back to trading dashboard</Link><h1 className="text-xl font-medium">Historical Market Movement</h1><p className="muted mt-1">BTC · SOL · ETH | Binance USDT Futures | UTC daily candles | Table only</p></div><button type="button" className="rounded-md border border-[#365165] px-3 py-2 flex gap-2 items-center" onClick={exportDaily} disabled={!filtered.length}><Download size={15}/> Export CSV</button></div>
  <section className="panel p-4 sm:p-5 mb-4"><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
   <label className="block"><span className="muted block mb-1">Coin</span><select className="w-full rounded-md bg-[#203246] border border-[#385065] p-2.5" value={symbol} onChange={e=>setSymbol(e.target.value as SymbolId)}><option value="SOLUSDT">SOL / USDT</option><option value="BTCUSDT">BTC / USDT</option><option value="ETHUSDT">ETH / USDT</option></select></label>
   <label className="block"><span className="muted block mb-1">From (UTC)</span><input type="date" className="w-full rounded-md bg-[#203246] border border-[#385065] p-2.5" value={start} max={end} onChange={e=>setStart(e.target.value)}/></label>
   <label className="block"><span className="muted block mb-1">To (UTC)</span><input type="date" className="w-full rounded-md bg-[#203246] border border-[#385065] p-2.5" value={end} min={start} max={toDate(Date.now())} onChange={e=>setEnd(e.target.value)}/></label>
   <label className="block"><span className="muted block mb-1">Direction</span><select className="w-full rounded-md bg-[#203246] border border-[#385065] p-2.5" value={direction} onChange={e=>{setDirection(e.target.value);setPage(1);}}><option value="all">All days</option><option value="up">Bullish</option><option value="down">Bearish</option><option value="volatile">Range ≥ 5%</option></select></label>
   <label className="block"><span className="muted block mb-1">Sort</span><select className="w-full rounded-md bg-[#203246] border border-[#385065] p-2.5" value={sort} onChange={e=>setSort(e.target.value as typeof sort)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="changeUp">Biggest gains</option><option value="changeDown">Biggest losses</option><option value="range">Highest range</option></select></label>
   <button type="button" className="rounded-md bg-[#316c6b] px-3 py-2.5 flex gap-2 items-center justify-center" onClick={()=>setRefresh(n=>n+1)}><RefreshCw size={15}/> Refresh</button>
  </div></section>
  {error&&<div role="alert" className="rounded-md border border-rose-700 p-3 text-rose-300 mb-4">{error}</div>}
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">{[{label:'Completed days',value:rows.length},{label:'Bullish days',value:summary.up},{label:'Bearish days',value:summary.down},{label:'Range ≥ 5% days',value:summary.high}].map(s=><div className="panel p-3" key={s.label}><p className="muted text-xs">{s.label}</p><p className="text-xl font-medium mt-1 number">{loading?'…':s.value}</p></div>)}</div>
  <section className="panel overflow-hidden"><div className="p-4 flex flex-wrap gap-3 justify-between items-center border-b border-[#2a3a4b]"><div><h2 className="font-medium">Daily movement table</h2><p className="muted text-xs">Click a day to explore hourly or 5-minute movement. Exchange timestamps use UTC.</p></div><input placeholder="Filter date (YYYY-MM-DD)" aria-label="Filter date" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} className="rounded-md bg-[#203246] border border-[#385065] px-3 py-2 w-full sm:w-56"/></div>
   <div className="overflow-x-auto"><table className="w-full min-w-[1020px] text-left"><thead className="bg-[#1d2e40] text-[#aabccb]"><tr>{['Date (UTC)','Open','High','Low','Close','Change %','Range %','Volume (USDT)','Direction','Details'].map(h=><th key={h} className="p-3 font-medium whitespace-nowrap">{h}</th>)}</tr></thead><tbody>
    {visible.map(r=><Fragment key={r.time}>{<tr key={r.time} className="border-t border-[#2a3a4b] hover:bg-[#213347]"><td className="p-3 whitespace-nowrap">{toDate(r.time)}</td>{[r.open,r.high,r.low,r.close].map((v,i)=><td key={i} className="p-3 number">${num(v)}</td>)}<td className={'p-3 font-medium number '+(dayReturn(r)>=0?'text-[#75d9aa]':'text-[#ec929a]')}>{percent(dayReturn(r))}</td><td className="p-3 number">{num(rangePct(r))}%</td><td className="p-3 number">{num(r.quoteVolume,0)}</td><td className="p-3">{r.close>r.open?'Bullish':r.close<r.open?'Bearish':'Flat'}</td><td className="p-3"><button type="button" aria-label={'Show details '+toDate(r.time)} onClick={()=>setExpanded(v=>v===r.time?null:r.time)} className="flex items-center gap-1 text-[#9ed7d0]">{expanded===r.time?<ChevronUp size={16}/>:<ChevronDown size={16}/>} Details</button></td></tr>}
    {expanded===r.time&&<tr key={'detail-'+r.time} className="bg-[#101e2d]"><td colSpan={10} className="p-4"><div className="flex flex-wrap justify-between items-center gap-3 mb-3"><div><strong>{toDate(r.time)} — Intraday breakdown</strong><p className="muted text-xs">Times shown in UTC; only completed candles</p></div><div className="flex gap-2"><button type="button" onClick={()=>setDetailMode('1h')} className={'px-3 py-1.5 rounded-md '+(detailMode==='1h'?'bg-[#317574]':'bg-[#263a4b]')}>1 hour</button><button type="button" onClick={()=>setDetailMode('5m')} className={'px-3 py-1.5 rounded-md '+(detailMode==='5m'?'bg-[#317574]':'bg-[#263a4b]')}>5 minutes</button><button type="button" onClick={()=>downloadCsv(`${symbol}-${toDate(r.time)}-${detailMode}.csv`,['Time UTC','Open','High','Low','Close','Change %','Volume USDT'],detail.map(d=>[new Date(d.time).toISOString(),d.open,d.high,d.low,d.close,dayReturn(d).toFixed(4),d.quoteVolume]))} disabled={!detail.length} className="px-3 py-1.5 rounded-md bg-[#263a4b]">Export detail</button></div></div>{detailLoading?<p className="muted">Loading intraday candles…</p>:detailError?<p className="text-rose-300">{detailError}</p>:<div className="max-h-[300px] overflow-auto"><table className="w-full"><thead><tr>{['Time UTC','Open','High','Low','Close','Change %','Volume USDT'].map(h=><th className="text-left p-2 whitespace-nowrap" key={h}>{h}</th>)}</tr></thead><tbody>{detail.map(d=><tr key={d.time} className="border-t border-[#2a3a4b]"><td className="p-2 whitespace-nowrap">{utcTime(d.time)}</td>{[d.open,d.high,d.low,d.close].map((v,i)=><td key={i} className="p-2 number">${num(v)}</td>)}<td className={'p-2 '+(dayReturn(d)>=0?'text-[#75d9aa]':'text-[#ec929a]')}>{percent(dayReturn(d))}</td><td className="p-2 number">{num(d.quoteVolume,0)}</td></tr>)}</tbody></table>{!detail.length&&<p className="muted p-2">No completed intraday candles returned.</p>}</div>}</td></tr>}
    </Fragment>)}
   </tbody></table>{!loading&&!visible.length&&<p className="p-8 text-center muted">No matching completed daily candles.</p>}{loading&&<p className="p-8 text-center muted">Loading historical data from Binance…</p>}</div>
   <div className="p-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#2a3a4b]"><span className="muted">{filtered.length} matching days · Page {Math.min(page,pages)} of {pages}</span><div className="flex items-center gap-2"><button className="rounded-md border border-[#385065] px-3 py-1.5 disabled:opacity-40" disabled={page<=1} onClick={()=>{setPage(p=>p-1);setExpanded(null);}}>Previous</button><button className="rounded-md border border-[#385065] px-3 py-1.5 disabled:opacity-40" disabled={page>=pages} onClick={()=>{setPage(p=>p+1);setExpanded(null);}}>Next</button></div></div>
  </section><p className="muted text-xs mt-3">Change % = (close − open) / open. Range % = (high − low) / open. Values are historical observations, not future price predictions. Fetched from Binance USDT perpetual futures public market data.</p>
 </main>;
}
