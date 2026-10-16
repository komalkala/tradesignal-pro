/** Verified events provided by the operator. No fabricated or scraped schedules. */
export type EconomicEvent = {id:string;name:string;timeUTC:string;impact:'CRITICAL'|'HIGH'|'MEDIUM';source:string;scope?:string};
export type NewsRisk = {level:'NORMAL'|'CAUTION'|'HIGH_VOLATILITY';notes:string[];upcoming:EconomicEvent[];mayTrade:boolean};
export function parseEvents(input:string|undefined):EconomicEvent[]{
 if(!input)return [];
 let raw:unknown;try{raw=JSON.parse(input)}catch{return []}
 if(!Array.isArray(raw))return [];
 return raw.filter((e):e is EconomicEvent=>{
  if(!e||typeof e!=='object')return false;
  const x=e as Record<string,unknown>;
  return typeof x.id==='string'&&x.id.length>0&&typeof x.name==='string'&&x.name.length>0&&typeof x.timeUTC==='string'&&Number.isFinite(Date.parse(x.timeUTC))&&['CRITICAL','HIGH','MEDIUM'].includes(String(x.impact))&&typeof x.source==='string'&&/^https:\/\//.test(x.source);
 }).sort((a,b)=>Date.parse(a.timeUTC)-Date.parse(b.timeUTC));
}
export function eventRisk(events:EconomicEvent[],now=Date.now()):NewsRisk{
 const upcoming=events.filter(e=>{const delta=Date.parse(e.timeUTC)-now;return delta>-2*3600000&&delta<7*86400000}).slice(0,15);
 const near=upcoming.filter(e=>{const delta=Date.parse(e.timeUTC)-now;return delta<=3600000&&delta>=-3600000});
 const critical=near.some(e=>e.impact==='CRITICAL');
 const level=critical?'HIGH_VOLATILITY':near.length?'CAUTION':'NORMAL';
 return {level,upcoming,mayTrade:true,notes:near.length?[`Nearby event: ${near.map(e=>e.name).join(', ')}`,'Informational warning only. Entries and signals are never blocked by this module.']:['No configured high-impact event within 1 hour. Calendar may be incomplete.']};
}
export const officialCalendarLinks=[
 {name:'BLS CPI',url:'https://www.bls.gov/schedule/news_release/cpi.htm'},
 {name:'Federal Reserve FOMC',url:'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm'},
 {name:'BEA Economic Releases',url:'https://www.bea.gov/news/schedule/'},
];
