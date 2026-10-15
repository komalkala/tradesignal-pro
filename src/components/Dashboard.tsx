'use client';
import {useEffect,useMemo,useState} from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {Activity,RefreshCw,AlertTriangle,ChevronDown,ShieldCheck,CheckCircle2,XCircle,Clock3} from 'lucide-react';
import {SYMBOLS, type Candle, type Interval, type SymbolId} from '@/lib/types';
import type {Profile,Quality,Snapshot} from '@/lib/pro';
import SignalDiagnostics from './SignalDiagnostics';
import type {ProBacktestResult} from '@/lib/pro-backtest';
import type {runQuickBacktest} from '@/lib/quick-backtest';
import type {analyzeOutOfSample} from '@/lib/research';
const PriceChart=dynamic(()=>import('./PriceChart'),{ssr:false});
type ProData={candles:Candle[];signal:Quality;higher:Profile;btc:Profile;higherInterval:Interval | "1w";snapshot:Snapshot;updatedAt:string};
const fmt=(v:number|null|undefined,d=2)=>v==null||!Number.isFinite(v)?'—':v.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
const money=(v:number|null|undefined)=>v==null?'—':`$${fmt(v)}`;
const symbols:SymbolId[]=[...SYMBOLS];
const timeframes:Interval[]=['15m','1h','4h','1d'];
export default function Dashboard(){
 const [symbol,setSymbol]=useState<SymbolId>('SOLUSDT');
 const [interval,setInterval]=useState<Interval>('4h');
 const [style,setStyle]=useState<'swing'|'intraday'>('swing');
 const [data,setData]=useState<ProData|null>(null);
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(true);
 const [refresh,setRefresh]=useState(0);
 const [balance,setBalance]=useState(750);
 const [risk,setRisk]=useState(.5);
 const [dailyLoss,setDailyLoss]=useState(0);
 const [otherRisk,setOtherRisk]=useState(0);
 const [showDetails,setShowDetails]=useState(false);
 const [backtest,setBacktest]=useState<ProBacktestResult|null>(null);
 const [validation,setValidation]=useState<ReturnType<typeof analyzeOutOfSample>|null>(null);
 const [historyRange,setHistoryRange]=useState('');
 const [testing,setTesting]=useState(false);
 const [quickMinutes,setQuickMinutes]=useState(60);
 const [quickLoading,setQuickLoading]=useState(false);
 const [quickError,setQuickError]=useState('');
 const [quick,setQuick]=useState<Awaited<ReturnType<typeof runQuickBacktest>>|null>(null);
 const [quickHoldout,setQuickHoldout]=useState<ReturnType<typeof analyzeOutOfSample>|null>(null);
 async function runQuick(){setQuickLoading(true);setQuickError('');setQuick(null);try{const r=await fetch(`/api/quick-backtest?symbol=${symbol}&maxMinutes=${quickMinutes}&bars=5000`);const j=await r.json();if(!r.ok)throw Error(j.error||'Quick backtest failed');setQuick(j.result);setQuickHoldout(j.validation);}catch(e){setQuickError(e instanceof Error?e.message:'Backtest failed')}finally{setQuickLoading(false)}}
 useEffect(()=>{const ctrl=new AbortController();(async()=>{setLoading(true);setError('');setData(null);setBacktest(null);setValidation(null);setHistoryRange('');try{const r=await fetch(`/api/pro?symbol=${symbol}&interval=${interval}`,{signal:ctrl.signal});const j=await r.json();if(!r.ok)throw Error(j.error??'Could not load market data');if(!ctrl.signal.aborted)setData(j)}catch(e){if(!ctrl.signal.aborted)setError(e instanceof Error?e.message:'Market API error')}finally{if(!ctrl.signal.aborted)setLoading(false)}})();return()=>ctrl.abort()},[symbol,interval,refresh]);
useEffect(() => {
  const timer = window.setInterval(() => {
    setRefresh((v) => v + 1);
  }, 60000);

  return () => window.clearInterval(timer);
}, []);
 const q=data?.signal;
 const setupReady=!!q&&q.decision!=='WAIT';
 const limitsOkay=balance>0&&risk>0&&risk<=.5&&dailyLoss<2&&otherRisk<1.5;
 const tradeReady=setupReady&&limitsOkay;
 const lastCandleTime=data?.candles.at(-1)?.time;
const durationMs: Record<Interval, number> = {
  "5m": 300000,
  "15m": 900000,
  "1h": 3600000,
  "4h": 14400000,
  "1d": 86400000,
};
 const candleCloseTime=lastCandleTime==null?null:lastCandleTime+durationMs[interval];
 const [now,setNow]=useState(0);
useEffect(() => {
  setNow(Date.now());

  const timer = window.setInterval(() => {
    setNow(Date.now());
  }, 15000);

  return () => window.clearInterval(timer);
}, []);
 const stale=candleCloseTime!=null&&now-candleCloseTime>durationMs[interval]+90000;
 const feeRate=.0005,slippageRate=.0002; // align with replay defaults
 const sizing=useMemo(()=>{if(!tradeReady||stale||!q?.entry||!q.stop)return null;const perUnitRisk=Math.abs(q.entry-q.stop)+q.entry*(2*feeRate+2*slippageRate);if(perUnitRisk<=0)return null;const budget=balance*risk/100;const quantity=budget/perUnitRisk;return {budget,quantity,notional:quantity*q.entry};},[q,tradeReady,stale,balance,risk]);
 async function runBacktest(){setTesting(true);setError('');try{const r=await fetch(`/api/pro-backtest?symbol=${symbol}&interval=${interval}`);const j=await r.json();if(!r.ok)throw Error(j.error||'Backtest unavailable');setBacktest(j.result);setValidation(j.validation);setHistoryRange(`${j.historyBars} candles · ${new Date(j.historyFrom).toLocaleDateString()} – ${new Date(j.historyTo).toLocaleDateString()}`)}catch(e){setError(e instanceof Error?e.message:'Backtest error')}finally{setTesting(false)}}
 function chooseStyle(v:'swing'|'intraday'){setStyle(v);setInterval(v==='swing'?'4h':'1h');}
 const stateLabel=!data?'Loading':stale?'STALE DATA':!setupReady?'WAIT':!limitsOkay?'RISK BLOCK':q?.decision==='LONG'?'BUY / LONG':'SELL / SHORT';
 return <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6 md:py-8">
  <nav aria-label="Strategy navigation" className="mb-4 grid grid-cols-3 gap-2 rounded-xl border border-[#30465a] bg-[#172333] p-2 text-center text-xs sm:text-sm"><Link href="/" aria-current="page" className="rounded-lg bg-[#346a69] px-2 py-3 font-medium text-white">Old Strategy</Link><Link href="/smc-compare" className="rounded-lg bg-[#22364b] px-2 py-3 text-[#d4e6e8] hover:bg-[#315568]">New SMC</Link><Link href="/smc-compare" className="rounded-lg border border-teal-500/60 bg-[#1a383f] px-2 py-3 font-medium text-teal-100 hover:bg-[#265258]">Compare Both →</Link></nav>
  <div className="mb-3 flex justify-end"><Link href="/historical-data" className="rounded-lg border border-[#3c5d65] px-3 py-2 text-[#a6d8d4] hover:bg-[#1c2b3c]">Daily historical data →</Link> <Link href="/market-intelligence" className="text-[#9ecbc8] underline ml-3">Market intelligence</Link></div><header className="mb-6 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="rounded-xl bg-teal-300/10 p-3 text-teal-200"><Activity size={21}/></span><div><h1 className="text-lg font-semibold">TradeSignal <span className="text-teal-300">Pro</span></h1><p className="muted text-xs">Clear signals · Simple risk · No live orders</p></div></div><span className="rounded-full border border-[#365354] px-3 py-1 text-xs text-teal-200">Research only</span></header>
  <div className="mb-3 flex flex-wrap gap-2"><button onClick={()=>chooseStyle('swing')} className={`rounded-lg px-4 py-2 text-sm ${style==='swing'?'bg-[#346a69] text-white':'bg-[#1c2b3c] text-[#c5d4dd]'}`}>Swing trade</button><button onClick={()=>chooseStyle('intraday')} className={`rounded-lg px-4 py-2 text-sm ${style==='intraday'?'bg-[#346a69] text-white':'bg-[#1c2b3c] text-[#c5d4dd]'}`}>Intraday</button></div><p className="muted mb-4 text-xs">{style==='swing'?'Swing: 4h entries with 1d trend confirmation; 1d available with 1w confirmation. Trades may span days.':'Intraday: 15m or 1h entries. Holding periods are not guaranteed.'}</p><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2">{symbols.map(s=><button key={s} onClick={()=>setSymbol(s)} className={`rounded-lg px-4 py-2.5 text-sm ${s===symbol?'bg-[#346a69] text-white':'bg-[#1c2b3c] text-[#c5d4dd]'}`}>{s.replace('USDT','')}</button>)}</div><div className="flex items-center gap-2">{timeframes.map(t=><button key={t} onClick={()=>{setInterval(t);setStyle(t==='4h'||t==='1d'?'swing':'intraday')}} className={`rounded-lg px-3 py-2 text-sm ${t===interval?'bg-[#346a69] text-white':'bg-[#1c2b3c] text-[#c5d4dd]'}`}>{t}</button>)}<button aria-label="Refresh market" onClick={()=>setRefresh(v=>v+1)} className="rounded-lg bg-[#1c2b3c] p-2.5"><RefreshCw size={16}/></button></div></div>
  {error&&<div role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-200"><AlertTriangle size={17}/><span>{error}</span></div>}
  <div className="grid gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(320px,1fr)]">
   <section className="panel p-4 sm:p-5"><div className="mb-3 flex items-start justify-between gap-2"><div><h2 className="text-sm font-semibold">{symbol.replace('USDT','')} / USDT</h2><p className="muted text-xs">{interval} · completed candles</p></div><div className="text-right"><p className="text-lg font-semibold number">{money(data?.candles.at(-1)?.close)}</p><p className="muted text-xs">Last close</p><p className={`mt-1 text-xs ${stale?'text-amber-200':'text-[#a8becb]'}`}><Clock3 size={12} className="mr-1 inline"/>{candleCloseTime?`Candle closed ${new Date(candleCloseTime).toLocaleString()} · ${stale?'Stale':'Recent'}`:'Awaiting candle time'}</p></div></div>{data?<PriceChart candles={data.candles.slice(-200)}/>:<div className="flex h-72 items-center justify-center muted">{loading?'Loading chart…':'Price chart unavailable'}</div>}</section>
   <section className="panel p-5"><div className="flex items-center justify-between gap-2"><div><p className="muted text-xs">Current signal</p><h2 className="mt-1 text-xl font-semibold">{stateLabel}</h2></div><span className={`rounded-lg px-3 py-1.5 text-xs ${tradeReady&&q?.decision==='LONG'?'bg-emerald-300/10 text-emerald-200':tradeReady&&q?.decision==='SHORT'?'bg-rose-300/10 text-rose-200':'bg-amber-300/10 text-amber-200'}`}>{q?`${q.score}/100`:'—'}</span></div>
    <p className="muted mt-2 text-xs">Quality score is not win probability. WAIT means no trade is confirmed; check both LONG and SHORT evidence below.</p>
    <div className="mt-4 grid grid-cols-3 gap-2">{[['Entry',tradeReady&&!stale?q?.entry:null],['Stop loss',tradeReady&&!stale?q?.stop:null],['Target',tradeReady&&!stale?q?.target:null]].map(([label,value])=><div className="rounded-lg bg-[#1c2b3c] p-3" key={String(label)}><p className="muted text-xs">{label}</p><p className="mt-1 text-sm font-semibold number">{money(value as number|null)}</p></div>)}</div>
    <div className="mt-4 border-t border-[#2a3a4b] pt-4"><div className="mb-2 flex items-center justify-between gap-2"><p className="text-sm font-semibold">Setup checklist</p><span className="muted text-xs">{q?.candidateSide==='SHORT'?'SHORT':'LONG'} candidate</span></div>
    {q?.checks?.length?<ul className="space-y-2">{q.checks.map(c=><li key={c.id} className="flex items-start gap-2 text-xs"><span className="mt-0.5">{c.passed?<CheckCircle2 size={15} className="text-teal-300"/>:<XCircle size={15} className="text-amber-300"/>}</span><span><span className="font-medium text-[#e5edf2]">{c.label}</span><span className="muted block">{c.detail}</span></span></li>)}</ul>:<p className="muted text-xs">Awaiting indicator checks.</p>}
    {q?.decision==='WAIT'&&<div className="mt-3 rounded-lg bg-[#1c2b3c] p-3"><p className="text-xs font-semibold">What would make this a {q.candidateSide==='SHORT'?'SHORT':'LONG'}?</p><p className="muted mt-1 text-xs">All checks above must pass on a completed candle, including volume ≥ 1.05× average, confirmed RSI/MACD momentum, matching trend and structure, plus score ≥ 75. This is a rule-based requirement, not a forecast.</p></div>}
    {q?.decision==='WAIT'&&q.candidateSide!=='SHORT'&&q.shortChecks?.length>0&&<details className="mt-3 rounded-lg bg-[#1c2b3c] p-3"><summary className="cursor-pointer text-xs font-semibold">What would make this a SHORT?</summary><ul className="mt-2 space-y-2">{q.shortChecks.map(c=><li key={c.id} className="flex gap-2 text-xs">{c.passed?<CheckCircle2 size={14} className="shrink-0 text-teal-300"/>:<XCircle size={14} className="shrink-0 text-amber-300"/>}<span><span className="font-medium">{c.label}</span><span className="muted block">{c.detail}</span></span></li>)}</ul></details>}
    {!limitsOkay&&<p className="mt-2 text-xs text-amber-200">Risk guardrail blocked: check account balance, daily loss, open risk and risk percentage.</p>}
    {stale&&<p className="mt-2 text-xs text-amber-200">Data is stale. Refresh market data before considering a setup.</p>}</div>
    <div className="mt-4 rounded-lg bg-[#1c2b3c] p-3 text-xs text-[#d4dfe6]"><span className="font-semibold">Decision:</span> {tradeReady&&!stale?'Research setup available. Confirm execution conditions before considering any trade.':'Do not enter a trade based on this signal.'}</div>
   </section>
  </div>
  <SignalDiagnostics data={data} loading={loading} error={error} stale={stale} candleCloseTime={candleCloseTime} interval={interval} riskBlocked={!limitsOkay} />
  <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
   <section className="panel p-5"><div className="mb-4 flex items-center gap-2"><ShieldCheck size={17} className="text-teal-300"/><h2 className="font-semibold">My trade risk</h2></div><div className="grid grid-cols-2 gap-3"><label className="text-xs muted">Account balance (USDT)<input className="mt-1 w-full rounded-lg border border-[#354759] bg-[#1c2b3c] p-2.5 text-sm text-white" type="number" min={1} value={balance} onChange={e=>setBalance(Math.max(0,Number(e.target.value)||0))}/></label><label className="text-xs muted">Risk per trade (%)<select className="mt-1 w-full rounded-lg border border-[#354759] bg-[#1c2b3c] p-2.5 text-sm text-white" value={risk} onChange={e=>setRisk(Number(e.target.value))}><option value={.25}>0.25%</option><option value={.5}>0.5%</option></select></label></div><div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-lg bg-[#1c2b3c] p-3"><p className="muted text-xs">Planned risk budget</p><p className="mt-1 text-lg font-semibold number">{money(balance*risk/100)}</p></div><div className="rounded-lg bg-[#1c2b3c] p-3"><p className="muted text-xs">Suggested position size</p><p className="mt-1 text-lg font-semibold number">{sizing?money(sizing.notional):'—'}</p></div></div><div className="muted mt-3 space-y-1 text-xs"><p>Assumptions: taker fee 0.05% per side; slippage 0.02% per side (0.14% round trip combined).</p><p>Backtest defaults use the same rates; funding defaults to 0% and is not reconstructed.</p></div><p className="muted mt-3 text-xs">Estimated sizing includes a simplified cost buffer. Gaps, slippage and liquidation can increase losses.</p></section>
   <section className="panel p-5"><h2 className="font-semibold">Market direction</h2><p className="muted mb-4 text-xs">Quick context before a trade</p><div className="space-y-3">{[['Higher timeframe',`${data?.higher.trend??'—'} · ${data?.higherInterval??'—'}`],['BTC market trend',data?.btc.trend??'—'],['Market structure',q?.marketStructure??'—']].map(([name,val])=><div key={name} className="flex justify-between gap-4 border-b border-[#2a3a4b] pb-2 text-xs"><span className="muted">{name}</span><span className="text-right font-medium">{val}</span></div>)}</div><p className="mt-4 text-xs muted">Signals are based on closed candles and can change after a new candle completes.</p></section>
  </div>
  <section className="panel mt-4 p-5"><button aria-expanded={showDetails} className="flex w-full items-center justify-between gap-3 text-left" onClick={()=>setShowDetails(v=>!v)}><span><span className="block font-semibold">Advanced tools</span><span className="muted block text-xs">Optional: risk limits and V2 strategy backtest</span></span><ChevronDown size={18} className={`muted transition-transform ${showDetails?'rotate-180':''}`}/></button>{showDetails&&<div className="mt-5 grid gap-5 border-t border-[#2a3a4b] pt-5 md:grid-cols-2"><div><h3 className="mb-3 text-sm font-semibold">Additional risk limits</h3><div className="grid grid-cols-2 gap-3">{[['Daily loss %',dailyLoss,setDailyLoss],['Other open risk %',otherRisk,setOtherRisk]].map(([label,value,change])=><label key={label as string} className="muted text-xs">{label as string}<input type="number" min="0" max="100" step="0.1" className="mt-1 w-full rounded-lg border border-[#354759] bg-[#1c2b3c] p-2.5 text-sm text-white" value={value as number} onChange={e=>(change as (v:number)=>void)(Math.max(0,Number(e.target.value)||0))}/></label>)}</div><p className="muted mt-3 text-xs">Blocks signals when daily loss reaches 2% or other open risk reaches 1.5%. These are manual inputs and do not control a Binance account.</p></div><div><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-semibold">V4 strategy validation</h3><p className="muted text-xs">Up to 5,000 historical candles; separate 70% training and 30% untouched chronological holdout.</p></div><button disabled={testing} onClick={runBacktest} className="rounded-lg bg-[#346a69] px-3 py-2 text-xs disabled:opacity-40">{testing?'Running…':'Run test'}</button></div>{backtest?<div className="mt-3 grid grid-cols-2 gap-2">{[['Net return',`${fmt(backtest.netReturn)}%`],['Win rate',`${fmt(backtest.winRate)}%`],['Max drawdown',`${fmt(backtest.maxDrawdown)}%`],['Closed trades',String(backtest.trades.length)],['Profit factor',backtest.profitFactor==null?'N/A':fmt(backtest.profitFactor)],['Ending equity',money(backtest.endingBalance)]].map(([label,value])=><div key={label} className="rounded-lg bg-[#1c2b3c] p-3"><p className="muted text-xs">{label}</p><p className="mt-1 font-semibold">{value}</p></div>)}</div>:<p className="muted mt-4 text-xs">Replay uses the current V3 strategy. Fees and slippage are simulated; historical funding remains unavailable. Holdout statistics are descriptive, not a guarantee.</p>}</div>{validation&&<div className="mt-4 rounded-lg border border-[#345060] bg-[#142332] p-3 text-xs"><h4 className="font-semibold">Out-of-sample validation (last 30% of history)</h4><p className="muted mt-1">{historyRange}</p><div className="mt-3 grid grid-cols-2 gap-2"><div><p className="muted">Training trades / net return</p><p>{validation.training.trades} / {fmt(validation.training.netReturnPct)}%</p></div><div><p className="muted">Holdout trades / net return</p><p>{validation.holdout.trades} / {fmt(validation.holdout.netReturnPct)}%</p></div><div><p className="muted">Holdout profit factor</p><p>{validation.holdout.profitFactor==null?'N/A':fmt(validation.holdout.profitFactor)}</p></div><div><p className="muted">Holdout drawdown</p><p>{fmt(validation.holdout.maxDrawdownPct)}%</p></div></div><p className="mt-3 text-amber-200">{validation.insufficientEvidence?'Insufficient evidence — '+validation.reasons.join('; '):'Research sample checks passed; profitability still unproven.'}</p></div>}</div>}</section>
  <section className="panel mt-4 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Quick Trade Backtesting · 5m</h2><p className="muted mt-1 text-xs">Entry 5m · confirmation 15m + 1h · no daily trade cap · maximum holding time enforced · research only</p></div><div className="flex items-center gap-2"><select aria-label="Maximum trade duration" value={quickMinutes} onChange={e=>setQuickMinutes(Number(e.target.value))} className="rounded-lg bg-[#1c2b3c] p-2 text-xs">{[15,30,45,60].map(x=><option key={x} value={x}>{x} min max</option>)}</select><button disabled={quickLoading} onClick={runQuick} className="rounded-lg bg-[#346a69] px-4 py-2 text-xs disabled:opacity-50">{quickLoading?'Backtesting…':'Run 5m test'}</button></div></div>
  {quickError&&<p className="mt-3 text-xs text-rose-300">{quickError}</p>}
  {quick&&<div className="mt-4"><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[['Net return',`${fmt(quick.netReturn)}%`],['Win rate',`${fmt(quick.winRate)}%`],['Profit factor',quick.profitFactor==null?'N/A':fmt(quick.profitFactor)],['Max drawdown',`${fmt(quick.maxDrawdown)}%`],['Trades',String(quick.trades.length)],['Average duration',`${fmt(quick.averageMinutes,0)} min`],['Time exits',String(quick.timeExits)],['Net expectancy',money(quick.expectancy)]].map(([k,v])=><div key={k} className="rounded-lg bg-[#1c2b3c] p-3"><p className="muted text-xs">{k}</p><p className="mt-1 font-medium">{v}</p></div>)}</div><p className="mt-3 text-xs text-amber-200">{quickHoldout?.insufficientEvidence?'Insufficient evidence: '+quickHoldout.reasons.join('; '):'Holdout sample checks passed; results remain unproven.'}</p><p className="muted mt-2 text-xs">Fees: 0.05%/side · slippage: 0.02%/side · funding: 0% assumed. Simulated next-bar entry, stop-first OHLC ambiguity, forced time exit.</p><div className="mt-3 max-h-64 overflow-auto"><table className="w-full text-left text-xs"><thead><tr>{['Direction','Entry time','Exit time','Duration','Exit reason','Net P&L'].map(x=><th className="p-2" key={x}>{x}</th>)}</tr></thead><tbody>{quick.trades.slice(-30).reverse().map((t,i)=><tr key={i} className="border-t border-[#2a3a4b]"><td className="p-2">{t.side}</td><td className="p-2">{new Date(t.entryTime).toLocaleString()}</td><td className="p-2">{new Date(t.exitTime).toLocaleString()}</td><td className="p-2">{(t.exitTime-t.entryTime)/60000} min</td><td className="p-2">{t.reason}</td><td className="p-2">{money(t.pnl)}</td></tr>)}</tbody></table></div></div>}
  </section>
  <footer className="muted mt-5 text-xs">Read-only signal research, not financial advice. No guaranteed profit or automatic order execution. {data?.updatedAt?`Updated ${new Date(data.updatedAt).toLocaleTimeString()}`:''}</footer>
 </main>;
}
