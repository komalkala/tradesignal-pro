/** Separate research-only worker. Does not place Binance orders. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
import {SYMBOLS,type SymbolId} from '../src/lib/types';
import {loadHistoricalCandles} from '../src/lib/history';
import {v7Decision} from '../src/lib/v7-decision';
import {parseEvents} from '../src/lib/v7-events';
import {sendTelegramMessage} from '../src/lib/alerts/telegram';
const truth=(v:string|undefined)=>v==='true';
const dryRun=!truth(process.env.V7_TELEGRAM_ENABLED)||truth(process.env.ALERT_DRY_RUN);
const poll=Math.max(60000,Number(process.env.V7_POLL_MS||300000));
const statePath='.signal-alerts/v7-sent.json';
const bot=process.env.TELEGRAM_BOT_TOKEN||'';const chat=process.env.TELEGRAM_CHAT_ID||'';
const useForming=truth(process.env.V7_SETUP_FORMING_ALERTS);
const activeCoins=SYMBOLS.filter(x=>!process.env.V7_SYMBOLS||process.env.V7_SYMBOLS.split(',').map(s=>s.trim()).includes(x));
let state:Record<string,number>={};
async function notify(key:string,body:string,epoch:number){
 if(state[key])return;
 if(dryRun){console.log('[V7 DRY RUN]',key,'\n',body);return;}
 if(!bot||!chat){console.error('[V7] Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');return;}
 await sendTelegramMessage(bot,chat,body);state[key]=epoch;
 await mkdir(dirname(statePath),{recursive:true});await writeFile(statePath,JSON.stringify(state,null,2));console.log('[V7 SENT]',key);
}
function whenIST(ms:number){return new Date(ms).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'short'})+' IST'}
async function check(){
 const now=Date.now();
 for(const e of parseEvents(process.env.V7_EVENTS_JSON)){
  const time=Date.parse(e.timeUTC);const left=time-now;
  for(const [tag,from,to] of [['24h',23*3600000,24*3600000],['60m',45*60000,60*60000],['15m',0,15*60000]] as const){
   if(left>=from&&left<=to)try{await notify(`event:${e.id}:${tag}`,`⚠️ V7 ECONOMIC EVENT — ${tag} WARNING\n${e.name} (${e.impact})\nTime: ${whenIST(time)}\nSource: ${e.source}\nPossible high crypto volatility. Research caution ONLY: NO ENTRY BLOCK. You decide whether to trade or wait for 1H/4H confirmation.`,now)}catch(err){console.error('[V7 EVENT ALERT FAILED]',e.id,err instanceof Error?err.message:'unknown')}
  }
 }
 // Only completed 1h candle; repeated polling does not duplicate alerts.
 for(const symbol of activeCoins){
  try{
   const [h,f,d]=await Promise.all([loadHistoricalCandles(symbol,'1h',500),loadHistoricalCandles(symbol,'4h',500),loadHistoricalCandles(symbol,'1d',500)]);
   const result=v7Decision(symbol as SymbolId,h,f,d,now);
   if(result.isFresh&&(result.status.startsWith('CONFIRMED')||(useForming&&result.status==='SETUP_FORMING'))){
    const key=`swing:${symbol}:${result.signalTime}:${result.status}`;
    await notify(key,`📊 V7 SWING PAPER RESEARCH\n${symbol} — ${result.status.replaceAll('_',' ')}\nConfirmed 1H close: ${whenIST(result.signalTime)}\nDaily bias: ${result.bias}; 4H trend: ${result.trend}\nReference: ${result.entry??'Pending'}; Stop: ${result.stop??'Pending'}; Target: ${result.target??'Pending'}\nResearch only, NOT an order or validated live recommendation. News risk never blocks entries.`,now);
   }
   console.log('[V7]',symbol,result.status,result.score+'/100',whenIST(result.signalTime));
  }catch(err){console.error('[V7 SCAN ERROR]',symbol,err instanceof Error?err.message:'unknown')}
 }
 // Retain only 90 days of event/alert deduplication records
 for(const [key,time] of Object.entries(state)){if(now-time>90*86400000)delete state[key]}
}
async function main(){try{state=JSON.parse(await readFile(statePath,'utf8'))}catch{state={}}
 console.log('[V7] started',`dryRun=${dryRun}`,`poll=${poll}`,`coins=${activeCoins.join(',')}`);
 // Default startup baseline: no catch-up trades from older candles.
 if(!Object.keys(state).length){
  for(const symbol of activeCoins){try{const [h,f,d]=await Promise.all([loadHistoricalCandles(symbol,'1h',500),loadHistoricalCandles(symbol,'4h',500),loadHistoricalCandles(symbol,'1d',500)]);const r=v7Decision(symbol,h,f,d);state[`swing:${symbol}:${r.signalTime}:${r.status}`]=Date.now()}catch{}}
  await mkdir(dirname(statePath),{recursive:true});await writeFile(statePath,JSON.stringify(state,null,2));
 }
 while(true){await check();await new Promise(resolve=>setTimeout(resolve,poll))}
}
main().catch(e=>{console.error(e);process.exitCode=1});
