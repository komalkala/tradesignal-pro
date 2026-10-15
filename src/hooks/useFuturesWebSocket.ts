
"use client";

import { useEffect, useState } from "react";

import type {SymbolId} from "@/lib/types";
type Symbol = SymbolId;
type Interval = "5m" | "15m" | "1h" | "4h" | "1d" | "1w";

type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export function useFuturesWebSocket(
  symbol: Symbol,
  interval: Interval
) {
  const [candle, setCandle] = useState<Candle | null>(null);
  const [lastClosedCandle, setLastClosedCandle] =
    useState<Candle | null>(null);
  const [status, setStatus] = useState<
    "connecting" | "connected" | "disconnected"
  >("connecting");

  useEffect(() => {
    let socket: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let active = true;
    let retries = 0;

    const connect = () => {
      if (!active) return;

      setStatus("connecting");

      socket = new WebSocket(
        `wss://fstream.binance.com/market/ws/` +
        `${symbol.toLowerCase()}@kline_${interval}`
      );

      socket.onopen = () => {
        retries = 0;
        setStatus("connected");
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          const k = message.k;

          if (!k) return;

          const next: Candle = {
            time: Number(k.t), // Keep milliseconds, consistent with REST candles
            open: Number(k.o),
            high: Number(k.h),
            low: Number(k.l),
            close: Number(k.c),
            volume: Number(k.v),
          };

          setCandle(next);

          if (k.x === true) {
            setLastClosedCandle(next);
          }
        } catch {
        }
      };

      socket.onerror = () => {
        socket?.close();
      };

      socket.onclose = () => {
        if (!active) return;

        setStatus("disconnected");

        const delay = Math.min(
          1000 * 2 ** retries++,
          30000
        );

        retryTimer = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      active = false;
      if (retryTimer) clearTimeout(retryTimer);
      socket?.close();
    };
  }, [symbol, interval]);

  return { candle, lastClosedCandle, status };
}
