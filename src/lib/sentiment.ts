import { SYMBOLS, type SymbolId } from './types';
import { getCandles } from './binance';
import { rsi } from './indicators';

export const SENTIMENT_SYMBOLS = SYMBOLS;
export type SentimentInterval = '1h' | '4h' | '1d';
export type RSIState = 'OVERBOUGHT' | 'OVERSOLD' | 'NEUTRAL';
export type CoinSentiment = {symbol:SymbolId;interval:SentimentInterval;rsi:number;state:RSIState;close:number;candleClosedAt:string};
export type FearGreed = {value:number;label:string;timestamp:string;source:'Alternative.me'};
export type SentimentReport = {fearGreed:FearGreed|null;fearGreedError:string|null;coins:CoinSentiment[];errors:{symbol:string;message:string}[];updatedAt:string};

export function classifyRsi(value:number):RSIState {
 if(!Number.isFinite(value)) throw Error('RSI not finite');
 return value>=70?'OVERBOUGHT':value<=30?'OVERSOLD':'NEUTRAL';
}
export function classifyFear(value:number):string {
 if(!Number.isInteger(value)||value<0||value>100)throw Error('Invalid fear/greed value');
 return value<=24?'Extreme Fear':value<=44?'Fear':value<=55?'Neutral':value<=74?'Greed':'Extreme Greed';
}
export async function getFearGreed(fetcher:typeof fetch=fetch):Promise<FearGreed> {
 const response=await fetcher('https://api.alternative.me/fng/?limit=1&format=json',{cache:'no-store',signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw Error(`Fear and Greed source HTTP ${response.status}`);
 const json:unknown=await response.json();
 const raw=(json as {data?:Array<{value?:string;timestamp?:string}>})?.data?.[0];
 if(!raw)throw Error('Fear and Greed data missing');
 const value=Number(raw.value),seconds=Number(raw.timestamp);
 if(!Number.isInteger(value)||value<0||value>100||!Number.isFinite(seconds)||seconds<=0)throw Error('Invalid Fear and Greed response');
 const timestamp=new Date(seconds*1000).toISOString();
 if(Date.now()-seconds*1000>3*86400000)throw Error('Fear and Greed data stale');
 return {value,label:classifyFear(value),timestamp,source:'Alternative.me'};
}
export async function getCoinSentiment(symbol:SymbolId,interval:SentimentInterval):Promise<CoinSentiment> {
 if(!SYMBOLS.includes(symbol))throw Error('Unsupported symbol');
 const bars=await getCandles(symbol,interval,250);
 const last=bars.at(-1);
 if(!last)throw Error('No completed candles');
 const values=rsi(bars.map(x=>x.close),14);
 const value=values.at(-1)!;
 if(!Number.isFinite(value))throw Error('RSI unavailable');
 const ms=interval==='1h'?3600000:interval==='4h'?14400000:86400000;
 if(Date.now()-(last.time+ms)>ms+300000)throw Error('RSI candle data stale');
 return {symbol,interval,rsi:Math.round(value*100)/100,state:classifyRsi(value),close:last.close,candleClosedAt:new Date(last.time+ms).toISOString()};
}
export async function getSentimentReport(interval:SentimentInterval='1h'):Promise<SentimentReport> {
 const [fearResult,...results]=await Promise.allSettled([getFearGreed(),...SYMBOLS.map(s=>getCoinSentiment(s,interval))]);
 const fearGreed=fearResult.status==='fulfilled'?fearResult.value:null;
 const fearGreedError=fearResult.status==='rejected'?String(fearResult.reason instanceof Error?fearResult.reason.message:fearResult.reason):null;
 const coins:CoinSentiment[]=[],errors:{symbol:string;message:string}[]=[];
 results.forEach((result,index)=>{if(result.status==='fulfilled')coins.push(result.value as CoinSentiment);else errors.push({symbol:SYMBOLS[index],message:result.reason instanceof Error?result.reason.message:String(result.reason)});});
 return {fearGreed,fearGreedError,coins,errors,updatedAt:new Date().toISOString()};
}
export function digestText(report:SentimentReport):string {
 const lines=['📊 TradeSignal Pro — Market Sentiment','Research only · NOT a LONG/SHORT trade signal','',report.fearGreed?`🌍 Crypto Fear & Greed: ${report.fearGreed.value}/100 (${report.fearGreed.label})`:`🌍 Fear & Greed unavailable: ${report.fearGreedError??'Unknown'}`,
  report.fearGreed?'Source: Alternative.me · Broad crypto sentiment (not coin-specific)':'','', 'RSI(14) on completed futures candles:'];
 for(const item of report.coins)lines.push(`${item.symbol.replace('USDT','')} ${item.interval}: RSI ${item.rsi.toFixed(1)} — ${item.state}`);
 for(const e of report.errors)lines.push(`${e.symbol.replace('USDT','')}: data unavailable (${e.message})`);
 lines.push('','RSI ≥ 70: overbought · RSI ≤ 30: oversold','Overbought ≠ automatic SHORT; oversold ≠ automatic LONG.','Data as of '+report.updatedAt);
 return lines.filter(x=>x!==undefined).join('\n');
}
