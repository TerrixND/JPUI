import { NextRequest, NextResponse } from "next/server";

const normalizeBaseUrl = (url: string) => url.replace(/\/+$/, "");
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

const getApiBaseUrl = () =>
  process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "";

const normalizeHostname = (hostname: string) =>
  hostname.trim().toLowerCase().replace(/^\[|\]$/g, "");

const resolvePort = (url: URL) =>
  url.port || (url.protocol === "https:" ? "443" : "80");

const isSameProxyOrigin = (targetUrl: URL, requestUrl: URL) => {
  if (targetUrl.protocol !== requestUrl.protocol) {
    return false;
  }

  if (resolvePort(targetUrl) !== resolvePort(requestUrl)) {
    return false;
  }

  const targetHost = normalizeHostname(targetUrl.hostname);
  const requestHost = normalizeHostname(requestUrl.hostname);

  if (targetHost === requestHost) {
    return true;
  }

  return LOOPBACK_HOSTS.has(targetHost) && LOOPBACK_HOSTS.has(requestHost);
};

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

  const targetUrl = `${normalizeBaseUrl(apiBaseUrl)}/api/v1/auth/line/authorize${request.nextUrl.search}`;

  try {
    const parsedTargetUrl = new URL(targetUrl);

    if (isSameProxyOrigin(parsedTargetUrl, request.nextUrl)) {
      return NextResponse.json(
        {
          message:
            "API_BASE_URL points to this frontend origin (or a loopback alias of it). Point it to your backend service origin.",
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

  try {
    const upstreamResponse = await fetch(targetUrl, {
      method: "GET",
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
        message: `Unable to reach upstream LINE authorize endpoint (${targetUrl}). ${message}`,
      },
      { status: 502 },
    );
  }
}
