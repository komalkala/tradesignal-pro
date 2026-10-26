/** One configured economic calendar for every screen and the V7 notification worker.
 * No stale, hard-coded FOMC/CPI dates. A missing schedule is UNKNOWN, not an all-clear.
 */
import { parseEvents, officialCalendarLinks, type EconomicEvent } from './v7-events';

export type RiskEvent = {
  id: string;
  title: string;
  category: 'FOMC' | 'CPI' | 'OTHER';
  dateUTC: string;
  source: string;
  impact: 'HIGH' | 'MEDIUM';
  scope: 'ALL' | 'BTC' | 'ETH' | 'SOL' | 'TAO' | 'LINK' | 'BNB';
  verified: boolean;
};
export const EVENT_SOURCES = [
  ...officialCalendarLinks.map(s => ({...s, note: 'Use official release date AND time in V7_EVENTS_JSON; updates are manual.'})),
  {name:'Solana network status',url:'https://status.solana.com/',note:'Unscheduled outages cannot be predicted.'},
];
export function utcDay(ms:number){return new Date(ms).toISOString().slice(0,10);}
function eventCategory(name:string):RiskEvent['category'] {
  return /FOMC|FEDERAL RESERVE|FED RATE/i.test(name) ? 'FOMC' : /\bCPI\b|INFLATION/i.test(name) ? 'CPI' : 'OTHER';
}
function asRiskEvent(e:EconomicEvent):RiskEvent {
  return {id:e.id,title:e.name,category:eventCategory(e.name),dateUTC:e.timeUTC.slice(0,10),
    source:e.source,impact:e.impact==='MEDIUM'?'MEDIUM':'HIGH',
    scope: (['BTC','ETH','SOL','TAO','LINK','BNB'] as const).find(x=>e.scope===x)??'ALL',
    // Configuration is operator supplied. Valid JSON does NOT mean independently verified.
    verified:false};
}
export function riskContext(now=Date.now(), coin?:'BTC'|'ETH'|'SOL'|'TAO'|'LINK'|'BNB', configured?:EconomicEvent[]) {
  const events=configured??parseEvents(process.env.V7_EVENTS_JSON);
  const today=utcDay(now), weekday=new Date(now).getUTCDay();
  const upcoming=events.map(asRiskEvent)
    .filter(e=>(e.scope==='ALL'||!coin||e.scope===coin)&&e.dateUTC>=today)
    .map(e=>({...e,daysUntil:Math.round((Date.parse(e.dateUTC+'T00:00:00Z')-Date.parse(today+'T00:00:00Z'))/86400000)}))
    .filter(e=>e.daysUntil<=14).sort((a,b)=>a.daysUntil-b.daysUntil);
  const weekend=weekday===0||weekday===6;
  return {weekend,upcoming,calendarConfigured:events.length>0,
    highEventWindow:upcoming.some(e=>e.impact==='HIGH'&&e.daysUntil<=1),
    warning:weekend?'Weekend liquidity may be thinner. This does not predict direction.':'Weekend liquidity flag inactive.',
    note:events.length?'Operator-configured dates; confirm event times with official sources. Trading is never blocked.':'Economic calendar is NOT configured. No listed events does not mean no news. Trading is never blocked.'};
}
