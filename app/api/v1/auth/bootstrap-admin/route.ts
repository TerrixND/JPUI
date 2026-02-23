import { NextRequest, NextResponse } from "next/server";

const normalizeBaseUrl = (url: string) => url.replace(/\/+$/, "");

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const apiBaseUrl = process.env.API_BASE_URL;
  const bootstrapSecret = process.env.SUPER_ADMIN_BOOTSTRAP_SECRET;

  const missingEnvVars = [
    !apiBaseUrl ? "API_BASE_URL" : "",
    !bootstrapSecret ? "SUPER_ADMIN_BOOTSTRAP_SECRET" : "",
  ].filter(Boolean);

  if (!apiBaseUrl || !bootstrapSecret) {
    return NextResponse.json(
      {
        message: `Missing required server env var(s): ${missingEnvVars.join(", ")}.`,
      },
      { status: 500 },
    );
  }

  const authorization = request.headers.get("authorization");

  if (!authorization) {
    return NextResponse.json(
      { message: "Missing authorization header." },
      { status: 401 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { message: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const targetUrl = `${normalizeBaseUrl(apiBaseUrl)}/api/v1/auth/bootstrap-admin`;

  let upstreamResponse: Response;

  try {
    upstreamResponse = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authorization,
        "x-bootstrap-secret": bootstrapSecret,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown network error.";

    return NextResponse.json(
      { message: `Unable to reach upstream bootstrap-admin endpoint. ${message}` },
      { status: 502 },
    );
  }

  const responseBody = await upstreamResponse.json().catch(() => null);

  if (responseBody === null) {
    return NextResponse.json(
      { message: "Upstream bootstrap-admin endpoint did not return valid JSON." },
      { status: 502 },
    );
  }

  return NextResponse.json(responseBody, {
    status: upstreamResponse.status,
  });
}
