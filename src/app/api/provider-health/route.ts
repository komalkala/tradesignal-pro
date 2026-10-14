
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const url = new URL("https://api.bybit.com/v5/market/kline");

  url.searchParams.set("category", "linear");
  url.searchParams.set("symbol", "ETHUSDT");
  url.searchParams.set("interval", "15");
  url.searchParams.set("limit", "5");

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return NextResponse.json({
        provider: "bybit",
        accessible: false,
        httpStatus: response.status,
      });
    }

    const data: unknown = await response.json();

    if (!data || typeof data !== "object") {
      throw new Error("Invalid provider response");
    }

    const result = data as {
      retCode?: number;
      retMsg?: string;
      result?: { list?: unknown[] };
    };

    return NextResponse.json({
      provider: "bybit",
      accessible:
        result.retCode === 0 &&
        Array.isArray(result.result?.list) &&
        result.result.list.length > 0,
      providerCode: result.retCode,
      message: result.retMsg,
      candlesReturned: result.result?.list?.length ?? 0,
    });
  } catch (error) {
    return NextResponse.json({
      provider: "bybit",
      accessible: false,
      error:
        error instanceof Error
          ? error.message
          : "Provider request failed",
    });
  }
}
