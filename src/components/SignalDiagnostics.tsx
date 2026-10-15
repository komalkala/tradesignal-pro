"use client";

import {useState} from "react";
import {Activity, AlertTriangle, CheckCircle2, ChevronDown, Clock3, XCircle} from "lucide-react";
import type {Candle, Interval} from "@/lib/types";
import type {Profile, Quality} from "@/lib/pro";

type DiagnosticsData = {
  candles: Candle[];
  signal: Quality;
  higher: Profile;
  btc: Profile;
  higherInterval: Interval | "1w";
  updatedAt: string;
};

type Props = {
  data: DiagnosticsData | null;
  loading: boolean;
  error: string;
  stale: boolean;
  candleCloseTime: number | null;
  interval: Interval;
  riskBlocked: boolean;
};

const INTERVAL_MS: Record<Interval, number> = {
  "5m": 300000, "15m": 900000, "1h": 3600000,
  "4h": 14400000, "1d": 86400000,
};
const pretty = (t: number) => new Date(t).toLocaleString("en-GB", {timeZone:"UTC", dateStyle:"medium",timeStyle:"short"}) + " UTC";

export default function SignalDiagnostics({data,loading,error,stale,candleCloseTime,interval,riskBlocked}:Props){
  const [expanded,setExpanded]=useState(true);
  const signal=data?.signal;
  const checked=signal?.checks??[];
  const failed=checked.filter(x=>!x.passed);
  const now=Date.now();
  const fetchedAt=data?.updatedAt?Date.parse(data.updatedAt):NaN;
  const apiRecent=Number.isFinite(fetchedAt) && fetchedAt<=now+60000 && now-fetchedAt<=180000;
  const candleRecent=!!candleCloseTime && !stale && candleCloseTime<=now+60000;
  const dataHealthy=!!data && apiRecent && candleRecent && data.candles.length>=210;
  const indicatorsHealthy=!!signal && checked.some(x=>x.id==="momentum") && Number.isFinite(signal.score);
  const status=error?"API ERROR":loading?"LOADING":!dataHealthy?"DATA NEEDS ATTENTION":!indicatorsHealthy?"INDICATORS UNAVAILABLE":signal?.decision==="WAIT"?"NO CONFIRMED SETUP":riskBlocked?"RISK BLOCK":"QUALIFIED RESEARCH SETUP";
  const nextClose=candleCloseTime===null?null:candleCloseTime+INTERVAL_MS[interval];
  return <section className="panel mt-4 p-4 sm:p-5" aria-label="Signal engine diagnostics">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2"><Activity size={17} className="text-teal-300"/><div><h2 className="text-sm font-semibold">Signal engine health</h2><p className="muted text-xs">Completed-candle strategy · evaluates LONG and SHORT independently</p></div></div>
      <span className={`rounded-md border px-3 py-1 text-xs ${dataHealthy&&indicatorsHealthy&&!riskBlocked&&!error?'border-teal-600/60 text-teal-200':'border-amber-600/60 text-amber-200'}`}>{status}</span>
    </div>
    <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {[
        {name:"Market feed",good:dataHealthy,detail:error||(!data?"Awaiting market response":!apiRecent?"API response older than 3 min or clock mismatch":!candleRecent?"Last closed candle is stale":"Fresh REST response and closed candle")},
        {name:"Indicators",good:indicatorsHealthy,detail:indicatorsHealthy?"Calculated from closed candles":"Awaiting complete indicator history"},
        {name:"Strategy",good:!!signal&&signal.decision!=="WAIT",detail:signal?`${signal.decision} · ${signal.score}/100`:'Not evaluated yet'},
        {name:"Manual risk limits",good:!riskBlocked,detail:riskBlocked?"Current input blocks trade sizing":"Manual guards permit evaluation"},
      ].map(x=><div key={x.name} className="rounded-lg bg-[#1c2b3c] p-3"><div className="flex items-center gap-2">{x.good?<CheckCircle2 size={15} className="text-teal-300"/>:<AlertTriangle size={15} className="text-amber-300"/>}<span className="text-xs font-semibold">{x.name}</span></div><p className="muted mt-2 text-xs">{x.detail}</p></div>)}
    </div>
    <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs text-[#aebfcb]"><span><Clock3 size={13} className="mr-1 inline"/>Last completed candle: {candleCloseTime?pretty(candleCloseTime):"—"}</span><span>Next expected close: {nextClose?pretty(nextClose):"—"}</span><span>Last API fetch: {Number.isFinite(fetchedAt)?pretty(fetchedAt):"—"}</span></div>
    <div className="mt-3 rounded-md border border-[#345060] bg-[#142332] p-3">
      <div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold">Why {signal?.decision??"signal"}? {signal ? `(LONG ${signal.longScore}/100 · SHORT ${signal.shortScore}/100)` : ""}</p><button type="button" className="flex items-center gap-1 text-xs text-teal-200" aria-expanded={expanded} onClick={()=>setExpanded(x=>!x)}>{expanded?'Hide':'Show'} checks <ChevronDown size={14} className={expanded?'rotate-180':''}/></button></div>
      {expanded&&<div className="mt-3 space-y-2">{checked.length?checked.map(check=><div className="flex items-start gap-2" key={check.id}>{check.passed?<CheckCircle2 size={15} className="mt-0.5 shrink-0 text-teal-300"/>:<XCircle size={15} className="mt-0.5 shrink-0 text-amber-300"/>}<div><p className="text-xs font-medium">{check.label}: {check.passed?'PASS':'FAIL'}</p><p className="muted text-xs">{check.detail}</p></div></div>):<p className="muted text-xs">Waiting for indicator checks.</p>}</div>}
      {failed.length>0&&<p className="mt-3 text-xs text-amber-200">Missing confirmations ({failed.length}): {failed.map(x=>x.label).join(', ')}. The next closed candle must satisfy all mandatory checks; a score alone is insufficient.</p>}
      {signal?.decision==="WAIT"&&signal?.vetoes.length>0&&<p className="muted mt-2 text-xs">Mandatory vetoes: {signal.vetoes.join(' · ')}</p>}
    </div>
    <p className="muted mt-3 text-xs">Telegram worker status is independent of this page. Check <code>npm run alerts:monitor</code> / PM2 logs to verify alert delivery. An active dashboard does not prove that the worker is running.</p>
  </section>;
}
