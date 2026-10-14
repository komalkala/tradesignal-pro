import test from 'node:test';
import assert from 'node:assert/strict';
import {validateHistory,loadHistoricalCandles} from '../src/lib/history';
import {summarizeTrades,analyzeOutOfSample} from '../src/lib/research';
import type {Candle} from '../src/lib/types';
import type {ProBacktestResult,SimTrade} from '../src/lib/pro-backtest';
const make=(i:number):Candle=>({time:i*3600000,open:100,high:101,low:99,close:100,volume:5});
test('market candle continuity catches gaps and broken OHLC',()=>{
 const valid=Array.from({length:250},(_,i)=>make(i));assert.equal(validateHistory(valid,'1h').valid,true);
 assert.equal(validateHistory([...valid.slice(0,10),...valid.slice(11)],'1h').gaps,1);
 assert.equal(validateHistory([...valid,valid.at(-1)!],'1h').duplicates,1);
 assert.equal(validateHistory(valid.map((x,i)=>i===7?{...x,high:80}:x),'1h').invalid,1);
});
test('historical pagination yields ordered bars without duplicates',async()=>{
 let calls=0;const N=400;const now=Date.now()-1000*3600*800;
 const rows=Array.from({length:N},(_,i)=>[now+i*3600000,'100','101','99','100','5',now+i*3600000+3599999]);
 const fetcher=(async (input:string|URL|Request)=>{calls++;const u=new URL(String(input));const end=Number(u.searchParams.get('endTime')??Number.MAX_SAFE_INTEGER);const selected=rows.filter(r=>Number(r[0])<=end).slice(-Number(u.searchParams.get('limit')));return {ok:true,json:async()=>selected} as Response}) as typeof fetch;
 const result=await loadHistoricalCandles('SOLUSDT','1h',300,fetcher);assert.equal(result.length,300);assert.equal(result[0].time,now+100*3600000);assert.equal(calls,1);
});
test('chronological holdout remains separate',()=>{
 const mk=(timestamp:number,pnl:number):SimTrade=>({side:'LONG',signalTime:timestamp,entryTime:timestamp+1,exitTime:timestamp+2,entry:100,exit:101,stop:99,target:102,score:80,pnl,fee:0,reason:'Target',balance:750+pnl});
 const trades=[mk(1,10),mk(2,-4),mk(3,5),mk(4,-3)];
 const summary=summarizeTrades(trades,750);assert.equal(summary.endingBalance,758);
 const report=analyzeOutOfSample({trades,startingBalance:750} as ProBacktestResult,3);
 assert.equal(report.training.trades,2);assert.equal(report.holdout.trades,2);assert.equal(report.holdout.endingBalance,758);assert.equal(report.insufficientEvidence,true);
});
