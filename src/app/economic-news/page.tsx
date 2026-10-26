'use client';
import {useEffect,useState} from 'react';
import {CalendarClock,RefreshCw,AlertTriangle,ExternalLink} from 'lucide-react';
type Event={id:string;name:string;timeUTC:string;impact:'CRITICAL'|'HIGH'|'MEDIUM';source:string};
type Source={name:string;url:string};
type Response={events:Event[];configured:boolean;level:string;checkedAt:string;calendarLinks:Source[];note:string;tradeControl:string};
const displayTime=(v:string)=>new Date(v).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'short'})+' IST';
export default function EconomicNews(){
 const [data,setData]=useState<Response|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false),[reload,setReload]=useState(0);
 useEffect(()=>{const controller=new AbortController();setLoading(true);setError('');
  fetch('/api/economic-news',{signal:controller.signal,cache:'no-store'}).then(async r=>{const b=await r.json();if(!r.ok)throw Error(b.error||'Failed');setData(b);}).catch(e=>{if(!controller.signal.aborted)setError(String(e))}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});
  return()=>controller.abort();
 },[reload]);
 return <main className="mx-auto max-w-5xl space-y-4 px-4 py-6 text-[13px] text-slate-100 sm:px-6">
  <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-xl font-semibold">Economic News</h1><p className="text-slate-400">CPI, FOMC and other verified scheduled events · India time</p></div><button type="button" disabled={loading} onClick={()=>setReload(n=>n+1)} className="flex items-center gap-2 rounded-md border border-[#3a5968] px-3 py-2 text-teal-200 hover:bg-[#23374a]"><RefreshCw size={14}/>Refresh</button></header>
  <section className="rounded-lg border border-[#375065] bg-[#192838] p-4"><div className="flex gap-2"><AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-300"/><div><p className="font-semibold text-amber-200">CAUTION ONLY — No automatic trade block</p><p className="mt-1 text-slate-300">Events can increase crypto volatility. You decide whether to trade, wait for a completed 1H/4H candle, or adjust your risk. System will never hide a confirmed setup because of news.</p></div></div></section>
  {error&&<p role="alert" className="text-rose-300">{error}</p>}
  {loading&&!data&&<p className="text-slate-400">Loading events…</p>}
  {data&&<><div className={`rounded-lg border p-4 ${data.configured?'border-[#345268] bg-[#162535]':'border-amber-700/60 bg-[#2b281f]'}`}><p className="font-semibold">{data.configured?'Configured Economic Calendar':'Calendar not configured'}</p><p className="mt-1 text-slate-300">{data.note}</p><p className="mt-1 text-xs text-slate-400">Updated {displayTime(data.checkedAt)}</p></div>
   <section className="rounded-lg border border-[#2c4051] bg-[#172333] p-4"><h2 className="mb-3 font-semibold">Upcoming events — next 30 days</h2>{!data.events.length&&<p className="text-slate-400">No events in the configured list. This does not mean the economic calendar is empty.</p>}
    <div className="space-y-2">{data.events.map(e=><div key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-[#203144] p-3"><div className="flex items-start gap-2"><CalendarClock size={17} className="mt-0.5 text-teal-300"/><div><p className="font-medium">{e.name} <span className="ml-1 text-[11px] text-amber-200">{e.impact}</span></p><p className="mt-1 text-slate-400">{displayTime(e.timeUTC)}</p></div></div><a href={e.source} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-teal-300 hover:underline">Official source <ExternalLink size={13}/></a></div>)}</div>
   </section>
   <section className="rounded-lg border border-[#2c4051] bg-[#172333] p-4"><h2 className="font-semibold">Reminder timings</h2><p className="mt-2 text-slate-300">24 hours · 60 minutes · 15 minutes before, via V7 Telegram monitoring when a verified event is configured. Notifications are approximate and depend on the worker being online.</p><div className="mt-3 flex flex-wrap gap-4">{data.calendarLinks.map(c=><a key={c.url} href={c.url} target="_blank" rel="noopener noreferrer" className="text-teal-300 underline">{c.name}</a>)}</div></section>
  </>}
 </main>;
}
