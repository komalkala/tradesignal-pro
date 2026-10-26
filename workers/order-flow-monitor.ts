/** Read-only buyer/seller pressure and volume-change Telegram alerts. Separate from trading alerts. */
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import path from 'node:path';
import {getCandles} from '../src/lib/binance';
import {SYMBOLS,type SymbolId} from '../src/lib/types';
import {analyzeAggTrades,analyzeVolume,type AggTrade,type Pressure} from '../src/lib/order-flow';
import {sendTelegramMessage} from '../src/lib/alerts/telegram';
const enabled=process.env.ORDER_FLOW_TELEGRAM_ENABLED==='true';
const dryRun=process.env.ALERT_DRY_RUN!=='false';
const token=process.env.TELEGRAM_BOT_TOKEN?.trim();
const chatId=process.env.TELEGRAM_CHAT_ID?.trim();
const everyMin=Math.max(5,Number(process.env.ORDER_FLOW_POLL_MINUTES||'5'));
const watch=(process.env.ORDER_FLOW_SYMBOLS||'BTCUSDT,ETHUSDT,SOLUSDT,TAOUSDT,LINKUSDT,BNBUSDT').split(',').map(s=>s.trim()).filter((s):s is SymbolId=>SYMBOLS.some(v=>v===s));
const file=path.resolve(process.cwd(),dryRun?'.signal-alerts/order-flow.dry-run.json':'.signal-alerts/order-flow.json');
type State=Record<string,{pressure:Pressure;high1hCandle:number;high4hCandle:number;initialized:boolean}>;
let state:State={};let running=false;
const log=(s:string)=>console.log(`[${new Date().toISOString()}] ORDER FLOW ${s}`);
async function load(){try{state=JSON.parse(await readFile(file,'utf8')) as State}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e}}
async function persist(){await mkdir(path.dirname(file),{recursive:true});const tmp=file+'.tmp';await writeFile(tmp,JSON.stringify(state,null,2));await rename(tmp,file)}
async function fetchTrades(symbol:SymbolId){const u=new URL('https://fapi.binance.com/fapi/v1/aggTrades');u.searchParams.set('symbol',symbol);u.searchParams.set('limit','1000');const r=await fetch(u,{cache:'no-store',signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error(`Binance aggregated trades HTTP ${r.status}`);return await r.json() as AggTrade[]}
async function check(symbol:SymbolId){
 const [trades,h1,h4]=await Promise.all([fetchTrades(symbol),getCandles(symbol,'1h',250),getCandles(symbol,'4h',250)]);
 const flow=analyzeAggTrades(trades),v1=analyzeVolume(h1,'1h'),v4=analyzeVolume(h4,'4h');
 const prev=state[symbol];const next={pressure:flow.pressure,high1hCandle:v1.level==='HIGH'?v1.lastCandleTime:prev?.high1hCandle??0,high4hCandle:v4.level==='HIGH'?v4.lastCandleTime:prev?.high4hCandle??0,initialized:true};
 // First scan establishes a baseline. Avoid alerts based on historical changes.
 if(!prev?.initialized){state[symbol]=next;await persist();log(`${symbol} baseline: ${flow.pressure} 1h=${v1.level} 4h=${v4.level}`);return}
 const pressureChanged=flow.pressure!==prev.pressure&&flow.pressure!=='BALANCED';
 const newHigh1h=v1.level==='HIGH'&&v1.lastCandleTime!==prev.high1hCandle;
 const newHigh4h=v4.level==='HIGH'&&v4.lastCandleTime!==prev.high4hCandle;
 if(pressureChanged||newHigh1h||newHigh4h){
 const lines=[`📊 ORDER FLOW · ${symbol}`,`Aggressive buyers ${flow.buyPercent.toFixed(1)}% | sellers ${flow.sellPercent.toFixed(1)}%`, `Pressure: ${flow.pressure.replaceAll('_',' ')}`,`1H volume: ${v1.volumeRatio.toFixed(2)}x (${v1.level})`,`4H volume: ${v4.volumeRatio.toFixed(2)}x (${v4.level})`,`Recent sample: ${flow.tradeCount} aggregated trades`,'Research only · Not a LONG/SHORT confirmation.'];
 if(dryRun)log(`DRY RUN\n${lines.join('\n')}`);else await sendTelegramMessage(token!,chatId!,lines.join('\n'));
 log(`${symbol}: alert ${pressureChanged?'pressure change ':''}${newHigh1h?'1h high ':''}${newHigh4h?'4h high':''}`);
 }
 state[symbol]=next;await persist();
}
async function scan(){if(running)return;running=true;try{for(const symbol of watch){try{await check(symbol)}catch(e){log(`${symbol} failed: ${e instanceof Error?e.message:String(e)}`)}}}finally{running=false}}
async function main(){if(!enabled){log('Disabled. Set ORDER_FLOW_TELEGRAM_ENABLED=true');return}if(!watch.length)throw Error('No supported symbols');if(!dryRun&&(!token||!chatId))throw Error('Missing Telegram token/chat id');await load();log(`Watching ${watch.join(',')} every ${everyMin}m dryRun=${dryRun}`);await scan();setInterval(()=>void scan(),everyMin*60000)}
void main().catch(e=>{console.error(e);process.exitCode=1});
