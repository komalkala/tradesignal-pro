import { NextRequest, NextResponse } from "next/server";

import { getCandles } from "@/lib/binance";
import {
  futuresSnapshot,
  profile,
  qualitySignal,
} from "@/lib/pro";

import { parseMarketParams } from "@/lib/market-params";
import type { Interval } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const p = parseMarketParams(req.nextUrl.searchParams);

  if ("error" in p) {
    return NextResponse.json(p, { status: 400 });
  }

  const higher: Interval =
    p.interval === "5m"
      ? "15m"
      : p.interval === "15m"
        ? "1h"
        : p.interval === "1h"
          ? "4h"
          : "1d";

  const results = await Promise.allSettled([
    getCandles(p.symbol, p.interval, 700),
    getCandles(p.symbol, higher, 300),
    getCandles("BTCUSDT", higher, 300),
    futuresSnapshot(p.symbol),
  ] as const);

  const names = [
    "candles",
    "higherCandles",
    "btcCandles",
    "snapshot",
  ];

  const failures = results.flatMap((result, index) =>
    result.status === "rejected"
      ? [{
          operation: names[index],
          message:
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason),
        }]
      : []
  );

  if (failures.length > 0) {
    console.error("Market API failures:", failures);

    return NextResponse.json(
      {
        error: "Market data request failed",
        failures,
      },
      { status: 502 }
    );
  }

  // All operations succeeded
  const candles = (
    results[0] as PromiseFulfilledResult<
      Awaited<ReturnType<typeof getCandles>>
    >
  ).value;

  const higherCandles = (
    results[1] as PromiseFulfilledResult<
      Awaited<ReturnType<typeof getCandles>>
    >
  ).value;

  const btcCandles = (
    results[2] as PromiseFulfilledResult<
      Awaited<ReturnType<typeof getCandles>>
    >
  ).value;

  const snapshot = (
    results[3] as PromiseFulfilledResult<
      Awaited<ReturnType<typeof futuresSnapshot>>
    >
  ).value;

  const higherProfile = profile(higherCandles);
  const btcProfile = profile(btcCandles);

  const signal = qualitySignal({
    candles,
    higher: higherProfile,
    btc: btcProfile,
    symbol: p.symbol,
    snapshot,
  });

  return NextResponse.json(
    {
      symbol: p.symbol,
      interval: p.interval,
      higherInterval: higher,
      candles,
      signal,
      higher: higherProfile,
      btc: btcProfile,
      snapshot,
      updatedAt: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}