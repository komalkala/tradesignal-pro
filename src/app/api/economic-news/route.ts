import {NextResponse} from 'next/server';
import {parseEvents,eventRisk,officialCalendarLinks} from '@/lib/v7-events';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){
 const now=Date.now();
 const all=parseEvents(process.env.V7_EVENTS_JSON);
 const events=all.filter(e=>Date.parse(e.timeUTC)>=now-3600000&&Date.parse(e.timeUTC)<=now+30*86400000);
 return NextResponse.json({
  events,level:eventRisk(all,now).level,configured:all.length>0,
  checkedAt:new Date(now).toISOString(),calendarLinks:officialCalendarLinks,
  note:all.length?'Operator-maintained calendar; confirm release times with the linked official sources.':'CALENDAR NOT CONFIGURED. This is NOT confirmation of a quiet market.',
  tradeControl:'INFORMATION_ONLY',mayTrade:true,
 },{headers:{'Cache-Control':'no-store'}});
}
