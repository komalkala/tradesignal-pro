import { NextRequest, NextResponse } from 'next/server';
import { getCandles } from '@/lib/binance';
import { backtest } from '@/lib/backtest';
import { DEFAULT_SETTINGS } from '@/lib/types';
import { parseMarketParams } from '@/lib/market-params';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const params = parseMarketParams(req.nextUrl.searchParams);
  if ('error' in params) return NextResponse.json({ error: params.error }, { status: 400 });

  try {
    const candles = await getCandles(params.symbol, params.interval, 1200);
    return NextResponse.json(
      { ...params, candleCount: candles.length, result: backtest(candles, DEFAULT_SETTINGS) },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Backtest unavailable' },
      { status: 502 },
    );
  }
}
