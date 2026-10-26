import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {parseEvents} from '../src/lib/v7-events';
import {riskContext} from '../src/lib/event-risk';
const dt='2026-11-11T13:30:00Z'; // Synthetic fixture, NOT a real event time.
test('one configured calendar feeds market context, no stale preloaded dates',()=>{
 const events=parseEvents(JSON.stringify([{id:'test-cpi',name:'CPI',timeUTC:dt,impact:'CRITICAL',source:'https://www.bls.gov/example'}]));
 const context=riskContext(Date.parse('2026-11-10T13:00:00Z'),'BTC',events);
 assert.equal(context.calendarConfigured,true);
 assert.deepEqual(context.upcoming.map(e=>e.id),['test-cpi']);
 assert.equal(context.highEventWindow,true);
 assert.ok(context.note.includes('never blocked')||context.note.includes('never block'));
});
test('empty event calendar must not be reported as safe',()=>{
 const ctx=riskContext(Date.parse('2026-11-10T13:00:00Z'),'BTC',[]);
 assert.equal(ctx.calendarConfigured,false);
 assert.equal(ctx.upcoming.length,0);
 assert.match(ctx.note,/not mean no news/i);
});
test('scheduled events require exact UTC timestamps',()=>{
 const raw=[{id:'bad',name:'CPI',timeUTC:'2026-11-11',impact:'HIGH',source:'https://www.bls.gov/'}];
 assert.equal(parseEvents(JSON.stringify(raw)).length,0);
});
