import assert from 'node:assert/strict';
import test from 'node:test';
import { parseMarketParams } from '../src/lib/market-params';

test('accepts supported market and interval', () => {
  assert.deepEqual(parseMarketParams(new URLSearchParams('symbol=SOLUSDT&interval=1h')), {
    symbol: 'SOLUSDT', interval: '1h',
  });
});

test('normalizes separators and capitalization', () => {
  assert.deepEqual(parseMarketParams(new URLSearchParams('symbol=btc%2Fusdt&interval=4H')), {
    symbol: 'BTCUSDT', interval: '4h',
  });
});

test('rejects unsupported input with diagnostic details', () => {
  const result = parseMarketParams(new URLSearchParams('symbol=DOGEUSDT&interval=3h'));
  assert.ok('error' in result);
  if ('error' in result) assert.match(result.error, /DOGEUSDT/);
});
