import test from 'node:test';
import assert from 'node:assert/strict';
import { closeMs, freshestComplete, higherInterval, isFresh, INTERVAL_MS } from '../src/lib/alerts/logic';
import type { Candle } from '../src/lib/types';

const candle = (time: number): Candle => ({ time, open: 100, high: 101, low: 99, close: 100, volume: 10 });

test('5m candle duration and higher interval mapping', () => {
  assert.equal(INTERVAL_MS['5m'], 300_000);
  assert.equal(higherInterval('5m'), '15m');
});

test('freshestComplete returns latest closed 5m candle, not forming candle', () => {
  const now = Date.UTC(2026, 9, 12, 7, 19, 11);
  const bars = [candle(Date.UTC(2026, 9, 12, 7, 10)), candle(Date.UTC(2026, 9, 12, 7, 15))];
  const last = freshestComplete(bars, '5m', now);
  assert.equal(last?.time, bars[0].time);
  assert.equal(closeMs(last!, '5m'), Date.UTC(2026, 9, 12, 7, 15));
  assert.equal(isFresh(last!, '5m', now), true);
});

test('5m candle becomes stale after interval plus grace', () => {
  const last = candle(Date.UTC(2026, 9, 12, 7, 10));
  assert.equal(isFresh(last, '5m', Date.UTC(2026, 9, 12, 7, 26)), false);
});
