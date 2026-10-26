/** Shared single-writer paper journal. Called from V7's already-fetched 1h/4h/1d scan.
 * Also used by the standalone journal fallback when V7 monitoring is disabled.
 * Never place Binance orders. Do NOT run both writers at the same time.
 */
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {dirname} from 'node:path';
import type {Candle,SymbolId} from '../src/lib/types';
import type {V7Decision} from '../src/lib/v7-decision';
import {advancePaperTrade,emptyJournal,makePaperTrade,type JournalState} from '../src/lib/v71-journal';

const journalFile=process.env.V71_JOURNAL_PATH||'.signal-alerts/v71-paper-journal.json';
const finiteRate=(key:string,fallback:number,max:number)=>{
 const value=Number(process.env[key]??fallback);
 if(!Number.isFinite(value)||value<0||value>max)throw Error(`Invalid ${key}; require 0..${max}`);
 return value;
};
const costs=()=>({
 feePerSide:finiteRate('V71_PAPER_FEE_PER_SIDE',0.0005,0.02),
 slippage:finiteRate('V71_PAPER_SLIPPAGE',0.0002,0.02),
 maxHoldHours:72,
});
export class PaperJournalStore {
 private constructor(private state:JournalState){}
 static async open():Promise<PaperJournalStore>{
  try{
   const s=JSON.parse(await readFile(journalFile,'utf8')) as JournalState;
   if(s.version!==1||!Array.isArray(s.trades)||!s.watermarks||typeof s.watermarks!=='object')throw Error('Invalid journal state');
   return new PaperJournalStore(s);
  }catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return new PaperJournalStore(emptyJournal());throw e;}
 }
 private async persist(){
  await mkdir(dirname(journalFile),{recursive:true});
  const tmp=journalFile+'.tmp';await writeFile(tmp,JSON.stringify(this.state,null,2));await rename(tmp,journalFile);
 }
 async update(symbol:SymbolId,decision:V7Decision,hour:Candle[],now=Date.now()){
  const s=this.state;
  // No historical catch-up signals from the first observed candle.
  if(s.watermarks[symbol]===undefined){
   s.watermarks[symbol]=decision.signalTime;
   console.log('[JOURNAL] Baseline',symbol,new Date(decision.signalTime).toISOString());
  }else if(decision.signalTime>s.watermarks[symbol]!){
   const trade=makePaperTrade(decision,now);
   if(trade&&!s.trades.some(t=>t.id===trade.id)){
    const busy=s.trades.some(t=>t.symbol===symbol&&['PENDING_ENTRY','OPEN'].includes(t.status));
    if(!busy){s.trades.push(trade);console.log('[JOURNAL] New paper setup',trade.id);}
   }
   s.watermarks[symbol]=decision.signalTime;
  }
  const options=costs();
  s.trades=s.trades.map(t=>t.symbol===symbol?advancePaperTrade(t,hour,now,options):t);
  await this.persist();
  return s.trades.filter(t=>t.symbol===symbol).length;
 }
}
