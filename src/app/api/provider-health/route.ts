
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const url = new URL(
    "https://www.okx.com/api/v5/market/candles"
  );

  url.searchParams.set("instId", "ETH-USDT-SWAP");
  url.searchParams.set("bar", "15m");
  url.searchParams.set("limit", "5");

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return NextResponse.json({
        provider: "okx",
        accessible: false,
        httpStatus: response.status,
      });
    }

    const data = await response.json() as {
      code?: string;
      msg?: string;
      data?: unknown[];
    };

    return NextResponse.json({
      provider: "okx",
      accessible:
        data.code === "0" &&
        Array.isArray(data.data) &&
        data.data.length > 0,
      providerCode: data.code,
      message: data.msg,
      candlesReturned: data.data?.length ?? 0,
    });
  } catch (error) {
    return NextResponse.json({
      provider: "okx",
      accessible: false,
      error:
        error instanceof Error
          ? error.message
          : "Provider request failed",
    });
  }
}
