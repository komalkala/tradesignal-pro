
import type { Candle, Interval, SymbolId } from "./types";

const BASE = "https://api.bybit.com";

const INTERVALS: Record<string, string> = {
  "5m": "5",
  "15m": "15",
  "1h": "60",
  "4h": "240",
  "1d": "D",
  "1w": "W",
};

const DURATION_MS: Record<string, number> = {
  "5m": 5 * 60_000,
  "15m": 15 * 60_000,
  "1h": 60 * 60_000,
  "4h": 4 * 60 * 60_000,
  "1d": 24 * 60 * 60_000,
  "1w": 7 * 24 * 60 * 60_000,
};

type BybitKlineResponse = {
  retCode: number;
  retMsg: string;
  result?: {
    category: string;
    symbol: string;
    list: string[][];
  };
};

export async function getCandles(
  symbol: SymbolId,
  interval: Interval | "1w",
  limit = 700
): Promise<Candle[]> {
  const providerInterval = INTERVALS[interval];
  const duration = DURATION_MS[interval];

  if (!providerInterval || !duration) {
    throw new Error(`Unsupported interval: ${interval}`);
  }

  const count = Math.min(1000, Math.max(250, limit));

  const url = new URL("/v5/market/kline", BASE);
  url.searchParams.set("category", "linear");
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", providerInterval);
  url.searchParams.set("limit", String(count));

  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) {
    throw new Error(
      `Bybit market data HTTP ${response.status}`
    );
  }

  const raw: BybitKlineResponse = await response.json();

  if (
    raw.retCode !== 0 ||
    !Array.isArray(raw.result?.list)
  ) {
    throw new Error(
      `Bybit response error: ${raw.retMsg || raw.retCode}`
    );
  }

  const now = Date.now();

  const candles: Candle[] = raw.result.list
    .map((row): Candle => {
      if (!Array.isArray(row) || row.length < 6) {
        throw new Error("Invalid Bybit candle");
      }

      return {
        time: Number(row[0]),
        open: Number(row[1]),
        high: Number(row[2]),
        low: Number(row[3]),
        close: Number(row[4]),
        volume: Number(row[5]),
      };
    })
    .filter((c) => c.time + duration <= now)
    .sort((a, b) => a.time - b.time);

  if (candles.length < 210) {
    throw new Error(
      `Insufficient completed candles: ${candles.length}`
    );
  }

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];

    if (
      ![
        c.time,
        c.open,
        c.high,
        c.low,
        c.close,
        c.volume,
      ].every(Number.isFinite) ||
      c.open <= 0 ||
      c.high < Math.max(c.open, c.close, c.low) ||
      c.low > Math.min(c.open, c.close) ||
      c.low <= 0 ||
      c.volume < 0
    ) {
      throw new Error("Invalid OHLCV values");
    }

    if (i > 0 && c.time <= candles[i - 1].time) {
      throw new Error("Duplicate or unordered candles");
    }
  }

  return candles;
}
