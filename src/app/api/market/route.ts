import { NextRequest, NextResponse } from 'next/server';
import { getCandles } from '@/lib/binance';
import { indicatorSeries } from '@/lib/indicators';
import { generateSignal } from '@/lib/strategy';
import { DEFAULT_SETTINGS } from '@/lib/types';
import { parseMarketParams } from '@/lib/market-params';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const params = parseMarketParams(req.nextUrl.searchParams);
  if ('error' in params) return NextResponse.json({ error: params.error }, { status: 400 });

  try {
    const candles = await getCandles(params.symbol, params.interval);
    const series = indicatorSeries(candles);
    const last = candles.length - 1;
    return NextResponse.json(
      {
        ...params,
        candles,
        signal: generateSignal(candles[last], series[last], DEFAULT_SETTINGS),
        lastUpdated: new Date().toISOString(),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Market data unavailable' },
      { status: 502 },
    );
  }
}
