"use client";

import ProductDetailClientComponent from "./ProductDetailClient";
import {
  ApiClientError,
  forceLogoutToBlockedPage,
  getUserAuthenticityRecord,
  getUserMe,
  isAccountAccessDeniedError,
  redirectToBlockedPage,
  type AuthenticityRecord,
  type UserMeResponse,
} from "@/lib/apiClient";
import { buildAuthRouteWithReturnTo } from "@/lib/authRedirect";
import { completePendingSetupForSession, isAuthBlockedError } from "@/lib/setupUser";
import supabase, { isSupabaseConfigured } from "@/lib/supabase";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";

const steps = [
  {
    number: "01",
    title: "Acquisition",
    desc: "Every artifact is sourced through verified channels and recorded before certification.",
  },
  {
    number: "02",
    title: "Examination",
    desc: "Jade Palace specialists review the piece, physical details, and supporting records.",
  },
  {
    number: "03",
    title: "Certification",
    desc: "The product is tied to a unique authenticity card token for traceable verification.",
  },
  {
    number: "04",
    title: "Ownership",
    desc: "Ownership stays with Jade Palace until the sold product is claimed by the final customer.",
  },
];

const formatDate = (value: string | null | undefined) => {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const buildClaimMessage = (
  record: AuthenticityRecord | null,
  viewer: UserMeResponse | null,
) => {
  if (!record) {
    return "";
  }

  if (viewer?.role !== "CUSTOMER") {
    return "Sign in with a customer account to claim ownership.";
  }

  if (record.claim.blockedCode === "ALREADY_OWNER") {
    return "This product is already registered to your account.";
  }

  if (record.claim.latestClaim?.status === "PENDING") {
    return "Your ownership claim is pending. Continue with email OTP verification to complete it.";
  }

  return (
    record.claim.blockedReason ||
    "Ownership claim will be enabled after Jade Palace confirms the completed sale."
  );
};

const LoadingState = () => (
  <main className="min-h-screen bg-white px-6 py-24 text-stone-900 sm:px-12 lg:px-20">
    <div className="mx-auto max-w-3xl rounded-3xl border border-stone-200 bg-stone-50 p-10 text-center shadow-sm">
      <p className="text-xs uppercase tracking-[0.35em] text-emerald-600">
        Authenticity
      </p>
      <h1 className="mt-4 text-3xl font-light tracking-tight text-stone-900">
        Loading verification record
      </h1>
      <p className="mt-4 text-sm text-stone-500">
        We are validating your session and loading the authenticity record.
      </p>
    </div>
  </main>
);

const ErrorState = ({
  message,
  loginHref,
  signupHref,
}: {
  message: string;
  loginHref: string;
  signupHref: string;
}) => (
  <main className="min-h-screen bg-white px-6 py-24 text-stone-900 sm:px-12 lg:px-20">
    <div className="mx-auto max-w-3xl rounded-3xl border border-red-200 bg-red-50 p-10 shadow-sm">
      <p className="text-xs uppercase tracking-[0.35em] text-red-600">
        Authenticity
      </p>
      <h1 className="mt-4 text-3xl font-light tracking-tight text-stone-900">
        Unable to open this verification page
      </h1>
      <p className="mt-4 text-sm leading-7 text-stone-600">{message}</p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href={loginHref}
          className="rounded-full bg-emerald-600 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
        >
          Login
        </Link>
        <Link
          href={signupHref}
          className="rounded-full border border-stone-300 px-5 py-3 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-100"
        >
          Create Account
        </Link>
      </div>
    </div>
  </main>
);

const AuthenticityClientComponent = ({
  authenticityToken,
}: {
  authenticityToken: string;
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const encodedToken = encodeURIComponent(authenticityToken);
  const returnTo = `/authenticity/${encodedToken}`;
  const loginHref = buildAuthRouteWithReturnTo("/login", returnTo);
  const signupHref = buildAuthRouteWithReturnTo("/signup", returnTo);

  const [viewer, setViewer] = useState<UserMeResponse | null>(null);
  const [record, setRecord] = useState<AuthenticityRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [claimMessage, setClaimMessage] = useState("");

  useEffect(() => {
    let isDisposed = false;

    const loadAuthenticityRecord = async () => {
      setLoading(true);
      setError("");

      try {
        if (!isSupabaseConfigured) {
          throw new Error(
            "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_PROJECT_URL and NEXT_PUBLIC_SUPABASE_PUB_KEY.",
          );
        }

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          throw new Error(sessionError.message);
        }

        if (!session?.access_token) {
          router.replace(loginHref);
          return;
        }

        await completePendingSetupForSession({
          accessToken: session.access_token,
          email: session.user?.email,
        });

        const me = await getUserMe({
          accessToken: session.access_token,
        });
        const nextRecord = await getUserAuthenticityRecord({
          accessToken: session.access_token,
          authenticityToken,
        });

        if (isDisposed) {
          return;
        }

        setViewer(me);
        setRecord(nextRecord);
        setClaimMessage(buildClaimMessage(nextRecord, me));
      } catch (loadError) {
        if (isDisposed) {
          return;
        }

        if (isAuthBlockedError(loadError)) {
          await supabase.auth.signOut().catch(() => undefined);
          redirectToBlockedPage({
            message: loadError.message,
            code: loadError.code,
            details: loadError.details,
          });
          return;
        }

        if (
          loadError instanceof ApiClientError &&
          isAccountAccessDeniedError(loadError)
        ) {
          await forceLogoutToBlockedPage(
            loadError.payload ?? {
              message: loadError.message,
              code: loadError.code,
            },
          );
          return;
        }

        if (
          loadError instanceof ApiClientError &&
          loadError.status === 401
        ) {
          router.replace(loginHref);
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load authenticity record.",
        );
      } finally {
        if (!isDisposed) {
          setLoading(false);
        }
      }
    };

    void loadAuthenticityRecord();

    return () => {
      isDisposed = true;
    };
  }, [authenticityToken, loginHref, router]);

  const claimNotice = searchParams.get("claim") === "verified"
    ? "Ownership claimed successfully."
    : "";

  const productDetail = useMemo(() => {
    if (!record) {
      return null;
    }

    return {
      id: record.product.id,
      name: record.product.name || "Jade Palace Product",
      sku: record.product.sku,
      color: record.product.color,
      origin: record.product.origin,
      description: record.product.description,
      weight: record.product.weight,
      length: record.product.length,
      depth: record.product.depth,
      height: record.product.height,
      totalMassGram: record.product.totalMassGram,
      refractiveIndex: record.product.refractiveIndex,
      densityGPerCm3: record.product.densityGPerCm3,
      uvVisSpectrumNm: record.product.uvVisSpectrumNm,
      cutAndShape: record.product.cutAndShape,
      measurementMm: record.product.measurementMm,
      tier: record.product.tier,
      status: record.product.status || "PENDING",
      media: record.product.media
        .filter((item) => item.url)
        .map((item, index) => ({
          id: item.id,
          type: item.type || "IMAGE",
          url: item.url || "",
          isPrimary: index === 0,
        })),
      currentOwnership: {
        ownerName: record.ownership.current?.ownerName || "Jade Palace Pt Co",
        acquiredAt: record.ownership.current?.claimedAt || null,
      },
      certificate: {
        fileUrl: record.certificate.fileUrl,
        serialNumber: record.authCard.cardSerial || record.product.sku,
        registeredAt: record.authCard.issuedAt,
        issuedBy: "Jade Palace Pt Co",
      },
    };
  }, [record]);

  const latestClaim = record?.claim.latestClaim || null;
  const ownershipHistory = record?.ownership.history || [];
  const ownershipOtpHref = useMemo(() => {
    if (!record) {
      return "";
    }

    const params = new URLSearchParams();
    params.set("flow", "ownership-claim");
    params.set("returnTo", returnTo);
    params.set("cardToken", record.token);
    params.set("productId", record.product.id);
    return `/otp?${params.toString()}`;
  }, [record, returnTo]);
  const canShowClaimButton =
    viewer?.role === "CUSTOMER" && record?.claim.canClaim === true;
  const canContinueClaimVerification =
    viewer?.role === "CUSTOMER" && latestClaim?.status === "PENDING";

  if (loading) {
    return <LoadingState />;
  }

  if (error && !record) {
    return <ErrorState message={error} loginHref={loginHref} signupHref={signupHref} />;
  }

  if (!productDetail) {
    return (
      <ErrorState
        message="Authenticity record is unavailable."
        loginHref={loginHref}
        signupHref={signupHref}
      />
    );
  }

  return (
    <div className="bg-white">
      <ProductDetailClientComponent product={productDetail} showActions={false} />

      <section className="px-6 pb-20 sm:px-12 lg:px-20">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-stone-200 bg-stone-50 p-8 shadow-sm">
            <p className="text-xs uppercase tracking-[0.35em] text-emerald-600">
              Authenticity Record
            </p>
            <h2 className="mt-4 text-3xl font-light tracking-tight text-stone-900">
              Card verification and ownership
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-stone-600">
              This page is tied to the card token printed on the Jade Palace
              authenticity card. Ownership remains with Jade Palace until the
              final customer claim is completed.
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {[
                {
                  label: "Card Serial",
                  value: record.authCard.cardSerial || "Not assigned",
                },
                {
                  label: "Card Status",
                  value: record.authCard.status || "Unknown",
                },
                {
                  label: "Issued On",
                  value: formatDate(record.authCard.issuedAt),
                },
                {
                  label: "Sale Confirmed",
                  value: formatDate(record.claim.saleConfirmedAt),
                },
              ].map((entry) => (
                <div
                  key={entry.label}
                  className="rounded-2xl border border-stone-200 bg-white p-5"
                >
                  <p className="text-[10px] uppercase tracking-[0.25em] text-stone-500">
                    {entry.label}
                  </p>
                  <p className="mt-2 text-sm font-medium text-stone-800">
                    {entry.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              {record.certificate.fileUrl ? (
                <a
                  href={record.certificate.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full bg-emerald-600 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
                >
                  Open Certificate File
                </a>
              ) : (
                <span className="rounded-full border border-stone-300 px-5 py-3 text-sm text-stone-500">
                  Digital certificate file not attached yet
                </span>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-stone-200 bg-white p-8 shadow-sm">
            <p className="text-xs uppercase tracking-[0.35em] text-emerald-600">
              Claim Status
            </p>
            <h2 className="mt-4 text-2xl font-light tracking-tight text-stone-900">
              Current owner
            </h2>
            <p className="mt-2 text-base text-stone-700">
              {record.ownership.current?.ownerName || "Jade Palace Pt Co"}
            </p>
            <p className="mt-2 text-sm text-stone-500">
              Recorded on {formatDate(record.ownership.current?.claimedAt)}
            </p>

            {latestClaim ? (
              <div className="mt-6 rounded-2xl border border-stone-200 bg-stone-50 p-4">
                <p className="text-[10px] uppercase tracking-[0.25em] text-stone-500">
                  Latest Claim
                </p>
                <p className="mt-2 text-sm font-medium text-stone-800">
                  {latestClaim.status || "PENDING"}
                </p>
                <p className="mt-1 text-sm text-stone-500">
                  Requested on {formatDate(latestClaim.requestedAt)}
                </p>
              </div>
            ) : null}

            {claimNotice ? (
              <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                {claimNotice}
              </div>
            ) : null}

            <p className="mt-6 text-sm leading-7 text-stone-600">
              {claimMessage}
            </p>

            {error ? (
              <p className="mt-4 text-sm text-red-600">{error}</p>
            ) : null}

            {canShowClaimButton ? (
              <button
                type="button"
                onClick={() => {
                  router.push(ownershipOtpHref);
                }}
                className="mt-6 w-full rounded-full bg-emerald-600 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
              >
                Claim Ownership
              </button>
            ) : null}

            {!canShowClaimButton && canContinueClaimVerification ? (
              <button
                type="button"
                onClick={() => {
                  router.push(ownershipOtpHref);
                }}
                className="mt-6 w-full rounded-full border border-emerald-200 px-5 py-3 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-50"
              >
                Continue OTP Verification
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="px-6 py-20 sm:px-12 lg:px-20">
        <div className="rounded-3xl border border-stone-200 bg-stone-50 p-8 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-emerald-600">
                Ownership Timeline
              </p>
              <h2 className="mt-4 text-3xl font-light tracking-tight text-stone-900">
                Ownership history
              </h2>
            </div>
            <p className="text-sm text-stone-500">
              {ownershipHistory.length} recorded ownership entr
              {ownershipHistory.length === 1 ? "y" : "ies"}
            </p>
          </div>

          <div className="mt-8 space-y-4">
            {ownershipHistory.map((entry, index) => (
              <div
                key={`${entry.id || entry.ownerName || "ownership"}-${index}`}
                className="rounded-2xl border border-stone-200 bg-white p-5"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-lg font-medium text-stone-900">
                      {entry.ownerName || "Unknown Owner"}
                    </p>
                    <p className="mt-1 text-sm text-stone-500">
                      Claimed on {formatDate(entry.claimedAt)}
                    </p>
                  </div>

                  <span
                    className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] ${
                      entry.isCurrent
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-stone-100 text-stone-500"
                    }`}
                  >
                    {entry.isCurrent ? "Current" : "Past"}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 text-sm text-stone-600 md:grid-cols-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.25em] text-stone-500">
                      Card Serial
                    </p>
                    <p className="mt-1">{entry.cardSerial || "-"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.25em] text-stone-500">
                      Ended On
                    </p>
                    <p className="mt-1">{formatDate(entry.endedAt)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.25em] text-stone-500">
                      Reason
                    </p>
                    <p className="mt-1">
                      {entry.endReason || (entry.isCurrent ? "Active owner" : "-")}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 pb-20 sm:px-12 lg:px-20">
        <p className="mb-12 text-xs uppercase tracking-[0.35em] text-emerald-600">
          Authentication Process
        </p>

        <div className="grid gap-8 md:grid-cols-4">
          {steps.map((step) => (
            <div key={step.number}>
              <span className="mb-3 block text-4xl font-light text-stone-300">
                {step.number}
              </span>
              <div className="mb-4 h-2 w-2 rounded-full bg-emerald-500" />
              <h3 className="mb-2 text-sm font-medium uppercase tracking-wider text-stone-800">
                {step.title}
              </h3>
              <p className="text-sm leading-relaxed text-stone-500">
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default AuthenticityClientComponent;
