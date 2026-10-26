/** Standalone fallback journal worker. Run only when V7-SWING is not running. */
import {SYMBOLS} from '../src/lib/types';
import {loadHistoricalCandles} from '../src/lib/history';
import {v7Decision} from '../src/lib/v7-decision';
import {PaperJournalStore} from './journal-store';
const poll=Math.max(60000,Number(process.env.V71_JOURNAL_POLL_MS||300000));
const symbols=SYMBOLS.filter(s=>!process.env.V71_SYMBOLS||process.env.V71_SYMBOLS.split(',').map(x=>x.trim()).includes(s));
async function main(){
 const journal=await PaperJournalStore.open();
 console.log('[JOURNAL] Standalone fallback; do not run alongside V7 journal integration.');
 while(true){for(const symbol of symbols){try{
  const [h,f,d]=await Promise.all([loadHistoricalCandles(symbol,'1h',500),loadHistoricalCandles(symbol,'4h',500),loadHistoricalCandles(symbol,'1d',500)]);
  const now=Date.now(),decision=v7Decision(symbol,h,f,d,now);
  const count=await journal.update(symbol,decision,h,now);
  console.log('[JOURNAL]',symbol,decision.status,`recorded=${count}`);
 }catch(e){console.error('[JOURNAL ERROR]',symbol,e instanceof Error?e.message:String(e));}}
 await new Promise(r=>setTimeout(r,poll));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
