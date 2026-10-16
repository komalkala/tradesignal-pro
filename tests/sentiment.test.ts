import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyRsi,classifyFear} from '../src/lib/sentiment';
test('RSI boundaries',()=>{assert.equal(classifyRsi(70),'OVERBOUGHT');assert.equal(classifyRsi(30),'OVERSOLD');assert.equal(classifyRsi(69.9),'NEUTRAL');assert.equal(classifyRsi(30.1),'NEUTRAL');});
test('fear categories',()=>{assert.equal(classifyFear(12),'Extreme Fear');assert.equal(classifyFear(49),'Neutral');assert.equal(classifyFear(80),'Extreme Greed');assert.throws(()=>classifyFear(101));});
