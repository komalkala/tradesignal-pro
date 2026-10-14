import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {marketStructure} from '../src/lib/market-structure';
import {riskContext} from '../src/lib/event-risk';
test('no fabricated pivots with short input',()=>{assert.equal(marketStructure([]).trend,'INSUFFICIENT DATA');});
test('weekend risk flag is contextual',()=>{assert.equal(riskContext(Date.parse('2026-10-10T12:00:00Z')).weekend,true);});
test('event reminder is within one day',()=>{assert.equal(riskContext(Date.parse('2026-10-27T12:00:00Z')).highEventWindow,true);});
