/** Independent, read-only combined sentiment Telegram digest. */
import {mkdir,readFile,rename,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {getSentimentReport,digestText,type SentimentReport} from '../src/lib/sentiment';
import {sendTelegramMessage} from '../src/lib/alerts/telegram';
const dryRun=process.env.ALERT_DRY_RUN==='true';
const token=process.env.TELEGRAM_BOT_TOKEN?.trim();
const chatId=process.env.TELEGRAM_CHAT_ID?.trim();
const enabled=process.env.SENTIMENT_TELEGRAM_ENABLED==='true';
const pollMinutes=Number(process.env.SENTIMENT_POLL_MINUTES??'60');
const pollMs=(Number.isInteger(pollMinutes)&&pollMinutes>=15?pollMinutes:60)*60000;
const stateFile=path.resolve(process.cwd(),dryRun?'.signal-alerts/sentiment.dry-run.json':'.signal-alerts/sentiment.json');
type State={lastDigestAt:string;signature:string};
let state:State={lastDigestAt:'',signature:''};
let busy=false;
function log(m:string){console.log(`[${new Date().toISOString()}] SENTIMENT ${m}`);}
async function load(){try{const s=JSON.parse(await readFile(stateFile,'utf8')) as Partial<State>;if(typeof s.signature==='string'&&typeof s.lastDigestAt==='string')state={signature:s.signature,lastDigestAt:s.lastDigestAt};else throw Error('Invalid state file');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}}
async function save(){await mkdir(path.dirname(stateFile),{recursive:true});const tmp=stateFile+'.tmp';await writeFile(tmp,JSON.stringify(state,null,2));await rename(tmp,stateFile);}
function signature(report:SentimentReport){return JSON.stringify({fear:report.fearGreed?.value??null,coins:report.coins.map(c=>[c.symbol,c.interval,c.state])});}
async function scan(){if(busy)return;busy=true;try{
 const report=await getSentimentReport('1h');
 const signatureNow=signature(report);
 const last=Date.parse(state.lastDigestAt)||0;
 const due=Date.now()-last>=24*3600000;
 const changed=signatureNow!==state.signature;
 const reliable=!!report.fearGreed&&report.errors.length===0&&report.coins.length===6;
 log(`fear=${report.fearGreed?.value??'unavailable'} coinStatuses=${report.coins.map(x=>`${x.symbol}:${x.state}`).join(',')} complete=${reliable} changed=${changed}`);
 if(!reliable){log('Incomplete input: skipping notification; will retry');return;}
 if(!due&&!changed)return;
 const msg=digestText(report);
 if(dryRun)log(`DRY RUN digest:\n${msg}`);
 else {await sendTelegramMessage(token!,chatId!,msg);log('Combined digest delivered');}
 state={signature:signatureNow,lastDigestAt:new Date().toISOString()};await save();
 }catch(e){log(`Error: ${e instanceof Error?e.message:String(e)}`);}finally{busy=false;}}
async function main(){if(!enabled){log('Disabled; set SENTIMENT_TELEGRAM_ENABLED=true');return;}
 if(!dryRun&&(!token||!chatId))throw Error('Missing Telegram credentials');
 await load();
 log(`Starting independent digest every ${pollMs/60000}m; dryRun=${dryRun}`);
 await scan();setInterval(()=>void scan(),pollMs);
}
void main().catch(e=>{console.error(e);process.exitCode=1;});
