"use client";
import Link from 'next/link';
import {useEffect,useState} from 'react';
import type {SentimentReport,SentimentInterval} from '@/lib/sentiment';
export default function SentimentPage(){
 const [interval,setInterval]=useState<SentimentInterval>('1h');
 const [report,setReport]=useState<SentimentReport|null>(null);
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(false);
 const [refresh,setRefresh]=useState(0);
 useEffect(()=>{const ctrl=new AbortController();setLoading(true);setError('');
 fetch(`/api/sentiment?interval=${interval}`,{cache:'no-store',signal:ctrl.signal}).then(async r=>{const j=await r.json();if(!r.ok)throw Error(j.error||'Request failed');if(!ctrl.signal.aborted)setReport(j);}).catch(e=>{if(!ctrl.signal.aborted)setError(e instanceof Error?e.message:String(e));}).finally(()=>{if(!ctrl.signal.aborted)setLoading(false);});return()=>ctrl.abort();},[interval,refresh]);
 return <main className="mx-auto max-w-6xl px-4 py-7 sm:px-6 text-sm">
  <div className="flex justify-between gap-3 flex-wrap mb-6"><Link href="/" className="text-teal-300 hover:underline">← Trading dashboard</Link><Link href="/smc-compare" className="text-teal-300 hover:underline">Strategy comparison →</Link></div>
  <h1 className="text-xl font-semibold">Fear & Greed · Overbought / Oversold</h1>
  <p className="muted mt-1 mb-5 text-xs">Independent market sentiment research. Not connected to Old, SMC or V6.4 trade decisions.</p>
  <div className="panel p-4 mb-4 flex flex-wrap items-center gap-3"><label className="muted text-xs">RSI timeframe <select value={interval} onChange={e=>setInterval(e.target.value as SentimentInterval)} className="ml-2 rounded-lg bg-[#1c2b3c] border border-[#354759] px-3 py-2 text-white"><option value="1h">1 hour</option><option value="4h">4 hours</option><option value="1d">1 day</option></select></label><button onClick={()=>setRefresh(v=>v+1)} className="rounded-lg bg-[#346a69] px-4 py-2">Refresh</button>{loading&&<span className="muted text-xs">Loading...</span>}</div>
  {error&&<p role="alert" className="text-rose-300 mb-3">{error}</p>}
  <section className="panel p-5 mb-4"><h2 className="font-semibold mb-2">Crypto Fear & Greed Index</h2>{report?.fearGreed?<><p className="text-3xl font-semibold">{report.fearGreed.value}<span className="text-sm muted"> / 100</span></p><p className="mt-1">{report.fearGreed.label}</p><p className="muted text-xs mt-2">Published: {new Date(report.fearGreed.timestamp).toLocaleString()} · Broad crypto sentiment, NOT one coin's RSI</p></>:<p className="text-amber-200 text-sm">{report?.fearGreedError??'Waiting for index...'}</p>}<p className="muted text-xs mt-2">Source: <a href="https://alternative.me/crypto/fear-and-greed-index/" target="_blank" rel="noopener noreferrer" className="text-teal-300 underline">Alternative.me</a></p></section>
  <section className="panel p-5"><h2 className="font-semibold mb-1">Coin RSI(14) · {interval}</h2><p className="muted text-xs mb-4">RSI ≥ 70: overbought; RSI ≤ 30: oversold; otherwise neutral. Based on last completed Binance futures candle.</p><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{report?.coins.map(c=><div key={c.symbol} className="rounded-xl bg-[#1c2b3c] p-4"><div className="flex justify-between gap-2"><b className="font-medium">{c.symbol.replace('USDT','')}</b><span className={c.state==='OVERBOUGHT'?'text-rose-300':c.state==='OVERSOLD'?'text-teal-300':'text-slate-300'}>{c.state}</span></div><p className="mt-3 text-2xl font-semibold">{c.rsi.toFixed(1)} <span className="muted text-xs">RSI</span></p><p className="muted mt-2 text-xs">Last close: ${c.close.toLocaleString()}</p><p className="muted text-xs">Candle close: {new Date(c.candleClosedAt).toLocaleString()}</p></div>)}{!loading&&!report?.coins.length&&<p className="muted">No coin data returned.</p>}</div>{report?.errors?.length? <div className="mt-4 text-amber-200 text-xs">{report.errors.map(e=><p key={e.symbol}>{e.symbol}: {e.message}</p>)}</div>:null}</section>
  <p className="muted text-xs mt-4">Overbought is NOT an automatic SHORT. Oversold is NOT an automatic LONG. RSI can remain extreme in strong trends. This is separate from trade alerts.</p>
 </main>;
}
