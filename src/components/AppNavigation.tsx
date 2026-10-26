"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Activity, Menu, X, ChevronDown } from "lucide-react";

// Keep only four destinations visible day-to-day. Nothing is deleted;
// research tools remain accessible under Research.
const primary = [
  { href: "/v7", label: "Dashboard" },
  { href: "/trade-journal", label: "Trade Journal" },
  { href: "/order-flow", label: "Market Data" },
  { href: "/economic-news", label: "Economic News" },
];
const research = [
  { href: "/", label: "Old Strategy Dashboard" },
  { href: "/swing-research", label: "Swing Backtest" },
  { href: "/setup-diagnostics", label: "Why No Trades?" },
  { href: "/smc-compare", label: "Old / SMC / V6.4 Comparison" },
  { href: "/strategy-research", label: "Strategy Research" },
  { href: "/sentiment", label: "Fear & Greed / RSI" },
  { href: "/historical-data", label: "Historical Data" },
  { href: "/market-intelligence", label: "Market Intelligence" },
];

export default function AppNavigation() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [researchOpen, setResearchOpen] = useState(false);
  const active = (href: string) => pathname === href || (href !== "/" && pathname.startsWith(href + "/"));
  const itemClass = (href: string) => `inline-flex min-h-9 items-center rounded-md px-3 py-2 text-[13px] font-medium transition-colors ${active(href) ? "bg-[#2e6463] text-white" : "text-[#b8ccd7] hover:bg-[#223449] hover:text-white"}`;

  return (
    <header className="sticky top-0 z-50 border-b border-[#263a4d] bg-[#0e1926]/95 backdrop-blur-md">
      <nav aria-label="Main navigation" className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
        <Link href="/v7" className="inline-flex shrink-0 items-center gap-2 text-[15px] font-semibold text-white" onClick={() => setMobileOpen(false)}>
          <span className="rounded-md bg-[#183c41] p-2 text-teal-300"><Activity size={17} /></span>
          <span>TradeSignal <span className="text-teal-300">Pro</span></span>
        </Link>

        <div className="hidden min-w-0 flex-1 items-center justify-end gap-1 lg:flex">
          {primary.map(item => <Link key={item.href} href={item.href} className={itemClass(item.href)}>{item.label}</Link>)}
          <div className="relative">
            <button type="button" aria-expanded={researchOpen} aria-controls="research-nav-menu" onClick={() => setResearchOpen(v => !v)} className="inline-flex min-h-9 items-center gap-1 rounded-md px-3 py-2 text-[13px] font-medium text-[#b8ccd7] hover:bg-[#223449] hover:text-white">
              Research <ChevronDown size={14} className={researchOpen ? "rotate-180" : ""} />
            </button>
            {researchOpen && <><button type="button" className="fixed inset-0 z-[-1] cursor-default" aria-label="Close menu" onClick={() => setResearchOpen(false)}/><div id="research-nav-menu" className="absolute right-0 top-full mt-2 w-64 rounded-lg border border-[#355266] bg-[#172637] p-2 shadow-xl">
              {research.map(item => <Link key={item.href} href={item.href} onClick={() => setResearchOpen(false)} className={`${itemClass(item.href)} flex w-full`}>{item.label}</Link>)}
            </div></>}
          </div>
        </div>

        <button type="button" className="ml-auto inline-flex h-10 w-10 items-center justify-center rounded-md border border-[#355266] text-slate-200 lg:hidden" aria-label={mobileOpen ? "Close navigation" : "Open navigation"} aria-controls="mobile-nav-menu" aria-expanded={mobileOpen} onClick={() => setMobileOpen(v => !v)}>
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>
      {mobileOpen && <div id="mobile-nav-menu" className="max-h-[75vh] overflow-y-auto border-t border-[#263a4d] px-4 py-3 lg:hidden">
        <div className="mx-auto grid max-w-7xl gap-1 sm:grid-cols-2">
          {[...primary, ...research].map(item => <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className={itemClass(item.href)}>{item.label}</Link>)}
        </div>
      </div>}
    </header>
  );
}
