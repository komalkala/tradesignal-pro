import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {marketStructure} from '../src/lib/market-structure';
import {riskContext} from '../src/lib/event-risk';
import {parseEvents} from '../src/lib/v7-events';
test('no fabricated pivots with short input',()=>{assert.equal(marketStructure([]).trend,'INSUFFICIENT DATA');});
test('weekend risk flag is contextual',()=>{assert.equal(riskContext(Date.parse('2026-10-10T12:00:00Z')).weekend,true);});
test('configured event within one day is a caution, never an automatic block',()=>{const events=parseEvents(JSON.stringify([{id:'test-event',name:'CPI test fixture',timeUTC:'2026-10-28T14:00:00Z',source:'https://www.bls.gov/test',impact:'HIGH'}]));assert.equal(riskContext(Date.parse('2026-10-27T12:00:00Z'),'BTC',events).highEventWindow,true);});
