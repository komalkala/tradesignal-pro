import test from 'node:test';
import assert from 'node:assert/strict';
import {closedAt,simulateExit} from '../src/lib/quick-backtest';
import type {Candle} from '../src/lib/types';
const t=300000;
const candle=(i:number,o:number,h:number,l:number,c:number):Candle=>({time:i*t,open:o,high:h,low:l,close:c,volume:100});
test('higher timeframe uses only completely closed candles',()=>{
 const c=[candle(0,100,101,99,100),candle(3,100,101,99,100)];
 assert.equal(closedAt(c,900000,900000),0);
 assert.equal(closedAt(c,899999,900000),-1);
 assert.equal(closedAt(c,1800000,900000),1);
});
test('ambiguous OHLC bar uses stop-first for long',()=>{
 const x=simulateExit({bars:[candle(0,100,104,96,102)],startIndex:0,entry:100,stop:98,target:103,side:'LONG',maxBars:1,slippageRate:0});
 assert.equal(x?.reason,'Stop (both touched)');assert.equal(x?.exit,98);
});
test('long gap past stop uses worse open price',()=>{
 const x=simulateExit({bars:[candle(0,95,96,94,95)],startIndex:0,entry:100,stop:98,target:103,side:'LONG',maxBars:1,slippageRate:0});
 assert.equal(x?.exit,95);
});
test('time limit forces exit at 30 minutes',()=>{
 const bars=Array.from({length:8},(_,i)=>candle(i,100,100.5,99.5,100));
 const x=simulateExit({bars,startIndex:0,entry:100,stop:98,target:103,side:'LONG',maxBars:6,slippageRate:0});
 assert.equal(x?.index,5);assert.equal(x?.reason,'Time exit');
});
test('unfinished position at end of dataset does not count',()=>{
 const x=simulateExit({bars:[candle(0,100,101,99,100)],startIndex:0,entry:100,stop:98,target:103,side:'LONG',maxBars:6,slippageRate:0});
 assert.equal(x,null);
});
