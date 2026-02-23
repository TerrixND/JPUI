import { NextRequest, NextResponse } from "next/server";

const normalizeBaseUrl = (url: string) => url.replace(/\/+$/, "");

const getApiBaseUrl = () =>
  process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "";

const isBootstrapModeEnabled = () =>
  Boolean(process.env.SUPER_ADMIN_BOOTSTRAP_SECRET?.trim());

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
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

  const targetUrl = `${normalizeBaseUrl(apiBaseUrl)}/api/v1/auth/precheck-signup`;

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

  const body = await request.text();

  try {
    const upstreamResponse = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body,
      cache: "no-store",
    });

    const upstreamBody = await upstreamResponse.text();
    const contentType =
      upstreamResponse.headers.get("content-type") || "application/json";

    if (contentType.toLowerCase().includes("application/json")) {
      try {
        const parsed = JSON.parse(upstreamBody) as unknown;

        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          const responseBody = parsed as Record<string, unknown>;
          const bootstrapEnabled = isBootstrapModeEnabled();

          if (typeof responseBody.bootstrapEnabled !== "boolean") {
            responseBody.bootstrapEnabled = bootstrapEnabled;
          }

          if (typeof responseBody.onboardingMode !== "string") {
            responseBody.onboardingMode = bootstrapEnabled
              ? "bootstrap-admin"
              : "setup-user";
          }

          return NextResponse.json(responseBody, {
            status: upstreamResponse.status,
          });
        }
      } catch {
        // Fall through and return the raw upstream body.
      }
    }

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
        message: `Unable to reach upstream signup precheck endpoint (${targetUrl}). ${message}`,
      },
      { status: 502 },
    );
  }
}
