'use client';
import {useEffect,useState} from 'react';
import type {PaperTrade} from '@/lib/v71-journal';
type Result={trades:PaperTrade[];metrics:{total:number;open:number;closed:number;winRate:number|null;expectancyR:number|null;profitFactor:number|null;netR:number};notice?:string;error?:string;updatedAt:number|null};
const fmt=(n:number|null,d=2)=>n===null?'N/A':n.toFixed(d);
const ist=(t:number|null)=>t?new Date(t).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'short'}):'—';
export default function Journal(){const [data,setData]=useState<Result|null>(null);const [error,setError]=useState('');
 useEffect(()=>{let alive=true;async function load(){try{const r=await fetch('/api/v71-journal',{cache:'no-store'});const j=await r.json();if(!r.ok)throw Error(j.error||'API failed');if(alive){setData(j);setError('')}}catch(e){if(alive)setError(e instanceof Error?e.message:'Unknown error')}}load();const id=setInterval(load,60000);return()=>{alive=false;clearInterval(id)}},[]);
 const m=data?.metrics;
 return <main className="mx-auto max-w-6xl px-4 py-6 text-slate-100 sm:px-6" style={{fontFamily:'Poppins, sans-serif'}}>
  <div className="mb-5"><h1 className="text-[22px] font-semibold">Paper Trade Journal <span className="text-teal-300">V7.1</span></h1><p className="text-[12px] text-slate-400">Automatic tracking of NEW confirmed 1H setups. Research only · No Binance orders.</p></div>
  {error&&<p role="alert" className="my-3 text-rose-300">{error}</p>}{data?.notice&&<p className="my-3 text-amber-300">{data.notice}</p>}
  <div className="grid grid-cols-2 gap-3 md:grid-cols-5">{[['Signals',m?.total??0],['Closed',m?.closed??0],['Win rate',m?.winRate==null?'N/A':fmt(m.winRate)+'%'],['Expectancy',fmt(m?.expectancyR??null)+'R'],['Profit factor',fmt(m?.profitFactor??null)]].map(([label,value])=><div key={label} className="rounded-lg border border-[#324659] bg-[#172333] p-4"><div className="text-[12px] text-slate-400">{label}</div><div className="mt-2 text-[19px] font-semibold">{value}</div></div>)}</div>
  <section className="mt-5 overflow-x-auto rounded-lg border border-[#324659] bg-[#172333] p-4"><h2 className="mb-3 text-[15px] font-semibold">Recorded paper signals</h2><table className="w-full min-w-[720px] text-left text-[12px]"><thead className="text-slate-400"><tr>{['Coin','Direction','Signal close (IST)','Status','Entry (sim.)','Exit (sim.)','Net R'].map(x=><th className="py-2 pr-3" key={x}>{x}</th>)}</tr></thead><tbody>{data?.trades.map(t=><tr key={t.id} className="border-t border-[#2a4050]"><td className="py-3 pr-3">{t.symbol}</td><td>{t.side}</td><td>{ist(t.signalTime)}</td><td className={t.status==='TARGET'?'text-teal-300':t.status==='STOP'?'text-rose-300':'text-amber-300'}>{t.status.replaceAll('_',' ')}</td><td>{t.entry?.toFixed(4)??'Pending'}</td><td>{t.exit?.toFixed(4)??'—'}</td><td>{t.netR===null?'—':fmt(t.netR)+'R'}</td></tr>)}</tbody></table>{!data?.trades.length&&<p className="py-4 text-slate-400">No paper signals recorded yet. This does not mean a 0% win rate.</p>}</section>
  <p className="mt-4 text-[12px] text-slate-400">Stop-first assumption when both target and stop touch the same 1H candle. Fees/slippage estimated; historical funding and liquidation not modeled. The worker and website must share persistent storage. This is NOT a brokerage execution history.</p>
 </main>
}
