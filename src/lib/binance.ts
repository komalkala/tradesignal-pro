
import type { Candle, Interval, SymbolId } from "./types";

const BASE = "https://www.okx.com";

const SYMBOLS: Record<SymbolId, string> = {
  BTCUSDT: "BTC-USDT-SWAP",
  ETHUSDT: "ETH-USDT-SWAP",
  SOLUSDT: "SOL-USDT-SWAP",
};

const INTERVALS: Record<string, string> = {
  "5m": "5m",
  "15m": "15m",
  "1h": "1H",
  "4h": "4H",
  "1d": "1Dutc",
  "1w": "1Wutc",
};

type OKXResponse = {
  code: string;
  msg: string;
  data: string[][];
};

export async function getCandles(
  symbol: SymbolId,
  interval: Interval | "1w",
  limit = 700
): Promise<Candle[]> {
  const instId = SYMBOLS[symbol];
  const bar = INTERVALS[interval];

  if (!instId || !bar) {
    throw new Error("Unsupported symbol or interval");
  }

  const requested = Math.max(250, Math.min(1500, limit));
  const candles: Candle[] = [];
  let after: string | undefined;

  while (candles.length < requested) {
    const url = new URL("/api/v5/market/history-candles", BASE);

    url.searchParams.set("instId", instId);
    url.searchParams.set("bar", bar);
    url.searchParams.set(
      "limit",
      String(Math.min(100, requested - candles.length + 1))
    );

    if (after) {
      url.searchParams.set("after", after);
    }

    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });

    if (!response.ok) {
      throw new Error(`OKX HTTP ${response.status}`);
    }

    const raw: OKXResponse = await response.json();

    if (raw.code !== "0" || !Array.isArray(raw.data)) {
      throw new Error(`OKX API error: ${raw.msg}`);
    }

    if (raw.data.length === 0) break;

    for (const row of raw.data) {
      if (row.length < 9 || row[8] !== "1") continue;

      const candle: Candle = {
        time: Number(row[0]),
        open: Number(row[1]),
        high: Number(row[2]),
        low: Number(row[3]),
        close: Number(row[4]),
        volume: Number(row[6]),
      };

      if (
        [
          candle.time,
          candle.open,
          candle.high,
          candle.low,
          candle.close,
          candle.volume,
        ].every(Number.isFinite)
      ) {
        candles.push(candle);
      }
    }

    after = raw.data[raw.data.length - 1][0];

    if (raw.data.length < 2) break;
  }

  const unique = Array.from(
    new Map(candles.map((c) => [c.time, c])).values()
  ).sort((a, b) => a.time - b.time);

  if (unique.length < 210) {
    throw new Error(
      `Not enough completed OKX candles: ${unique.length}`
    );
  }

  return unique.slice(-requested);
}
