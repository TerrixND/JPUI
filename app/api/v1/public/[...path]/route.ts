import { NextRequest, NextResponse } from "next/server";

const normalizeBaseUrl = (url: string) => url.replace(/\/+$/, "");

const getApiBaseUrl = () =>
  process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "";

export const runtime = "nodejs";

const buildTargetUrl = ({
  apiBaseUrl,
  path,
  search,
}: {
  apiBaseUrl: string;
  path: string[];
  search: string;
}) => {
  const normalizedPath = path.map((segment) => encodeURIComponent(segment)).join("/");
  return `${normalizeBaseUrl(apiBaseUrl)}/api/v1/public/${normalizedPath}${search}`;
};

const isBodyMethod = (method: string) => {
  const upper = method.toUpperCase();
  return upper !== "GET" && upper !== "HEAD";
};

const proxyPublicRequest = async (
  request: NextRequest,
  params: { path: string[] },
) => {
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

  const targetUrl = buildTargetUrl({
    apiBaseUrl,
    path: params.path || [],
    search: request.nextUrl.search,
  });

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
  const contentType = request.headers.get("content-type");

  const shouldForwardBody = isBodyMethod(request.method);
  const body = shouldForwardBody ? await request.text() : undefined;

  const headers: HeadersInit = {};

  if (authorization) {
    headers.Authorization = authorization;
  }

  if (contentType && shouldForwardBody) {
    headers["Content-Type"] = contentType;
  }

  try {
    const upstreamResponse = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
    });

    const upstreamBody = await upstreamResponse.text();
    const upstreamContentType =
      upstreamResponse.headers.get("content-type") || "application/json";

    return new NextResponse(upstreamBody, {
      status: upstreamResponse.status,
      headers: {
        "Content-Type": upstreamContentType,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown network error.";

    return NextResponse.json(
      {
        message: `Unable to reach upstream public endpoint (${targetUrl}). ${message}`,
      },
      { status: 502 },
    );
  }
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const params = await context.params;
  return proxyPublicRequest(request, params);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const params = await context.params;
  return proxyPublicRequest(request, params);
}
