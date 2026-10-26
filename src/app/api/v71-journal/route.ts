import {readFile} from 'node:fs/promises';
import {NextResponse} from 'next/server';
import {emptyJournal,paperMetrics,type JournalState} from '@/lib/v71-journal';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(){
 try{
 const raw=await readFile(process.env.V71_JOURNAL_PATH||'.signal-alerts/v71-paper-journal.json','utf8');
 const state=JSON.parse(raw) as JournalState;
 if(state.version!==1||!Array.isArray(state.trades))throw Error('Journal format invalid');
 return NextResponse.json({metrics:paperMetrics(state.trades),trades:state.trades.slice(-150).reverse(),updatedAt:Math.max(0,...state.trades.map(x=>x.lastChecked)),paperOnly:true},{headers:{'Cache-Control':'no-store'}})
 }catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')return NextResponse.json({error:'Journal file unavailable or corrupted. Check worker log.'},{status:503});return NextResponse.json({metrics:paperMetrics([]),trades:[],updatedAt:null,paperOnly:true,notice:'Start npm run v71:journal to begin recording NEW signals. Historical trades are not imported.'},{headers:{'Cache-Control':'no-store'}})}
}
