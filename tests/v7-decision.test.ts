import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {parseEvents,eventRisk} from '../src/lib/v7-events';
import {v7Decision} from '../src/lib/v7-decision';
import type {Candle} from '../src/lib/types';
test('Invalid events ignored; no automatic blocking',()=>{
 assert.deepEqual(parseEvents('not JSON'),[]);
 const e=parseEvents(JSON.stringify([{id:'cpi',name:'CPI',timeUTC:'2026-12-10T13:30:00Z',impact:'CRITICAL',source:'https://www.bls.gov/'}]));
 assert.equal(e.length,1);const r=eventRisk(e,Date.parse('2026-12-10T13:20:00Z'));
 assert.equal(r.level,'HIGH_VOLATILITY');assert.equal(r.mayTrade,true);
});
test('Missing historical data never returns confirmed signal',()=>{
 const now=Date.now()-3600000;
 const c:Candle={time:now,open:100,high:102,low:98,close:101,volume:100};
 const r=v7Decision('BTCUSDT',[c],[c],[c],now+3600000);
 assert.equal(r.status,'INSUFFICIENT_DATA');assert.equal(r.entry,null);
});
