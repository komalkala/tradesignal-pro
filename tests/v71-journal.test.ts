import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {advancePaperTrade,makePaperTrade,paperMetrics} from '../src/lib/v71-journal';
import type {V7Decision} from '../src/lib/v7-decision';
const H=3600000;
const decision={symbol:'SOLUSDT',side:'LONG',status:'CONFIRMED_LONG',entry:100,stop:98,target:104,isFresh:true,signalTime:10*H} as V7Decision;
test('only fresh confirmed valid setups create paper records',()=>{
 assert.ok(makePaperTrade(decision,11*H));assert.equal(makePaperTrade({...decision,status:'WAIT'},11*H),null);assert.equal(makePaperTrade({...decision,isFresh:false},11*H),null);
});
test('fills at next candle open, handles stop and computes fees in R',()=>{
 const p=makePaperTrade(decision,11*H)!;
 const bars=[{time:10*H,open:101,high:102,low:97,close:99,volume:1}];
 const result=advancePaperTrade(p,bars,11*H,{slippage:0,feePerSide:0});
 assert.equal(result.entry,101);assert.equal(result.status,'STOP');assert.equal(result.exit,99);assert.equal(result.netR,-1);
});
test('never fills using unfinished candle',()=>{
 const p=makePaperTrade(decision,11*H)!;
 const bars=[{time:10*H,open:101,high:110,low:90,close:100,volume:1}];
 assert.equal(advancePaperTrade(p,bars,10*H+1000).status,'PENDING_ENTRY');
});
test('empty journal has undefined win rate, not 0%',()=>{
 assert.equal(paperMetrics([]).winRate,null);
});

test('does not simulate a late fill if the immediate next candle is missing',()=>{
 const p=makePaperTrade(decision,11*H)!;
 const bars=[{time:12*H,open:100,high:100,low:100,close:100,volume:1}];
 const result=advancePaperTrade(p,bars,13*H,{slippage:0,feePerSide:0});
 assert.equal(result.status,'EXPIRED');assert.equal(result.entry,null);assert.equal(result.netR,null);
});
