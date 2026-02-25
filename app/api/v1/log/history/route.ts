import { NextRequest, NextResponse } from "next/server";

const normalizeBaseUrl = (url: string) => url.replace(/\/+$/, "");

const getApiBaseUrl = () =>
  process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const apiBaseUrl = getApiBaseUrl();

  if (!apiBaseUrl) {
    return NextResponse.json(
      {
        message:
          "API base URL is not configured. Set API_BASE_URL or NEXT_PUBLIC_API_BASE_URL.",
      },
      { status: 500 },
    );
  }

  const targetUrl = `${normalizeBaseUrl(apiBaseUrl)}/api/v1/log/history${request.nextUrl.search}`;

  try {
    const targetOrigin = new URL(targetUrl).origin;

    if (targetOrigin === request.nextUrl.origin) {
      return NextResponse.json(
        {
          message:
            "API_BASE_URL points to this frontend origin. Point it to your backend service origin.",
        },
        { status: 500 },
      );
    }
  } catch {
    return NextResponse.json(
      {
        message: `Invalid API base URL: ${apiBaseUrl}`,
      },
      { status: 500 },
    );
  }

  const authorization = request.headers.get("authorization");

  if (!authorization) {
    return NextResponse.json(
      {
        message: "Missing authorization header.",
      },
      { status: 401 },
    );
  }

  try {
    const upstreamResponse = await fetch(targetUrl, {
      method: "GET",
      headers: {
        Authorization: authorization,
      },
      cache: "no-store",
    });

    const upstreamBody = await upstreamResponse.text();
    const contentType =
      upstreamResponse.headers.get("content-type") || "application/json";

    return new NextResponse(upstreamBody, {
      status: upstreamResponse.status,
      headers: {
        "Content-Type": contentType,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown network error.";

    return NextResponse.json(
      {
        message: `Unable to reach upstream log history endpoint (${targetUrl}). ${message}`,
      },
      { status: 502 },
    );
  }
}
