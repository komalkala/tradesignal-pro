export type RiskEvent = { id:string; title:string; category:'FOMC'|'CPI'|'UPGRADE'|'UNLOCK'|'OTHER'; dateUTC:string; source:string; impact:'HIGH'|'MEDIUM'; scope:'ALL'|'BTC'|'ETH'|'SOL'; verified:boolean; };
/** Date-only events are calendar-day warnings, NOT claims about an exact release time. */
export const EVENTS: RiskEvent[] = [
  {id:'fomc-oct-2026',title:'FOMC scheduled meeting concludes (decision time not verified)',category:'FOMC',dateUTC:'2026-10-28',source:'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm',impact:'HIGH',scope:'ALL',verified:true},
  {id:'fomc-dec-2026',title:'FOMC scheduled meeting concludes (decision time not verified)',category:'FOMC',dateUTC:'2026-12-09',source:'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm',impact:'HIGH',scope:'ALL',verified:true},
];
export const EVENT_SOURCES = [
 {name:'US CPI release schedule (BLS)',url:'https://www.bls.gov/schedule/news_release/cpi.htm',note:'Add exact scheduled dates to EVENTS after checking the official calendar'},
 {name:'FOMC calendar',url:'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm',note:'Official meeting dates; decision time separately verified'},
 {name:'Solana network status',url:'https://status.solana.com/',note:'Outages can only be detected after occurrence, not predicted'},
 {name:'ETF flow data',url:'https://www.sosovalue.com/assets/etf',note:'Provider data integration and licensing required before automated alerts'},
];
export function utcDay(ms:number){return new Date(ms).toISOString().slice(0,10);}
export function riskContext(now=Date.now(),coin?:'BTC'|'ETH'|'SOL') {
  const today=utcDay(now), weekday=new Date(now).getUTCDay();
  const upcoming=EVENTS.filter(e=>(e.scope==='ALL'||!coin||e.scope===coin)&&e.dateUTC>=today)
   .map(e=>({...e,daysUntil:Math.round((Date.parse(e.dateUTC+'T00:00:00Z')-Date.parse(today+'T00:00:00Z'))/86400000)}))
   .filter(e=>e.daysUntil<=14).sort((a,b)=>a.daysUntil-b.daysUntil);
  const weekend=weekday===0||weekday===6;
  return {weekend,upcoming,highEventWindow:upcoming.some(e=>e.impact==='HIGH'&&e.daysUntil<=1),
    warning:weekend?'Weekend: liquidity conditions may be thinner; this does not predict price direction.' : 'Weekend liquidity flag inactive.'};
}
