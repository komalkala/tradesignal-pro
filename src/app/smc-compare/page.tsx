'use client';

import {useState} from 'react';
import Link from 'next/link';
import {ArrowLeft, ArrowRight, BarChart3, CheckCircle2, RefreshCw} from 'lucide-react';
import {SYMBOLS} from '@/lib/types';

type Metrics={trades:number;winRate:number;netPnl:number;expectancy:number;profitFactor:number|null;maxDrawdownPct:number;averageHoldMinutes:number};
type Trade={side:string;entryTime:number;exitTime:number;entry:number;exit:number;pnl:number;reason:string;setup?:string};
type Event={kind:string;side:string;time:number;low:number;high:number;description:string};
type Arm={metrics:Metrics;split:{training:Metrics;holdout:Metrics};sample:Trade[]};
type Response={symbol:string;bars:number;from:string;to:string;cutoff:string;assumptions:string[];baseline:Arm;smc:Arm&{events:Event[]};highProbability:Arm};
type View='compare'|'old'|'smc'|'hp';
type Period='holdout'|'overall'|'training';
const fmt=(n:number|null|undefined,d=2)=>n==null||!Number.isFinite(n)?'—':n.toFixed(d);
const money=(n:number)=>`${n<0?'−':''}$${fmt(Math.abs(n))}`;
const percent=(n:number)=>`${fmt(n)}%`;
const date=(n:number)=>new Date(n).toISOString().slice(0,16).replace('T',' ');
const metricKeys:[keyof Metrics,string][]=[['trades','Completed trades'],['winRate','Win rate'],['netPnl','Net P&L'],['expectancy','Net expectancy / trade'],['profitFactor','Profit factor'],['maxDrawdownPct','Max drawdown'],['averageHoldMinutes','Average hold']];
function value(key:keyof Metrics,m:Metrics):string {
 const v=m[key]; if(key==='trades')return String(v);if(key==='netPnl'||key==='expectancy')return money(v as number);if(key==='profitFactor')return fmt(v);if(key==='averageHoldMinutes')return `${fmt(v)} min`;return percent(v as number);
}
function Panel({name,desc,metrics,selected}:{name:string;desc:string;metrics:Metrics;selected:boolean}){
 return <section className={`rounded-xl border p-4 sm:p-5 ${selected?'border-teal-500/60 bg-[#1a3040]':'border-[#30465a] bg-[#182637]'}`}>
  <div className="flex items-start justify-between gap-2"><div><h2 className="font-semibold text-base">{name}</h2><p className="muted text-xs mt-1">{desc}</p></div><BarChart3 className="text-teal-300" size={18}/></div>
  <div className="grid grid-cols-2 gap-2 mt-4">
   {([['Net P&L',money(metrics.netPnl)],['Trades',String(metrics.trades)],['Win rate',percent(metrics.winRate)],['Profit factor',fmt(metrics.profitFactor)],['Expectancy',money(metrics.expectancy)],['Max drawdown',percent(metrics.maxDrawdownPct)]] as const).map(([label,val])=><div key={label} className="bg-[#203247] rounded-lg p-3"><p className="muted text-xs">{label}</p><p className={`mt-1 font-medium text-sm sm:text-base ${label==='Net P&L'||label==='Expectancy'?metrics[label==='Net P&L'?'netPnl':'expectancy']>=0?'text-emerald-300':'text-rose-300':''}`}>{val}</p></div>)}
  </div>
 </section>
}
function Trades({title,trades}:{title:string;trades:Trade[]}){
 return <section className="panel p-4"><h2 className="font-semibold mb-3">{title} — last trades</h2><div className="overflow-x-auto"><table className="w-full min-w-[580px] text-left text-xs"><thead><tr>{['Entry UTC','Direction','Entry','Exit','Reason','Net P&L'].map(t=><th key={t} className="p-2 muted font-medium">{t}</th>)}</tr></thead><tbody>{trades.length?trades.slice().reverse().map((t,i)=><tr key={`${t.entryTime}-${i}`} className="border-t border-[#2a3a4b]"><td className="p-2">{date(t.entryTime)}</td><td className="p-2">{t.side}</td><td className="p-2">{fmt(t.entry,4)}</td><td className="p-2">{fmt(t.exit,4)}</td><td className="p-2">{t.reason}</td><td className={`p-2 ${t.pnl>=0?'text-emerald-300':'text-rose-300'}`}>{money(t.pnl)}</td></tr>):<tr><td colSpan={6} className="p-4 muted">No trades in this sample.</td></tr>}</tbody></table></div></section>
}
export default function SmcComparePage(){
 const [symbol,setSymbol]=useState<string>('SOLUSDT');
 const [bars,setBars]=useState(2500);
 const [view,setView]=useState<View>('compare');
 const [period,setPeriod]=useState<Period>('holdout');
 const [data,setData]=useState<Response|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 async function run(){setBusy(true);setError('');setData(null);try{const r=await fetch(`/api/smc-compare?symbol=${encodeURIComponent(symbol)}&bars=${bars}`,{cache:'no-store'});const j=await r.json();if(!r.ok)throw Error(j.error||'Comparison failed');setData(j as Response);}catch(e){setError(e instanceof Error?e.message:'Request failed');}finally{setBusy(false);}}
 const getMetrics=(arm:Arm):Metrics=>period==='overall'?arm.metrics:arm.split[period];
 const a=data?getMetrics(data.baseline):null,b=data?getMetrics(data.smc):null,c=data?getMetrics(data.highProbability):null;
 const sampleOk=!!a&&!!b&&!!c&&a.trades>=30&&b.trades>=30&&c.trades>=30;
 return <main className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8 space-y-5">
  <div className="flex flex-wrap gap-3 justify-between items-center"><Link href="/" className="text-teal-200 text-xs inline-flex items-center gap-2"><ArrowLeft size={15}/> Trading dashboard</Link><Link href="/strategy-research" className="text-teal-200 text-xs">Strategy research <ArrowRight size={14} className="inline"/></Link></div>
  <header><h1 className="text-xl font-semibold">Old vs SMC vs High-Probability V6.4</h1><p className="muted text-xs mt-1">Separate research engines, one comparison. No live trading or changes to Telegram alerts.</p></header>
  <section className="panel p-4"><div className="flex flex-wrap gap-3 items-end"><label className="text-xs muted">Coin<select className="mt-1 block w-full min-w-32 bg-[#203246] border border-[#395064] rounded-lg px-3 py-2 text-white" value={symbol} onChange={e=>setSymbol(e.target.value)}>{SYMBOLS.map(s=><option key={s} value={s}>{s.replace('USDT',' / USDT')}</option>)}</select></label><label className="text-xs muted">Historical candles<select className="mt-1 block w-full bg-[#203246] border border-[#395064] rounded-lg px-3 py-2 text-white" value={bars} onChange={e=>setBars(Number(e.target.value))}><option value={1500}>1,500 · ~5 days</option><option value={2500}>2,500 · ~9 days</option><option value={5000}>5,000 · ~17 days</option></select></label><button onClick={run} disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#346a69] px-4 py-2.5 text-white text-sm disabled:opacity-50"><RefreshCw size={15} className={busy?'animate-spin':''}/>{busy?'Running comparison…':'Compare strategies'}</button></div></section>
  <nav className="grid grid-cols-2 sm:grid-cols-4 gap-2" aria-label="Strategy view">{([{id:'old',label:'Old Strategy'},{id:'smc',label:'New SMC'},{id:'hp',label:'V6.4 High-Probability'},{id:'compare',label:'Compare All'}] as const).map(t=><button key={t.id} onClick={()=>setView(t.id)} aria-pressed={view===t.id} className={`rounded-lg border px-2 sm:px-4 py-3 text-xs sm:text-sm ${view===t.id?'bg-[#346a69] border-teal-400 text-white':'bg-[#1b2a3b] border-[#30465a] text-[#c8d8df]'}`}>{t.label}</button>)}</nav>
  {error&&<p role="alert" className="border border-rose-700/50 bg-rose-950/20 rounded-lg p-3 text-rose-200 text-sm">{error}</p>}
  {!data&&!busy&&!error&&<section className="panel p-6 text-center"><p className="font-medium">Select a coin and click Compare strategies</p><p className="muted text-xs mt-2">The comparison uses the same 5m candles and execution-cost assumptions for both engines.</p></section>}
  {busy&&<section className="panel p-6 text-center muted text-sm">Loading historical candles and running both backtests…</section>}
  {data&&a&&b&&c&&<>
   <div className="flex flex-wrap items-center justify-between gap-2"><p className="muted text-xs">{data.symbol} · {data.bars} completed 5m bars · {data.from.slice(0,10)} to {data.to.slice(0,10)}</p><div className="flex gap-1 bg-[#172333] rounded-lg p-1">{([{id:'holdout',label:'Holdout 30%'},{id:'overall',label:'Overall'},{id:'training',label:'Training 70%'}] as const).map(t=><button key={t.id} aria-pressed={period===t.id} onClick={()=>setPeriod(t.id)} className={`rounded-md px-2.5 py-2 text-xs ${period===t.id?'bg-[#346a69] text-white':'text-[#a9bccc]'}`}>{t.label}</button>)}</div></div>
   <div className={view==='compare'?'grid gap-3 md:grid-cols-2 xl:grid-cols-3':'grid gap-3'}>{(view==='old'||view==='compare')&&<Panel name="Old Strategy" desc="EMA · RSI · MACD · Volume · multi-timeframe" metrics={a} selected={view==='old'}/ >}{(view==='smc'||view==='compare')&&<Panel name="New SMC" desc="BOS · CHoCH · Order Block · FVG" metrics={b} selected={view==='smc'}/ >}{(view==='hp'||view==='compare')&&<Panel name="V6.4 High-Probability" desc="Experimental: EMA pullback + 1h/BTC trend + momentum + volume" metrics={c} selected={view==='hp'}/>}</div>
   {view==='compare'&&<section className="panel p-4 sm:p-5"><h2 className="font-semibold mb-2">Metric-by-metric comparison</h2><div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-xs sm:text-sm"><thead><tr><th className="p-2 muted">Metric</th><th className="p-2">Old</th><th className="p-2">SMC</th><th className="p-2">V6.4</th></tr></thead><tbody>{metricKeys.map(([key,label])=><tr key={key} className="border-t border-[#2a3a4b]"><td className="p-2 muted">{label}</td><td className="p-2">{value(key,a)}</td><td className="p-2">{value(key,b)}</td><td className="p-2">{value(key,c)}</td></tr>)}</tbody></table></div><p className="muted text-xs mt-3">Holdout is an untouched chronological segment. All strategies need adequate sample size; score scales and pattern counts aren't directly comparable.</p></section>}
   <section className="rounded-lg border border-amber-600/40 bg-amber-500/5 p-3 text-xs text-amber-200 flex gap-2 items-start"><CheckCircle2 size={16} className="shrink-0 mt-0.5"/><p>{sampleOk?'All three strategies have at least 30 trades in this view, but that alone does not establish reliable superiority.':'Insufficient sample for a strong conclusion: at least one strategy has fewer than 30 completed trades in the selected period.'} Short history and strategy differences can distort comparisons. No winner is automatically declared.</p></section>
   <div className={view==='compare'?'grid gap-4 xl:grid-cols-3':'grid gap-4'}>{(view==='old'||view==='compare')&&<Trades title="Old Strategy" trades={data.baseline.sample}/ >}{(view==='smc'||view==='compare')&&<Trades title="New SMC" trades={data.smc.sample}/ >}{(view==='hp'||view==='compare')&&<Trades title="V6.4 High-Probability" trades={data.highProbability.sample}/>}</div>
   {(view==='smc'||view==='compare')&&<section className="panel p-4"><h2 className="font-semibold mb-2">SMC structure and zones</h2><p className="muted text-xs mb-2">Research detections, not confirmed live entries</p><div className="max-h-72 overflow-auto"><table className="w-full text-left text-xs"><thead><tr><th className="p-2">UTC</th><th className="p-2">Pattern</th><th className="p-2">Side</th><th className="p-2">Zone</th></tr></thead><tbody>{data.smc.events.slice().reverse().map((e,i)=><tr key={`${e.time}-${e.kind}-${i}`} className="border-t border-[#2a3a4b]"><td className="p-2">{date(e.time)}</td><td className="p-2">{e.kind}</td><td className="p-2">{e.side}</td><td className="p-2">{fmt(e.low,4)} – {fmt(e.high,4)}</td></tr>)}</tbody></table></div></section>}
   <details className="panel p-4"><summary className="cursor-pointer text-sm font-semibold">Methodology and assumptions</summary><ul className="list-disc ml-5 mt-3 space-y-1 text-xs muted">{data.assumptions.map(x=><li key={x}>{x}</li>)}</ul></details>
  </>}
 </main>;
}
