"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import type { SymbolId } from "@/lib/types";
import type { V7Decision } from "@/lib/v7-decision";
import type { NewsRisk } from "@/lib/v7-events";
import type { OrderFlow, VolumeReport } from "@/lib/order-flow";

type DecisionResponse = { decision: V7Decision; events: NewsRisk; checkedAt: string };
type FlowResponse = { orderFlow: OrderFlow; volume1h: VolumeReport; volume4h: VolumeReport; checkedAt: string };
const SYMBOLS: SymbolId[] = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "TAOUSDT", "LINKUSDT", "BNBUSDT"];
const short = (coin: string) => coin.replace("USDT", "");
const ist = (time: number | string) => new Date(time).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true });
const price = (x: number | null) => x == null || !Number.isFinite(x) ? "—" : `$${x.toLocaleString("en-US", { maximumFractionDigits: x >= 100 ? 2 : 4 })}`;

function Surface({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-[#2b3b4b] bg-[#172333] ${className}`}>{children}</div>;
}
function Mini({ title, value, hint, tone = "" }: { title: string; value: string; hint?: string; tone?: string }) {
  return <div className="rounded-lg bg-[#1d2d3e] p-3 min-w-0"><p className="text-[12px] text-slate-400">{title}</p><p className={`mt-1 text-[15px] font-semibold truncate ${tone}`}>{value}</p>{hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}</div>;
}
function Vol({ label, volume }: { label: string; volume?: VolumeReport }) {
  const color = volume?.level === "HIGH" ? "text-teal-300" : volume?.level === "LOW" ? "text-amber-300" : "text-slate-200";
  return <Mini title={`${label} Volume`} value={volume ? `${volume.level} · ${volume.volumeRatio.toFixed(2)}×` : "Unavailable"} hint="vs previous 20 closed candles" tone={color} />;
}

export default function V7Page() {
  const [symbol, setSymbol] = useState<SymbolId>("BTCUSDT");
  const [decisionData, setDecisionData] = useState<DecisionResponse | null>(null);
  const [flowData, setFlowData] = useState<FlowResponse | null>(null);
  const [decisionError, setDecisionError] = useState("");
  const [flowError, setFlowError] = useState("");
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);
  const update = useCallback(() => setTick(x => x + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setDecisionData(null); setFlowData(null); setDecisionError(""); setFlowError("");
    const fetchOne = async <T,>(path: string): Promise<T> => {
      const response = await fetch(`${path}?symbol=${symbol}`, { cache: "no-store", signal: controller.signal });
      const body = await response.json();
      if (!response.ok) throw Error(body.error || `HTTP ${response.status}`);
      return body as T;
    };
    Promise.allSettled([fetchOne<DecisionResponse>("/api/v7"), fetchOne<FlowResponse>("/api/order-flow")]).then(results => {
      if (controller.signal.aborted) return;
      const [a, b] = results;
      if (a.status === "fulfilled") setDecisionData(a.value); else setDecisionError(a.reason instanceof Error ? a.reason.message : "Swing data unavailable");
      if (b.status === "fulfilled") setFlowData(b.value); else setFlowError(b.reason instanceof Error ? b.reason.message : "Order flow unavailable");
      setLoading(false);
    });
    return () => controller.abort();
  }, [symbol, tick]);
  useEffect(() => { const id = setInterval(update, 60000); return () => clearInterval(id); }, [update]);

  const d = decisionData?.decision;
  const f = flowData?.orderFlow;
  const isConfirmed = d?.status === "CONFIRMED_LONG" || d?.status === "CONFIRMED_SHORT";
  const isForming = d?.status === "SETUP_FORMING";
  const stale = !!d && !d.isFresh;
  const signal = !d ? "LOADING" : stale ? "STALE · WAIT" : isConfirmed ? d.status === "CONFIRMED_LONG" ? "LONG SETUP" : "SHORT SETUP" : isForming ? "SETUP FORMING" : "WAIT — NO ENTRY";
  const signalTone = isConfirmed && !stale ? "text-teal-300" : "text-amber-300";
  const flowLabel = f?.pressure === "BUYERS_DOMINANT" ? "Buyers stronger" : f?.pressure === "SELLERS_DOMINANT" ? "Sellers stronger" : f ? "Balanced" : "Unavailable";
  const buyerPct = f ? Math.min(100, Math.max(0, f.buyPercent)) : 50;
  const news = decisionData?.events;

  return <main className="mx-auto max-w-[1120px] px-4 py-6 text-[13px] text-slate-100 sm:px-6" style={{fontFamily:"Poppins, sans-serif"}}>
    <div className="mb-5 flex items-center justify-between gap-3 flex-wrap">
      <div><h1 className="text-[21px] font-semibold leading-tight">TradeSignal Pro <span className="text-teal-300">V7</span></h1><p className="mt-1 text-[12px] text-slate-400">Clean Swing Overview · 1H entry / 4H trend / 1D bias</p></div>
      <div className="flex items-center gap-2"><span className="text-[11px] text-slate-400">Research only · Manual trading</span><button onClick={update} disabled={loading} className="rounded-lg border border-[#375368] px-3 py-2 text-[12px] hover:bg-[#23394a] disabled:opacity-50">{loading ? "Updating…" : "↻ Refresh"}</button></div>
    </div>

    <div className="mb-4 flex gap-2 flex-wrap">{SYMBOLS.map(coin => <button key={coin} onClick={() => setSymbol(coin)} className={`rounded-lg px-4 py-2 font-medium text-[12px] ${symbol === coin ? "bg-[#2f7777] text-white" : "bg-[#203043] text-slate-200 hover:bg-[#2a4157]"}`}>{short(coin)}</button>)}</div>

    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.05fr_.95fr]">
      <Surface className="p-5">
        <p className="text-[12px] text-slate-400">{symbol} · Latest completed 1H candle</p>
        <h2 className={`mt-2 text-[26px] font-semibold leading-tight ${signalTone}`}>{signal}</h2>
        <p className="mt-2 text-[13px] text-slate-300">{stale ? "Signal is outdated. Do not treat it as a new setup." : d?.message || "Checking latest swing setup…"}</p>
        {d && <p className="mt-3 text-[11px] text-slate-400">Candle: {ist(d.signalTime)} IST · Score {d.score}/100 (checks passed, not win probability)</p>}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Mini title="1D Bias" value={d?.bias ?? "—"}/><Mini title="4H Trend" value={d?.trend ?? "—"}/><Mini title="1H Entry" value={d ? isConfirmed && !stale ? "Confirmed" : isForming && !stale ? "Forming" : "Not ready" : "—"}/>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2"><Mini title="Entry reference" value={price(isConfirmed && !stale ? d!.entry : null)}/><Mini title="Stop" value={price(isConfirmed && !stale ? d!.stop : null)}/><Mini title="Target" value={price(isConfirmed && !stale ? d!.target : null)}/></div>
        {decisionError && <p role="alert" className="mt-3 text-rose-300">Swing API: {decisionError}</p>}
      </Surface>

      <Surface className="p-5">
        <div className="flex items-center justify-between gap-2"><h2 className="text-[16px] font-semibold">Buyer / Seller Pressure</h2><span className="text-[11px] text-slate-400">Recent executed trades</span></div>
        <p className="mt-2 text-[18px] font-semibold">{flowLabel}</p>
        <div className="mt-4 flex justify-between text-[12px]"><span className="text-teal-300">Buyers {f ? f.buyPercent.toFixed(1) : "—"}%</span><span className="text-rose-300">Sellers {f ? f.sellPercent.toFixed(1) : "—"}%</span></div>
        <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-[#34465a]"><div className="bg-[#2db9a2]" style={{width:`${buyerPct}%`}}/><div className="flex-1 bg-[#ec717a]"/></div>
        <p className="mt-3 text-[11px] text-slate-400">Buying/selling pressure is from Binance's latest aggregated executed trades, not prediction of future price.</p>
        <div className="mt-4 grid grid-cols-2 gap-2"><Vol label="1H" volume={flowData?.volume1h}/><Vol label="4H" volume={flowData?.volume4h}/></div>
        {flowError && <p role="alert" className="mt-3 text-rose-300">Order flow API: {flowError}</p>}
      </Surface>
    </div>

    <Surface className="mt-4 px-4 py-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[13px] font-medium">Economic news</p><p className="mt-0.5 text-[12px] text-slate-400">{news?.upcoming.length ? `${news.upcoming.length} configured upcoming event(s) · ${news.level}` : "Calendar may be unconfigured — check official sources"}</p></div><span className="rounded-lg border border-amber-800/50 bg-amber-950/20 px-3 py-2 text-[12px] text-amber-200">⚠ Caution only · Never blocks trades</span></div>
      {!!news?.upcoming.length && <div className="mt-3 flex flex-wrap gap-2">{news.upcoming.slice(0,2).map(e=><a href={e.source} target="_blank" rel="noopener noreferrer" key={e.id} className="rounded-lg bg-[#203043] px-3 py-2 text-[12px] text-teal-200">{e.name} · {ist(e.timeUTC)} IST ↗</a>)}</div>}
    </Surface>

    <details className="mt-4 rounded-xl border border-[#2b3b4b] bg-[#172333] p-4"><summary className="cursor-pointer font-medium text-[13px]">Why this signal? · Show confirmation details</summary><div className="mt-3 grid gap-2 sm:grid-cols-2">{d?.checks.map(check=><div key={check.key} className="flex items-start gap-2 rounded-lg bg-[#203043] p-3"><span className={check.passed ? "text-teal-300" : "text-amber-300"}>{check.passed ? "✓" : "○"}</span><div><p className="font-medium">{check.name}</p><p className="text-[11px] text-slate-400">{check.detail}</p></div></div>)}{!d && <p className="text-slate-400">No confirmation data yet.</p>}</div></details>

    <p className="mt-4 text-[11px] text-slate-500">Live refresh every 60 seconds. Missing API data is shown as unavailable, never as a confirmed setup. Even a confirmed setup is research-only until independently validated.</p>
  </main>;
}
