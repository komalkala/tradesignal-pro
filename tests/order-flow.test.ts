import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeAggTrades,analyzeVolume} from '../src/lib/order-flow';
test('maker flag reflects taker direction',()=>{const r=analyzeAggTrades([{p:'100',q:'3',m:false,T:1},{p:'100',q:'1',m:true,T:2}]);assert.equal(r.pressure,'BUYERS_DOMINANT');assert.equal(r.buyPercent,75);assert.equal(r.sellPercent,25)});
test('detect high and low volume against previous 20 completed candles',()=>{const base=Array.from({length:20},(_,i)=>({time:i,open:100,high:110,low:90,close:105,volume:100}));assert.equal(analyzeVolume([...base,{...base[0],volume:200,time:21}],'1h').level,'HIGH');assert.equal(analyzeVolume([...base,{...base[0],volume:50,time:21}],'4h').level,'LOW')});
