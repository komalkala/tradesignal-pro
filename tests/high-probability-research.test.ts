import test from 'node:test';
import assert from 'node:assert/strict';
import {highProbabilityCandidate,runHighProbabilityBacktest} from '../src/lib/high-probability-research';
import type {Candle} from '../src/lib/types';
const bars=(count:number,interval:number):Candle[]=>Array.from({length:count},(_,i)=>({time:1_700_000_000_000+i*interval,open:100,high:101,low:99,close:100,volume:100}));
test('insufficient closed higher-timeframe context produces no signal',()=>{
 assert.equal(highProbabilityCandidate(bars(230,300000),bars(10,3600000),bars(10,3600000),'SOLUSDT'),null);
});
test('flat market produces no trades',()=>{
 const result=runHighProbabilityBacktest({candles:bars(270,300000),hourly:bars(270,3600000),btcHourly:bars(270,3600000),symbol:'BTCUSDT'});
 assert.equal(result.trades.length,0);assert.equal(result.metrics.netPnl,0);
});
