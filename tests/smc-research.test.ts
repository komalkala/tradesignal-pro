import test from 'node:test';
import assert from 'node:assert/strict';
import {detectSmcEvents,runSmcBacktest,smcCandidate} from '../src/lib/smc-research';
import type {Candle} from '../src/lib/types';
const candles:Candle[]=Array.from({length:100},(_,i)=>{const p=100+i*.2+Math.sin(i/3)*3;return {time:i*300000,open:p-.2,high:p+1,low:p-1,close:p+.2,volume:100};});
test('detector never reports event after last provided candle',()=>{const events=detectSmcEvents(candles);assert.ok(events.every(e=>e.time<=candles.at(-1)!.time));});
test('short input returns no actionable SMC entry',()=>assert.equal(smcCandidate(candles.slice(0,20),[]),null));
test('backtest outcome remains finite',()=>{const result=runSmcBacktest(candles);assert.ok(Number.isFinite(result.metrics.netPnl));assert.ok(result.trades.every(t=>t.entryTime<t.exitTime));});
